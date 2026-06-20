const PROFANITY_LIST = ["욕설", "비속어", "씨발", "개새끼", "병신", "지랄", "꺼져", "죽어"];

const filterProfanity = (text) => {
  let filtered = text;
  PROFANITY_LIST.forEach((word) => {
    const regex = new RegExp(word, "gi");
    filtered = filtered.replace(regex, "*".repeat(word.length));
  });
  return filtered;
};

// 게시글/댓글 작성 시 자동 필터링
module.exports = (req, res, next) => {
  if (req.body.title) req.body.title = filterProfanity(req.body.title);
  if (req.body.content) req.body.content = filterProfanity(req.body.content);
  next();
};

module.exports.filterProfanity = filterProfanity;
