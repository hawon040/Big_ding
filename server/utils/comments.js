const Comment = require("../models/Comment");
const { sameId, includesId } = require("./access");
const { toAuthor, AUTHOR_FIELDS } = require("./serializers");

const DELETED_TEXT = "삭제된 댓글입니다.";

// ── 기존 클라이언트 호환 ──
// 예전에는 댓글이 Post.comments에 임베드되어 있었고, 기존 화면은 게시물 응답의
// comments 배열({_id, author, content, parentComment, createdAt})을 그대로 쓴다.
// 댓글 원본은 이제 Comment 컬렉션이므로, 기존 응답 형태로 다시 붙여서 내려준다.
const toLegacyComment = (c) => ({
  _id: c._id,
  author: c.author,
  content: c.isDeleted ? DELETED_TEXT : c.content,
  parentComment: c.parentId || null,
  isDeleted: !!c.isDeleted,
  isAccepted: !!c.isAccepted,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

const legacyCommentsByPost = async (postIds) => {
  const comments = await Comment.find({ post: { $in: postIds } })
    .populate("author", "nickname avatar")
    .sort({ createdAt: 1 })
    .lean();
  const map = new Map();
  for (const c of comments) {
    const key = String(c.post);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(toLegacyComment(c));
  }
  return map;
};

// Post 문서(들)를 평범한 객체로 바꾸고 comments 필드를 Comment 컬렉션 기준으로 채운다.
const withLegacyComments = async (postOrPosts) => {
  const list = Array.isArray(postOrPosts) ? postOrPosts : [postOrPosts];
  const map = await legacyCommentsByPost(list.map((p) => p._id));
  const out = list.map((p) => {
    const obj = typeof p.toObject === "function" ? p.toObject() : { ...p };
    obj.comments = map.get(String(p._id)) || [];
    return obj;
  });
  return Array.isArray(postOrPosts) ? out : out[0];
};

const legacyCommentsOf = async (postId) => (await legacyCommentsByPost([postId])).get(String(postId)) || [];

// ── A안 댓글 트리 ──
// 최상위 댓글 아래에 대댓글을 붙이고, 채택 댓글을 맨 위로 올린다. 차단 관계인 사용자의
// 댓글은 숨기되, 그 아래 다른 사람의 대댓글은 남긴다(부모는 "삭제된 댓글" 자리로 표시).
const toTreeNode = (c, meId, hidden) => ({
  id: String(c._id),
  parentId: c.parentId ? String(c.parentId) : null,
  author: c.isDeleted || hidden ? null : toAuthor(c.author),
  content: c.isDeleted ? DELETED_TEXT : hidden ? "차단한 사용자의 댓글입니다." : c.content,
  isDeleted: !!c.isDeleted,
  isHidden: !!hidden,
  isAccepted: !!c.isAccepted,
  isMine: !c.isDeleted && sameId(c.author?._id, meId),
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

const buildCommentTree = async (postId, meId, excluded) => {
  const comments = await Comment.find({ post: postId })
    .populate("author", AUTHOR_FIELDS)
    .sort({ createdAt: 1 })
    .lean();
  const isHidden = (c) => includesId(excluded, c.author?._id);

  const roots = [];
  const byId = new Map();
  for (const c of comments.filter((x) => !x.parentId)) {
    const node = { ...toTreeNode(c, meId, isHidden(c)), replies: [] };
    byId.set(node.id, node);
    roots.push(node);
  }
  for (const c of comments.filter((x) => x.parentId)) {
    if (isHidden(c)) continue;
    byId.get(String(c.parentId))?.replies.push(toTreeNode(c, meId, false));
  }
  // 삭제·숨김 처리된 최상위 댓글은 대댓글이 없으면 굳이 보여주지 않는다.
  const visible = roots.filter((r) => !(r.isDeleted || r.isHidden) || r.replies.length > 0);
  visible.sort((a, b) => (b.isAccepted ? 1 : 0) - (a.isAccepted ? 1 : 0));
  return visible;
};

module.exports = { DELETED_TEXT, withLegacyComments, legacyCommentsOf, buildCommentTree };
