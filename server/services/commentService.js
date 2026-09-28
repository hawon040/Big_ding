const Comment = require("../models/Comment");
const Post = require("../models/Post");
const User = require("../models/User");
const AdminActionLog = require("../models/AdminActionLog");
const { ACCEPT_BOARDS } = require("../constants/boards");
const { runInTransaction } = require("../utils/transaction");
const { refreshPostPopularity } = require("../utils/popularity");
const { notifySafely } = require("../utils/notify");
const { canAccessPost, sameId } = require("../utils/access");
const { HttpError, requireString, isId } = require("../utils/validate");

const COMMENT_MAX = 1000;

const refreshScore = (postId) =>
  refreshPostPopularity(postId).catch((err) => console.error("인기 점수 갱신 실패:", err.message));

// 관리자에게 댓글 작성이 제한된 계정인지 확인한다 (기간이 지났으면 조용히 해제).
const assertCanComment = async (userId) => {
  const me = await User.findById(userId).select("commentRestrictedUntil commentRestrictionReason").lean();
  if (!me?.commentRestrictedUntil) return;
  if (me.commentRestrictedUntil > new Date()) {
    const until = new Date(me.commentRestrictedUntil).toLocaleDateString("ko-KR");
    throw new HttpError(403, `댓글 작성이 제한되었습니다. (${until}까지) 사유: ${me.commentRestrictionReason || "-"}`);
  }
  await User.updateOne(
    { _id: userId },
    { $unset: { commentRestrictedUntil: "", commentRestrictionReason: "", commentRestrictionSanctionId: "" } }
  );
};

const loadAccessiblePost = async (postId, userId) => {
  if (!isId(String(postId))) throw new HttpError(404, "게시물을 찾을 수 없습니다.");
  const post = await Post.findById(postId);
  if (!post || post.isDeleted) throw new HttpError(404, "게시물을 찾을 수 없습니다.");
  if (!(await canAccessPost(post, userId))) throw new HttpError(403, "권한이 없습니다.");
  return post;
};

// 댓글/대댓글 작성: 댓글 생성 + 글·작성자 댓글 수 증가를 한 트랜잭션으로 처리한다.
// 글 작성자에게 comment, 부모 댓글 작성자에게 reply 알림 (본인·중복 제외)
const createComment = async ({ postId, userId, content: rawContent, parentId }) => {
  await assertCanComment(userId);
  const post = await loadAccessiblePost(postId, userId);
  const content = requireString(rawContent, "댓글", { max: COMMENT_MAX });

  let parent = null;
  if (parentId) {
    if (!isId(String(parentId))) throw new HttpError(404, "답글을 달 댓글을 찾을 수 없습니다.");
    // 대댓글은 1단계까지만: 부모는 이 글의 최상위 댓글이어야 한다.
    parent = await Comment.findOne({ _id: parentId, post: post._id, parentId: null, isDeleted: false }).lean();
    if (!parent) throw new HttpError(404, "답글을 달 댓글을 찾을 수 없습니다.");
  }

  const comment = await runInTransaction(async (session) => {
    const [created] = await Comment.create(
      [{ post: post._id, author: userId, content, parentId: parent?._id || null }],
      { session }
    );
    await Post.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } }, { session, timestamps: false });
    await User.updateOne({ _id: userId }, { $inc: { commentCount: 1 } }, { session });
    return created;
  });

  refreshScore(post._id);
  notifySafely({ recipient: post.author, sender: userId, type: "comment", post: post._id, comment: comment._id, commentContent: content });
  if (parent && !sameId(parent.author, post.author)) {
    notifySafely({ recipient: parent.author, sender: userId, type: "reply", post: post._id, comment: comment._id, commentContent: content });
  }
  return { post, comment };
};

const updateComment = async ({ commentId, userId, content: rawContent }) => {
  if (!isId(String(commentId))) throw new HttpError(404, "댓글을 찾을 수 없습니다.");
  const comment = await Comment.findById(commentId);
  if (!comment || comment.isDeleted) throw new HttpError(404, "댓글을 찾을 수 없습니다.");
  if (!sameId(comment.author, userId)) throw new HttpError(403, "권한이 없습니다.");
  await loadAccessiblePost(comment.post, userId);
  comment.content = requireString(rawContent, "댓글", { max: COMMENT_MAX });
  await comment.save();
  return comment;
};

// 소프트 삭제: 내용은 "삭제된 댓글입니다"로 보이고 대댓글은 유지된다. 관리자는 남의 댓글도 삭제 가능.
const deleteComment = async ({ commentId, userId, postId }) => {
  if (!isId(String(commentId))) throw new HttpError(404, "댓글을 찾을 수 없습니다.");
  const comment = await Comment.findById(commentId);
  if (!comment || comment.isDeleted || (postId && !sameId(comment.post, postId))) {
    throw new HttpError(404, "댓글을 찾을 수 없습니다.");
  }
  const post = await Post.findById(comment.post);
  const isAdminDeletion = !sameId(comment.author, userId);
  if (isAdminDeletion) {
    const me = await User.findById(userId).select("isAdmin").lean();
    if (!me?.isAdmin) throw new HttpError(403, "권한이 없습니다.");
  } else if (!post || !(await canAccessPost(post, userId))) {
    throw new HttpError(403, "권한이 없습니다.");
  }
  if (comment.isAccepted) throw new HttpError(400, "채택된 댓글은 삭제할 수 없습니다.");

  await AdminActionLog.create({
    actor: userId,
    actorIsAdmin: isAdminDeletion,
    actionType: "deleteComment",
    board: post?.board,
    targetAuthor: comment.author,
    snapshot: { content: comment.content },
    postId: comment.post,
  });

  await runInTransaction(async (session) => {
    const res = await Comment.updateOne(
      { _id: comment._id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { session }
    );
    if (res.modifiedCount === 0) return;
    await Post.updateOne({ _id: comment.post }, { $inc: { commentCount: -1 } }, { session, timestamps: false });
    await User.updateOne({ _id: comment.author }, { $inc: { commentCount: -1 } }, { session });
  });
  refreshScore(comment.post);
  return { postId: comment.post };
};

// Q&A 채택: 글 작성자만, 글당 1개, 채택 후 변경 불가
const acceptComment = async ({ commentId, userId }) => {
  if (!isId(String(commentId))) throw new HttpError(404, "댓글을 찾을 수 없습니다.");
  const comment = await Comment.findById(commentId);
  if (!comment || comment.isDeleted) throw new HttpError(404, "댓글을 찾을 수 없습니다.");
  const post = await Post.findById(comment.post);
  if (!post || post.isDeleted) throw new HttpError(404, "게시물을 찾을 수 없습니다.");
  if (!ACCEPT_BOARDS.includes(post.board)) throw new HttpError(400, "Q&A 게시판의 글만 채택할 수 있습니다.");
  if (!sameId(post.author, userId)) throw new HttpError(403, "글 작성자만 채택할 수 있습니다.");
  if (sameId(comment.author, userId)) throw new HttpError(400, "본인 댓글은 채택할 수 없습니다.");

  await runInTransaction(async (session) => {
    const res = await Post.updateOne(
      { _id: post._id, acceptedCommentId: null },
      { $set: { acceptedCommentId: comment._id } },
      { session, timestamps: false }
    );
    if (res.modifiedCount === 0) throw new HttpError(409, "이미 채택한 댓글이 있습니다.");
    await Comment.updateOne({ _id: comment._id }, { $set: { isAccepted: true } }, { session });
  });

  notifySafely({
    recipient: comment.author, sender: userId, type: "accepted",
    post: post._id, comment: comment._id, commentContent: comment.content,
  });
  return { postId: post._id, acceptedCommentId: comment._id };
};

module.exports = { loadAccessiblePost, createComment, updateComment, deleteComment, acceptComment };
