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

  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.startsWith("image/")) {
        return cb(new Error("이미지 파일만 업로드할 수 있습니다."));
      }
      cb(null, true);
    },
  });
};
