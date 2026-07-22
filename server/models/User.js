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

  // 비공개 계정 여부 (비공개면 친구가 아닌 사람에게는 글/북마크/팔로워·팔로잉 목록을 숨긴다)
  isPrivate: { type: Boolean, default: false },

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

  // 나를 팔로우하는 사용자 목록
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

 // 내가 팔로우하는 사용자 목록
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  // 탈퇴 여부 (탈퇴해도 게시글/댓글은 남기기 위해 문서를 삭제하지 않고 익명화한다)
  isWithdrawn: { type: Boolean, default: false },

  // 탈퇴 처리된 시각
  withdrawnAt: { type: Date },

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