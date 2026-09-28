// /api/posts — 파일이 커져서 역할별로 나눴다.
const express = require("express");
const router = express.Router();

router.use(require("./core"));      // 목록·작성·상세·수정·삭제
router.use(require("./actions"));   // 좋아요·스크랩·모집·공강모임·투표
router.use(require("./comments"));  // 댓글

module.exports = router;
