const { setupDb, createUser, api } = require("./helpers");
const GroupChat = require("../models/GroupChat");
const GroupMessage = require("../models/GroupMessage");

// 실제 Cloudinary로 올리지 않도록 막는다.
jest.mock("../config/cloudinary", () => ({
  uploadImage: jest.fn(async (buffer, folder) => ({ secure_url: `https://img.test/${folder}/${buffer.length}.jpg` })),
}));

setupDb();

const png = Buffer.from("89504e470d0a1a0a", "hex");

describe("단체채팅 설정 변경 안내 메시지", () => {
  test("이름·사진을 바꾸면 시스템 메시지가 남고, 같은 이름으로 저장하면 남지 않는다", async () => {
    const a = await createUser({ nickname: "방장" });
    const b = await createUser();
    const c = await createUser();
    const room = await GroupChat.create({ host: a.id, members: [a.id, b.id, c.id] });
    const systemTexts = async () =>
      (await GroupMessage.find({ groupChat: room._id, type: "system" }).sort({ _id: 1 })).map((m) => m.content);

    expect((await api(a.token).patch(`/api/group-chats/${room._id}/name`).send({ name: "스터디방" })).status).toBe(200);
    expect(await systemTexts()).toEqual(["방장님이 채팅방 이름을 '스터디방'(으)로 변경했습니다"]);

    await api(a.token).patch(`/api/group-chats/${room._id}/name`).send({ name: "스터디방" });
    expect(await systemTexts()).toHaveLength(1);

    const avatar = await api(a.token).patch(`/api/group-chats/${room._id}/avatar`)
      .attach("image", png, { filename: "a.png", contentType: "image/png" });
    expect(avatar.status).toBe(200);
    expect(await systemTexts()).toEqual([
      "방장님이 채팅방 이름을 '스터디방'(으)로 변경했습니다",
      "방장님이 채팅방 사진을 변경했습니다",
    ]);
  });
});
