const express = require("express");
const router = express.Router();
const Post = require("../models/Post");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const profanityFilter = require("../middleware/profanityFilter");
const { uploadImage } = require("../config/cloudinary");

// GET /api/posts?board=free
router.get("/", auth, async (req, res) => {
  try {
    const { board, search } = req.query;
    const query = { isBlocked: false };
    if (board) query.board = board;
    if (search) query.$or = [
      { title: { $regex: search, $options: "i" } },
      { content: { $regex: search, $options: "i" } },
      { tags: { $in: [new RegExp(search, "i")] } },
    ];

    // 내가 차단했거나 나를 차단한 사용자의 글은 서로 보이지 않게 제외한다.
    const me = await User.findById(req.user.id).select("blockedUsers");
    const blockedMe = await User.find({ blockedUsers: req.user.id }).select("_id");
    const excludedAuthors = [...me.blockedUsers, ...blockedMe.map((u) => u._id)];
    if (excludedAuthors.length > 0) query.author = { $nin: excludedAuthors };

    const posts = await Post.find(query)
      .populate("author", "nickname avatar studentId")
      .populate("comments.author", "nickname avatar")
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// POST /api/posts
router.post("/", auth, upload.array("images", 5), profanityFilter, async (req, res) => {
  try {
    const images = req.files?.length
      ? (await Promise.all(req.files.map((file) => uploadImage(file.buffer, "posts")))).map((r) => r.secure_url)
      : [];

    let poll;
    if (req.body.poll) {
      const parsed = JSON.parse(req.body.poll);
      const options = (parsed.options || [])
        .map((text) => String(text).trim())
        .filter(Boolean);
      if (!parsed.question?.trim() || options.length < 2 || options.length > 5) {
        return res.status(400).json({ message: "투표 질문과 옵션(2~5개)을 확인해주세요." });
      }
      poll = { question: parsed.question.trim(), options: options.map((text) => ({ text, votes: [] })) };
    }

    // FormData로 온 tags는 프론트에서 JSON.stringify한 문자열이므로, 배열로 다시 풀어준다.
    // (multipart/form-data는 모든 필드가 문자열로 전송되기 때문에 poll과 마찬가지 처리가 필요하다.)
    let tags;
    if (req.body.tags) {
      try {
        const parsedTags = JSON.parse(req.body.tags);
        tags = Array.isArray(parsedTags) ? parsedTags.filter(Boolean) : undefined;
      } catch {
        tags = undefined;
      }
    }

    const { tags: _rawTags, ...restBody } = req.body;
    // 공강모임은 작성자 본인도 참여 인원에 포함되므로, 생성 시점에 참여자 목록에 넣어둔다.
    const participants = restBody.board === "meeting" ? [req.user.id] : undefined;

    const post = await Post.create({ ...restBody, images, poll, tags, participants, author: req.user.id });
    await post.populate("author", "nickname avatar");
    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// POST /api/posts/:id/join - 공강모임 참여하기
router.post("/:id/join", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || post.board !== "meeting") {
      return res.status(404).json({ message: "모임 게시물을 찾을 수 없습니다." });
    }
    const alreadyJoined = post.participants.some((id) => id.toString() === req.user.id);
    if (alreadyJoined) {
      return res.status(400).json({ message: "이미 참여한 모임입니다." });
    }
    if (post.maxParticipants && post.participants.length >= post.maxParticipants) {
      return res.status(400).json({ message: "모집 인원이 모두 찼습니다." });
    }
    post.participants.push(req.user.id);
    post.currentParticipants = post.participants.length;
    await post.save();
    await post.populate("author", "nickname avatar");
    await post.populate("comments.author", "nickname avatar");
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});
// POST /api/posts/:id/like
router.post("/:id/like", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    const idx = post.likes.indexOf(req.user.id);
    if (idx === -1) {
      post.likes.push(req.user.id);
      const dislikeIdx = post.dislikes.indexOf(req.user.id);
      if (dislikeIdx !== -1) post.dislikes.splice(dislikeIdx, 1);
    } else {
      post.likes.splice(idx, 1);
    }
    await post.save();
    res.json({ likes: post.likes.length, dislikes: post.dislikes.length });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// POST /api/posts/:id/dislike
router.post("/:id/dislike", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    const idx = post.dislikes.indexOf(req.user.id);
    if (idx === -1) {
      post.dislikes.push(req.user.id);
      const likeIdx = post.likes.indexOf(req.user.id);
      if (likeIdx !== -1) post.likes.splice(likeIdx, 1);
    } else {
      post.dislikes.splice(idx, 1);
    }
    await post.save();
    res.json({ likes: post.likes.length, dislikes: post.dislikes.length });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// POST /api/posts/:id/scrap - 스크랩(북마크) 토글
router.post("/:id/scrap", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "게시물을 찾을 수 없습니다." });
    const idx = post.scraps.indexOf(req.user.id);
    if (idx === -1) {
      post.scraps.push(req.user.id);
    } else {
      post.scraps.splice(idx, 1);
    }
    await post.save();
    res.json({ scraps: post.scraps });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// POST /api/posts/:id/comments
router.post("/:id/comments", auth, profanityFilter, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    post.comments.push({ author: req.user.id, content: req.body.content });
    await post.save();
    await post.populate("comments.author", "nickname avatar");
    res.json(post.comments);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// DELETE /api/posts/:id/comments/:commentId
router.delete("/:id/comments/:commentId", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "댓글을 찾을 수 없습니다." });
    if (comment.author.toString() !== req.user.id)
      return res.status(403).json({ message: "권한이 없습니다." });
    comment.deleteOne();
    await post.save();
    await post.populate("comments.author", "nickname avatar");
    res.json(post.comments);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

/// POST /api/posts/:id/poll/vote - 투표하기.
// 다른 옵션을 눌렀다면 그 옵션으로 옮기고, 이미 투표한 옵션을 다시 누르면 투표를 취소한다.
router.post("/:id/poll/vote", auth, async (req, res) => {
  try {
    const { optionIndex } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post || !post.poll) {
      return res.status(404).json({ message: "투표를 찾을 수 없습니다." });
    }
    if (typeof optionIndex !== "number" || optionIndex < 0 || optionIndex >= post.poll.options.length) {
      return res.status(400).json({ message: "잘못된 옵션입니다." });
    }

    // 지금 누른 옵션에 내가 이미 투표해뒀었는지 먼저 확인해둔다.
    const alreadyVotedThisOption = post.poll.options[optionIndex].votes.some(
      (v) => v.toString() === req.user.id
    );

    // 어느 옵션에 투표했었든 일단 내 투표를 전부 지운다.
    post.poll.options.forEach((opt) => {
      opt.votes = opt.votes.filter((v) => v.toString() !== req.user.id);
    });

    // 방금 누른 옵션에 이미 투표해뒀던 게 아니라면(= 새 옵션이거나 처음 투표라면) 다시 넣어준다.
    // 이미 투표해뒀던 옵션을 다시 눌렀다면 여기서 아무것도 안 넣어서 투표가 취소된다.
    if (!alreadyVotedThisOption) {
      post.poll.options[optionIndex].votes.push(req.user.id);
    }

    await post.save();
    await post.populate("author", "nickname avatar");
    await post.populate("comments.author", "nickname avatar");
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// DELETE /api/posts/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (post.author.toString() !== req.user.id)
      return res.status(403).json({ message: "권한이 없습니다." });
    await post.deleteOne();
    res.json({ message: "삭제되었습니다." });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;
