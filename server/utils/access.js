const User = require("../models/User");

const sameId = (a, b) => String(a) === String(b);
const includesId = (list, id) => (list || []).some((x) => sameId(x, id));

// 나와 서로 보이지 않아야 하는 사용자(내가 차단했거나 나를 차단한 사람) id 목록과 내 정보.
const getViewerContext = async (meId) => {
  const [me, blockedMe] = await Promise.all([
    User.findById(meId).select("blockedUsers following interests").lean(),
    User.find({ blockedUsers: meId }).select("_id").lean(),
  ]);
  const excluded = [...(me?.blockedUsers || []), ...blockedMe.map((u) => u._id)];
  return { me: me || { _id: meId, following: [], blockedUsers: [], interests: [] }, excluded };
};

const isBlockedBetween = (a, b) =>
  User.exists({ $or: [{ _id: a, blockedUsers: b }, { _id: b, blockedUsers: a }] });

// 목록에서 볼 수 있는 글: 관리자 숨김·소프트 삭제 제외, 차단 관계 제외, 공개범위 확인
// (전체공개는 누구나, 팔로워 공개는 작성자를 팔로우하는 사람, 나만 보기는 본인만).
const visiblePostsFilter = ({ me, excluded }) => ({
  isBlocked: { $ne: true },
  isDeleted: { $ne: true },
  ...(excluded.length ? { author: { $nin: excluded } } : {}),
  $or: [
    { author: me._id },
    { visibility: { $nin: ["followers", "private"] } },
    { visibility: "followers", author: { $in: me.following || [] } },
  ],
});

// 개별 글에 대한 접근/상호작용 권한. 목록과 같은 기준으로 확인한다.
// (목록은 postId를 몰라야 막히지만, 개별 액션은 postId만 알면 우회할 수 있으므로)
const canAccessPost = async (post, userId) => {
  if (post.isDeleted) return false;
  const authorId = post.author?._id || post.author;
  if (sameId(authorId, userId)) return true;
  const author = await User.findById(authorId).select("followers blockedUsers").lean();
  if (!author) return false;
  if (includesId(author.blockedUsers, userId)) return false;
  const me = await User.findById(userId).select("blockedUsers").lean();
  if (includesId(me?.blockedUsers, authorId)) return false;

  const visibility = post.visibility || "all";
  if (visibility === "private") return false;
  if (visibility === "followers") return includesId(author.followers, userId);
  return true;
};

module.exports = { sameId, includesId, getViewerContext, isBlockedBetween, visiblePostsFilter, canAccessPost };
