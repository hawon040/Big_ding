// 게시글 목록·작성·상세·수정·삭제
const express = require("express");
const router = express.Router();
const Post = require("../../models/Post");
const User = require("../../models/User");
const PostView = require("../../models/PostView");
const GroupChat = require("../../models/GroupChat");
const AdminActionLog = require("../../models/AdminActionLog");
const auth = require("../../middleware/authMiddleware");
const upload = require("../../middleware/upload");
const profanityFilter = require("../../middleware/profanityFilter");
const { uploadImage } = require("../../config/cloudinary");
const { escapeRegex } = require("../../utils/regex");
const { BOARDS, BOARD_KEYS, RECRUIT_BOARDS } = require("../../constants/boards");
const { getViewerContext, visiblePostsFilter, canAccessPost, sameId, includesId } = require("../../utils/access");
const { wantsPage, parseLimit, decodeCursor, pageBy } = require("../../utils/pagination");
const { AUTHOR_FIELDS, cardProjection, toPostCard, toPostDetail } = require("../../utils/serializers");
const { withLegacyComments } = require("../../utils/comments");
const { refreshPostPopularity } = require("../../utils/popularity");
const { runInTransaction } = require("../../utils/transaction");
const { notifyStudyRecruit } = require("../../utils/notify");
const v = require("../../utils/validate");

const TITLE_MAX = 100;
const CONTENT_MAX = 20000;
// 주제 선택이 없는 기존 글쓰기 화면은 이 게시판들에 글을 쓰지 않는다. 여기에 쓰는 글과
// topics를 보낸 요청(새 글쓰기 화면)만 주제 1~3개를 필수로 검증한다.
const TOPIC_REQUIRED_BOARDS = BOARDS.filter((b) => b.primary && b.key !== "free").map((b) => b.key);

const parseRecruit = (raw, board) => {
  const recruit = v.parseJsonField(raw, "모집 정보");
  if (recruit === undefined) return undefined;
  if (!RECRUIT_BOARDS.includes(board)) v.fail("모집 정보는 스터디·공모전 게시판에서만 쓸 수 있습니다.");
  const capacity = Number(recruit?.capacity);
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 100) v.fail("모집 인원은 2~100명 사이로 입력해주세요.");
  return { status: "open", capacity, current: 1 };
};

const parsePoll = (raw) => {
  const parsed = v.parseJsonField(raw, "투표");
  if (parsed === undefined) return undefined;
  const options = (parsed.options || []).map((text) => String(text).trim()).filter(Boolean);
  if (!parsed.question?.trim() || options.length < 2 || options.length > 5) {
    v.fail("투표 질문과 옵션(2~5개)을 확인해주세요.");
  }
  return { question: parsed.question.trim(), options: options.map((text) => ({ text, votes: [] })) };
};

// GET /api/posts?board=all|<key>[&cursor=&limit=] — 커뮤니티 목록(최신순)
// cursor/limit 없이 부르면 기존 클라이언트용 응답(배열 전체, 임베드 형태 댓글 포함)
router.get("/", auth, async (req, res) => {
  try {
    const ctx = await getViewerContext(req.user.id);
    const { board, search } = req.query;
    const conditions = [visiblePostsFilter(ctx)];

    if (wantsPage(req.query)) {
      if (board !== undefined && board !== "all" && !BOARD_KEYS.includes(board)) v.fail("알 수 없는 게시판입니다.");
      if (board && board !== "all") conditions.push({ board });
      const { docs, nextCursor } = await pageBy({
        model: Post,
        filter: { $and: conditions },
        cursor: decodeCursor(req.query.cursor),
        limit: parseLimit(req.query.limit),
        build: (q) => q.select(cardProjection(req.user.id)).populate("author", AUTHOR_FIELDS).lean(),
      });
      return res.json({ items: docs.map((p) => toPostCard(p, req.user.id)), nextCursor });
    }

    if (typeof board === "string" && board) conditions.push({ board });
    if (typeof search === "string" && search) {
      const safe = escapeRegex(search);
      conditions.push({
        $or: [
          { title: { $regex: safe, $options: "i" } },
          { content: { $regex: safe, $options: "i" } },
          { tags: { $in: [new RegExp(safe, "i")] } },
        ],
      });
    }
    const posts = await Post.find({ $and: conditions })
      .populate("author", "nickname avatar studentId followers")
      .sort({ createdAt: -1 });
    res.json(await withLegacyComments(posts));
  } catch (err) {
    v.handleError(res, err);
  }
});

// POST /api/posts — multipart/form-data (images 최대 5장, 배열·객체 필드는 JSON 문자열)
router.post("/", auth, upload.array("images", 5), profanityFilter, async (req, res) => {
  try {
    const { board } = req.body;
    if (!BOARD_KEYS.includes(board)) v.fail("게시판을 선택해주세요.");
    // 행사공지 게시판은 관리자 또는 행사공지 작성 권한이 있는 계정만 (클라이언트 체크는 우회 가능)
    if (board === "event") {
      const me = await User.findById(req.user.id).select("isAdmin canPostEvents").lean();
      if (!me?.isAdmin && !me?.canPostEvents) {
        return res.status(403).json({ message: "행사공지 게시판은 관리자만 작성할 수 있습니다." });
      }
    }

    const title = v.requireString(req.body.title, "제목", { max: TITLE_MAX });
    const poll = parsePoll(req.body.poll);
    // 투표만 올리는 글은 본문 없이도 등록할 수 있다.
    const content = poll && !req.body.content
      ? ""
      : v.requireString(req.body.content, "내용", { max: CONTENT_MAX });
    const topicsRaw = v.parseJsonField(req.body.topics, "주제");
    const topics = TOPIC_REQUIRED_BOARDS.includes(board) || topicsRaw !== undefined ? v.postTopics(topicsRaw) : [];
    const tags = v.postTags(v.parseJsonField(req.body.tags, "태그"));
    const recruit = parseRecruit(req.body.recruit, board);
    const visibility = ["all", "followers", "private"].includes(req.body.visibility) ? req.body.visibility : "all";

    const images = req.files?.length
      ? (await Promise.all(req.files.map((file) => uploadImage(file.buffer, "posts")))).map((r) => r.secure_url)
      : [];

    // 기존 게시판 전용 필드는 클라이언트가 보내는 것만 명시적으로 골라 저장한다.
    // (req.body를 통째로 넘기면 likes/isBlocked 같은 필드를 조작할 수 있다)
    const { maxParticipants, currentParticipants, rating, lectureGrade } = req.body;
    // 공강모임은 작성자 본인도 참여 인원에 포함된다.
    const participants = board === "meeting" ? [req.user.id] : undefined;

    const post = await runInTransaction(async (session) => {
      const [created] = await Post.create([{
        author: req.user.id, board, title, content, images, poll, tags, topics, recruit, visibility,
        maxParticipants, currentParticipants, rating, lectureGrade, participants,
      }], { session });
      await User.updateOne({ _id: req.user.id }, { $inc: { postCount: 1 } }, { session });
      return created;
    });
    await post.populate("author", "nickname avatar department");

    // 공강모임을 만들면 작성자가 방장인 채팅방이 함께 생긴다.
    if (post.board === "meeting") {
      await GroupChat.create({ post: post._id, host: req.user.id, members: [req.user.id] });
    }
    if (post.board === "study" && post.recruit?.status === "open") {
      notifyStudyRecruit(post).catch((err) => console.error("스터디 모집 알림 실패:", err.message));
    }

    res.status(201).json({ ...post.toObject(), comments: [], id: String(post._id) });
  } catch (err) {
    v.handleError(res, err);
  }
});

// GET /api/posts/:id — 상세. 같은 사용자는 하루 1회만 조회수 증가(PostView upsert)
router.get("/:id", auth, async (req, res) => {
  try {
    if (!v.isId(req.params.id)) return res.status(404).json({ message: "게시물을 찾을 수 없습니다." });
    const post = await Post.findById(req.params.id).populate("author", AUTHOR_FIELDS);
    if (!post || post.isDeleted || (post.isBlocked && !sameId(post.author?._id, req.user.id))) {
      return res.status(404).json({ message: "게시물을 찾을 수 없습니다." });
    }
    if (!(await canAccessPost(post, req.user.id))) return res.status(403).json({ message: "권한이 없습니다." });

    if (!sameId(post.author?._id, req.user.id)) {
      const view = await PostView.updateOne(
        { post: post._id, user: req.user.id },
        { $setOnInsert: { createdAt: new Date() } },
        { upsert: true }
      );
      if (view.upsertedCount === 1) {
        await Post.updateOne({ _id: post._id }, { $inc: { viewCount: 1 } }, { timestamps: false });
        post.viewCount += 1;
        refreshPostPopularity(post._id).catch((err) => console.error("인기 점수 갱신 실패:", err.message));
      }
    }

    const me = await User.findById(req.user.id).select("following").lean();
    res.json(toPostDetail(post.toObject(), req.user.id, {
      isFollowingAuthor: includesId(me?.following, post.author?._id),
    }));
  } catch (err) {
    v.handleError(res, err);
  }
});

// PATCH /api/posts/:id — 작성자만. title, content, visibility, topics, tags
router.patch("/:id", auth, profanityFilter, async (req, res) => {
  try {
    if (!v.isId(req.params.id)) return res.status(404).json({ message: "게시물을 찾을 수 없습니다." });
    const post = await Post.findById(req.params.id);
    if (!post || post.isDeleted) return res.status(404).json({ message: "게시물을 찾을 수 없습니다." });
    if (!sameId(post.author, req.user.id)) return res.status(403).json({ message: "권한이 없습니다." });

    const { title, content, visibility, topics, tags } = req.body;
    if (title !== undefined) post.title = v.requireString(title, "제목", { max: TITLE_MAX });
    if (content !== undefined) {
      post.content = post.poll && content === "" ? "" : v.requireString(content, "내용", { max: CONTENT_MAX });
    }
    if (["all", "followers", "private"].includes(visibility)) post.visibility = visibility;
    if (topics !== undefined) post.topics = v.postTopics(topics);
    if (tags !== undefined) post.tags = v.postTags(tags);
    await post.save();

    const updated = await Post.findById(post._id).populate("author", "nickname avatar studentId department");
    res.json(await withLegacyComments(updated));
  } catch (err) {
    v.handleError(res, err);
  }
});

// DELETE /api/posts/:id — 작성자 또는 관리자. 소프트 삭제(목록·상세에서 제외)
router.delete("/:id", auth, async (req, res) => {
  try {
    if (!v.isId(req.params.id)) return res.status(404).json({ message: "게시물을 찾을 수 없습니다." });
    const post = await Post.findById(req.params.id);
    if (!post || post.isDeleted) return res.status(404).json({ message: "게시물을 찾을 수 없습니다." });
    const isAdminDeletion = !sameId(post.author, req.user.id);
    if (isAdminDeletion) {
      const me = await User.findById(req.user.id).select("isAdmin").lean();
      if (!me?.isAdmin) return res.status(403).json({ message: "권한이 없습니다." });
    }
    await AdminActionLog.create({
      actor: req.user.id,
      actorIsAdmin: isAdminDeletion,
      actionType: "deletePost",
      board: post.board,
      targetAuthor: post.author,
      snapshot: { title: post.title, content: post.content },
    });
    await runInTransaction(async (session) => {
      const r = await Post.updateOne(
        { _id: post._id, isDeleted: { $ne: true } },
        { $set: { isDeleted: true, deletedAt: new Date() } },
        { session, timestamps: false }
      );
      if (r.modifiedCount === 1) {
        await User.updateOne({ _id: post.author }, { $inc: { postCount: -1 } }, { session });
      }
    });
    res.json({ message: "삭제되었습니다." });
  } catch (err) {
    v.handleError(res, err);
  }
});

module.exports = router;
