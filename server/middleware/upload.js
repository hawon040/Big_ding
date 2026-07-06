const multer = require("multer");
const path = require("path");
const fs = require("fs");

// 이미지는 Firebase 같은 외부 스토리지 없이 서버 로컬 디스크(uploads/<subdir>)에 저장한다.
const UPLOAD_ROOT = path.join(__dirname, "..", "uploads");

module.exports = function createUploader(subdir) {
  const dir = path.join(UPLOAD_ROOT, subdir);
  fs.mkdirSync(dir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  });

  const uploader = multer({
    storage,
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
  return {
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
};
