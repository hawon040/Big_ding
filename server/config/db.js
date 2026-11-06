const mongoose = require("mongoose");
const { DEPARTMENT } = require("../constants/department");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB 연결 성공");
    // 기존 가입자도 학과를 AI 빅데이터 학과로 맞춘다 (탈퇴자는 제외)
    const User = require("../models/User");
    User.updateMany(
      { isWithdrawn: { $ne: true }, department: { $ne: DEPARTMENT } },
      { $set: { department: DEPARTMENT } },
      { timestamps: false }
    ).catch((e) => console.error("학과 일괄 갱신 실패:", e.message));
  } catch (err) {
    console.error("❌ MongoDB 연결 실패:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
