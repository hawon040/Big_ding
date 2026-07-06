const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  // 학번 (로그인 아이디, 중복 불가)
  studentId: { type: String, required: true, unique: true },

  // 관리자가 부여한 특수번호 2자리 (초기 비번 뒷자리)
  professorCode: { type: String, required: true },

  // 비밀번호 (pre save에서 자동 해시 암호화)
  password: { type: String, required: true },

  // 닉네임
  nickname: { type: String, required: true },

  // 프로필 사진 URL (Firebase Storage)
  avatar: { type: String },

  // 담당 교수 (3명 중 1명만 허용)
  professor: {
    type: String,
    required: true,
    enum: ["유진호", "차대현", "홍진근"],
  },

  // 최초 로그인 여부 (true면 회원가입 화면 표시)
  isFirstLogin: { type: Boolean, default: true },

  // 친구 목록
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  // 차단한 사용자 목록
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

}, { timestamps: true }); // createdAt, updatedAt 자동 생성

// 저장 전 비밀번호 자동 해시 암호화
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// 로그인 시 비밀번호 검증
userSchema.methods.comparePassword = function (input) {
  return bcrypt.compare(input, this.password);
};

module.exports = mongoose.model("User", userSchema);