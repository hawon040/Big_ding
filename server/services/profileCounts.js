const Post = require("../models/Post");
const Feed = require("../models/Feed");
const User = require("../models/User");
const { emitToUser } = require("../socket/chatSocket");

// 프로필 상단 숫자(피드글·게시글·팔로워·팔로잉). 저장된 카운트($inc)는 예전 경로로 생긴 관계나
// 숨김·삭제를 따라가지 못해 어긋날 수 있어서, 프로필에서는 원본(글 컬렉션·팔로우 배열)에서 매번 센다.
const liveCounts = async (userId) => {
  const visible = { author: userId, isDeleted: { $ne: true }, isBlocked: { $ne: true } };
  const [posts, feeds, user] = await Promise.all([
    Post.countDocuments(visible),
    Feed.countDocuments(visible),
    User.findById(userId).select("followers following").lean(),
  ]);
  return {
    posts,
    feeds,
    followers: user?.followers?.length || 0,
    following: user?.following?.length || 0,
  };
};

// 숫자가 바뀌었다고 해당 사용자들에게 알린다 — 열려 있는 마이페이지·프로필이 받아서 다시 불러온다.
const announceCounts = (...userIds) =>
  userIds.forEach((id) => emitToUser(String(id), "profile_counts_changed", { userId: String(id) }));

module.exports = { liveCounts, announceCounts };
