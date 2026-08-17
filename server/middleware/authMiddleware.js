const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "토큰이 없습니다." });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // 관리자가 차단(ban)한 계정은 세션이 남아있어도 다음 요청부터 즉시 막는다.
    const me = await User.findById(decoded.id).select("banned banType banUntil banReason");
    if (me?.banned) {
      const stillBanned = me.banType === "permanent" || (me.banUntil && me.banUntil > new Date());
      if (stillBanned) {
        const until = me.banType === "temporary" ? new Date(me.banUntil).toLocaleDateString("ko-KR") : null;
        const message = me.banType === "permanent"
          ? `이용이 영구 정지된 계정입니다. 사유: ${me.banReason || "-"}`
          : `이용이 정지된 계정입니다. (${until}까지) 사유: ${me.banReason || "-"}`;
        return res.status(403).json({ message, banned: true });
      }
      // 기간제 차단 기간이 지났다면 조용히 해제 처리 (lazy expiry)
      await User.findByIdAndUpdate(decoded.id, {
        banned: false, banType: undefined, banUntil: undefined, banReason: undefined, banSanctionId: undefined,
      });
    }

    next();
  } catch {
    res.status(401).json({ message: "유효하지 않은 토큰입니다." });
  }
};
