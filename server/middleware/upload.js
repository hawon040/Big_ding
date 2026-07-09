const multer = require("multer");

// 모든 업로드 이미지(게시글/아바타/채팅)는 Cloudinary로 바로 올라가므로 디스크에 남기지 않는다.
const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB (실제 휴대폰 사진은 수 MB인 경우가 많음)
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("INVALID_FILE_TYPE"));
    }
    cb(null, true);
  },
});

// multer가 던지는 에러(용량 초과, 이미지가 아닌 파일 등)를 그대로 두면 Express 기본
// 에러 핸들러가 HTML을 응답해버려 프론트에서 원인을 알 수 없는 실패로 보인다.
// JSON 메시지로 변환해서 응답한다.
module.exports = {
  single: (fieldName) => (req, res, next) => {
    uploader.single(fieldName)(req, res, (err) => {
      if (!err) return next();
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "이미지 용량은 10MB 이하만 가능합니다." });
      }
      if (err.message === "INVALID_FILE_TYPE") {
        return res.status(400).json({ message: "이미지 파일만 업로드할 수 있습니다." });
      }
      return res.status(400).json({ message: "이미지 업로드에 실패했습니다." });
    });
  },
};
