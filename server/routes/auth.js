const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");

// 교수별 인증번호 설정 (관리자가 직접 관리) - 중복 제거를 위해 상단으로 분리
const professorCodes = {
  "유진호": "11",
  "차대현": "22",
  "홍진근": "33",
};

// POST /api/auth/verify-code
// 교수별 인증번호 2자리 검증
// 관리자가 교수마다 다른 코드를 설정
// ==========================================
router.post("/verify-code", async (req, res) => {
  try {
    const { studentId, professor, code } = req.body;

    // 해당 교수의 인증번호와 비교
    if (professorCodes[professor] !== code) {
      return res.status(401).json({ message: "인증번호가 올바르지 않습니다." });
    }

    // 학번이 이미 등록된 경우 중복 체크
    const exists = await User.findOne({ studentId });
    if (exists) return res.status(400).json({ message: "이미 가입된 학번입니다." });

    res.json({ message: "인증 성공!" });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// POST /api/auth/register - 회원가입
router.post("/register", async (req, res) => {
  try {
    const { studentId, name, professor, code, password } = req.body;

    // 교수별 인증번호 검증
    if (professorCodes[professor] !== code) {
      return res.status(401).json({ message: "인증번호가 올바르지 않습니다." });
    }

    // 중복 학번 체크
    const exists = await User.findOne({ studentId });
    if (exists) return res.status(400).json({ message: "이미 가입된 학번입니다." });

    // 유저 생성
    const user = new User({
      studentId,
      professorCode: code,       // 인증번호 저장
      password,                  // pre save에서 자동 해시 암호화
      nickname: name,            // 이름을 닉네임으로 저장
      professor,
      isFirstLogin: false,       // 회원가입으로 생성 → 바로 로그인 가능
    });

    await user.save();
    res.json({ message: "회원가입 완료!" });
  } catch (err) {
    res.status(500).json({ message: "서버 오류", error: err.message });
  }
});

// POST /api/auth/login
// 학번 + 학번에 특수 번호
router.post("/login", async (req, res) => {
  try {
    const { studentId, password } = req.body;

    // 1. 학번으로 유저 찾기
    const user = await User.findOne({ studentId });
    if (!user) return res.status(401).json({ message: "학번이 올바르지 않습니다." });

    // 2. 비밀번호 검증
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: "비밀번호가 올바르지 않습니다." });

    // 3. 토큰 발급
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { ...user.toObject(), password: undefined }, isFirstLogin: user.isFirstLogin });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// PATCH /api/auth/password
// 비밀번호 변경 (로그인 필요)
router.patch("/password", auth, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const user = await User.findById(req.user.id);
    user.password = newPassword;
    user.isFirstLogin = false;
    await user.save();
    res.json({ message: "비밀번호가 변경되었습니다." });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// GET /api/auth/me
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// PATCH /api/auth/register-complete - 회원가입 완료
// 최초 로그인 후 이름, 교수, 비밀번호 등록
router.patch("/register-complete", auth, async (req, res) => {
  try {
    const { name, professor, password } = req.body;

    // 교수 유효성 검사
    const validProfessors = Object.keys(professorCodes); // 하드코딩 대신 위 객체 참조
    if (!validProfessors.includes(professor)) {
      return res.status(400).json({ message: "올바른 교수를 선택하세요." });
    }

    // DB에서 유저 찾기
    const user = await User.findById(req.user.id);

    // 이름, 교수, 비밀번호, 최초로그인 여부 업데이트
    user.nickname = name;        // 이름을 닉네임으로 저장
    user.professor = professor;  // 담당 교수 저장
    user.password = password;    // pre save에서 자동 해시 암호화
    user.isFirstLogin = false;   // 회원가입 완료 표시

    await user.save();
    res.json({ message: "회원가입 완료!" });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;