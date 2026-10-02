// /api/users/me — 내 정보·온보딩·프로필·설정·차단 목록
const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const auth = require("../../middleware/authMiddleware");
const upload = require("../../middleware/upload");
const { uploadImage } = require("../../config/cloudinary");
const v = require("../../utils/validate");
const { liveCounts } = require("../../services/profileCounts");

const ME_FIELDS = [
  "studentId", "nickname", "avatar", "department", "grade", "bio", "interests", "onboardingCompleted",
  "notificationSettings", "appSettings", "isPrivate", "isAdmin", "canPostEvents",
  "postCount", "commentCount", "scrapCount", "followerCount", "followingCount", "createdAt",
].join(" ");

const toMe = (u, live) => ({
  id: String(u._id),
  studentId: u.studentId,
  nickname: u.nickname,
  profileImage: u.avatar || null,
  department: u.department || null,
  grade: u.grade || null,
  bio: u.bio || null,
  interests: u.interests || [],
  onboardingCompleted: !!u.onboardingCompleted,
  notificationSettings: {
    comment: u.notificationSettings?.comment !== false,
    studyRecruit: u.notificationSettings?.studyRecruit !== false,
    marketing: u.notificationSettings?.marketing === true,
  },
  appSettings: { darkMode: u.appSettings?.darkMode === true },
  isPrivate: !!u.isPrivate,
  isAdmin: !!u.isAdmin,
  canPostEvents: !!u.canPostEvents,
  counts: {
    posts: live.posts,
    feeds: live.feeds,
    comments: u.commentCount || 0,
    scraps: u.scrapCount || 0,
    followers: live.followers,
    following: live.following,
  },
  createdAt: u.createdAt,
});

const sendMe = async (res, userId) => {
  const me = await User.findById(userId).select(ME_FIELDS).lean();
  if (!me) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
  return res.json(toMe(me, await liveCounts(userId)));
};

// GET /api/users/me — 내 정보 + 활동 수 + 설정
router.get("/me", auth, async (req, res) => {
  try {
    await sendMe(res, req.user.id);
  } catch (err) {
    v.handleError(res, err);
  }
});

// PUT /api/users/me/interests — { interests: [topicKey] } 3개 이상. 온보딩 완료 처리
router.put("/me/interests", auth, async (req, res) => {
  try {
    const interests = v.interests(req.body.interests);
    await User.updateOne({ _id: req.user.id }, { $set: { interests, onboardingCompleted: true } });
    await sendMe(res, req.user.id);
  } catch (err) {
    v.handleError(res, err);
  }
});

// PATCH /api/users/me — 프로필 수정. JSON 또는 multipart(avatar 파일)
// { nickname?, department?, grade?, bio? } — 빈 문자열/null이면 해당 값을 지운다(닉네임 제외)
router.patch("/me", auth, upload.single("avatar"), async (req, res) => {
  try {
    const set = {};
    const unset = {};
    const { nickname, department, grade, bio } = req.body;

    if (nickname !== undefined) {
      const next = v.requireString(nickname, "닉네임", { min: 2, max: 20 });
      if (await User.exists({ nickname: next, _id: { $ne: req.user.id } })) {
        return res.status(409).json({ message: "이미 사용 중인 닉네임입니다." });
      }
      set.nickname = next;
    }
    const optionalText = (value, key, name, max) => {
      if (value === undefined) return;
      if (value === null || value === "") {
        unset[key] = "";
        return;
      }
      set[key] = v.requireString(value, name, { max });
    };
    optionalText(department, "department", "학과", 50);
    optionalText(bio, "bio", "소개", 150);
    if (grade !== undefined) {
      if (grade === null || grade === "") {
        unset.grade = "";
      } else {
        const n = Number(grade);
        if (!Number.isInteger(n) || n < 1 || n > 4) v.fail("학년은 1~4 사이로 선택해주세요.");
        set.grade = n;
      }
    }
    if (req.file) set.avatar = (await uploadImage(req.file.buffer, "avatars")).secure_url;

    const update = {};
    if (Object.keys(set).length) update.$set = set;
    if (Object.keys(unset).length) update.$unset = unset;
    if (Object.keys(update).length) await User.updateOne({ _id: req.user.id }, update);
    await sendMe(res, req.user.id);
  } catch (err) {
    v.handleError(res, err);
  }
});

// PATCH /api/users/me/settings — { notificationSettings?: {comment, studyRecruit, marketing}, appSettings?: {darkMode} }
router.patch("/me/settings", auth, async (req, res) => {
  try {
    const set = {};
    const { notificationSettings = {}, appSettings = {} } = req.body;
    if (typeof notificationSettings !== "object" || typeof appSettings !== "object") v.fail("설정 형식이 올바르지 않습니다.");
    for (const key of ["comment", "studyRecruit", "marketing"]) {
      const value = v.optionalBoolean(notificationSettings[key], "알림 설정");
      if (value !== undefined) set[`notificationSettings.${key}`] = value;
    }
    const darkMode = v.optionalBoolean(appSettings.darkMode, "다크 모드");
    if (darkMode !== undefined) set["appSettings.darkMode"] = darkMode;
    if (!Object.keys(set).length) v.fail("변경할 설정이 없습니다.");
    await User.updateOne({ _id: req.user.id }, { $set: set });
    await sendMe(res, req.user.id);
  } catch (err) {
    v.handleError(res, err);
  }
});

// GET /api/users/me/blocks — 내가 차단한 사용자 목록
router.get("/me/blocks", auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id)
      .select("blockedUsers")
      .populate("blockedUsers", "nickname avatar department")
      .lean();
    const items = (me?.blockedUsers || []).map((u) => ({
      id: String(u._id),
      nickname: u.nickname,
      profileImage: u.avatar || null,
      department: u.department || null,
    }));
    res.json({ items, nextCursor: null });
  } catch (err) {
    v.handleError(res, err);
  }
});

module.exports = router;
