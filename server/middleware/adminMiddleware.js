const User = require("../models/User");

// authMiddleware 다음에 사용한다. JWT에는 역할 정보가 없으므로 DB에서 다시 확인한다.
module.exports = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("isAdmin");
    if (!user?.isAdmin) {
      return res.status(403).json({ message: "관리자만 이용할 수 있습니다." });
    }
    next();
  } catch {
    res.status(500).json({ message: "서버 오류" });
  }
};
