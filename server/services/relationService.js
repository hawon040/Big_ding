const User = require("../models/User");
const { runInTransaction } = require("../utils/transaction");
const { notifySafely } = require("../utils/notify");
const { isBlockedBetween, sameId } = require("../utils/access");
const { HttpError, isId } = require("../utils/validate");

// 팔로우·차단 관계는 User 문서의 배열(following/followers/blockedUsers)이 원본이다.
// 배열을 바꿀 때 실제로 바뀐 경우에만 카운트를 $inc해서 두 값이 어긋나지 않게 한다.

const assertTarget = async (meId, targetId) => {
  if (!isId(String(targetId))) throw new HttpError(404, "사용자를 찾을 수 없습니다.");
  if (sameId(meId, targetId)) throw new HttpError(400, "자기 자신에게는 할 수 없습니다.");
  const target = await User.findById(targetId).select("isWithdrawn").lean();
  if (!target || target.isWithdrawn) throw new HttpError(404, "사용자를 찾을 수 없습니다.");
};

// follower → following 관계 추가/삭제 (양쪽 배열과 카운트를 함께)
const link = async (followerId, followingId, session) => {
  const a = await User.updateOne(
    { _id: followerId, following: { $ne: followingId } },
    { $addToSet: { following: followingId }, $inc: { followingCount: 1 } },
    { session }
  );
  const b = await User.updateOne(
    { _id: followingId, followers: { $ne: followerId } },
    { $addToSet: { followers: followerId }, $inc: { followerCount: 1 } },
    { session }
  );
  return a.modifiedCount === 1 || b.modifiedCount === 1;
};

const unlink = async (followerId, followingId, session) => {
  await User.updateOne(
    { _id: followerId, following: followingId },
    { $pull: { following: followingId }, $inc: { followingCount: -1 } },
    { session }
  );
  await User.updateOne(
    { _id: followingId, followers: followerId },
    { $pull: { followers: followerId }, $inc: { followerCount: -1 } },
    { session }
  );
};

const follow = async (meId, targetId) => {
  await assertTarget(meId, targetId);
  if (await isBlockedBetween(meId, targetId)) throw new HttpError(403, "차단 관계인 사용자는 팔로우할 수 없습니다.");
  const added = await runInTransaction((session) => link(meId, targetId, session));
  if (added) notifySafely({ recipient: targetId, sender: meId, type: "follow" });
  return added;
};

const unfollow = async (meId, targetId) => {
  if (!isId(String(targetId))) throw new HttpError(404, "사용자를 찾을 수 없습니다.");
  await runInTransaction((session) => unlink(meId, targetId, session));
};

// 나를 팔로우하는 사람을 내 팔로워 목록에서 삭제
const removeFollower = async (meId, followerId) => {
  if (!isId(String(followerId))) throw new HttpError(404, "사용자를 찾을 수 없습니다.");
  await runInTransaction((session) => unlink(followerId, meId, session));
};

// 차단: 친구 관계와 서로의 팔로우를 모두 끊는다.
const block = async (meId, targetId) => {
  await assertTarget(meId, targetId);
  await runInTransaction(async (session) => {
    await User.updateOne({ _id: meId }, { $addToSet: { blockedUsers: targetId }, $pull: { friends: targetId } }, { session });
    await User.updateOne({ _id: targetId }, { $pull: { friends: meId } }, { session });
    await unlink(meId, targetId, session);
    await unlink(targetId, meId, session);
  });
};

const unblock = async (meId, targetId) => {
  if (!isId(String(targetId))) throw new HttpError(404, "사용자를 찾을 수 없습니다.");
  await User.updateOne({ _id: meId }, { $pull: { blockedUsers: targetId } });
};

// 탈퇴 시: 나를 팔로우하던/내가 팔로우하던 사람들의 카운트를 먼저 줄이고 관계를 정리한다.
const detachAllFollows = async (user) => {
  await User.updateMany(
    { _id: { $in: user.followers || [] }, following: user._id },
    { $pull: { following: user._id }, $inc: { followingCount: -1 } }
  );
  await User.updateMany(
    { _id: { $in: user.following || [] }, followers: user._id },
    { $pull: { followers: user._id }, $inc: { followerCount: -1 } }
  );
};

module.exports = { follow, unfollow, removeFollower, block, unblock, detachAllFollows };
