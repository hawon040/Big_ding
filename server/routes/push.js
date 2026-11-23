// Web Push 구독 관리. 클라이언트가 서비스 워커로 구독을 만든 뒤 여기에 등록한다.
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");
const push = require("../utils/push");
const { handleError } = require("../utils/validate");

const MAX_DEVICES = 10;

const isValidSub = (s) =>
  s && typeof s.endpoint === "string" && /^https:\/\//.test(s.endpoint) && s.endpoint.length <= 1000
  && typeof s.keys?.p256dh === "string" && typeof s.keys?.auth === "string"
  && s.keys.p256dh.length <= 200 && s.keys.auth.length <= 100;

// GET /api/push/public-key — 구독에 쓸 VAPID 공개키 (서버에 키가 없으면 푸시를 끈 상태)
router.get("/public-key", (req, res) => {
  if (!push.enabled) return res.status(404).json({ message: "푸시 알림이 설정되지 않은 서버입니다." });
  res.json({ publicKey: push.PUBLIC_KEY });
});

// POST /api/push/subscribe — 이 기기 구독 등록 { endpoint, keys: { p256dh, auth } }
router.post("/subscribe", auth, async (req, res) => {
  try {
    const sub = req.body;
    if (!isValidSub(sub)) return res.status(400).json({ message: "잘못된 구독 정보입니다." });
    const entry = { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, createdAt: new Date() };

    // 같은 기기로 다른 계정에 로그인했던 경우, 이전 계정 알림이 오지 않도록 먼저 모두에게서 뺀다.
    await User.updateMany({ "pushSubscriptions.endpoint": sub.endpoint }, { $pull: { pushSubscriptions: { endpoint: sub.endpoint } } });
    await User.updateOne(
      { _id: req.user.id },
      { $push: { pushSubscriptions: { $each: [entry], $slice: -MAX_DEVICES } } }
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
});

// DELETE /api/push/subscribe — 이 기기 구독 해제 { endpoint } (로그아웃·토글 끔)
router.delete("/subscribe", auth, async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;
    if (typeof endpoint !== "string") return res.status(400).json({ message: "endpoint가 필요합니다." });
    await User.updateOne({ _id: req.user.id }, { $pull: { pushSubscriptions: { endpoint } } });
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
});

// POST /api/push/test — 내 기기들로 테스트 알림 보내기
router.post("/test", auth, async (req, res) => {
  try {
    if (!push.enabled) return res.status(404).json({ message: "푸시 알림이 설정되지 않은 서버입니다." });
    const sent = await push.sendToUser(req.user.id, { body: "푸시 알림이 잘 도착했어요 🎉", tag: "test" });
    res.json({ sent });
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;
