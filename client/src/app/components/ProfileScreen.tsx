import { useState } from "react";
import { Camera, ChevronRight, Heart, FileText, Edit3, MessageCircle, Bookmark, Lock, Users, Globe, X } from "lucide-react";

const SCRAPPED = [
  { id: 1, title: "AI빅데이터 분석 공모전 팀원 모집", board: "공모전/자격증", emoji: "🏆" },
  { id: 2, title: "데이터마이닝 강의 추천합니다", board: "강의평가", emoji: "⭐" },
  { id: 3, title: "학교 도서관 이용 시간 문의", board: "선후배 Q&A", emoji: "🙋" },
];

const MY_POSTS = [
  { id: 1, title: "AI빅데이터 프로젝트 발표 끝!", board: "자유게시판", time: "2일 전", likes: 24, comments: 8, visibility: "all" as const },
  { id: 2, title: "자취방 구하는 팁 공유합니다", board: "자유게시판", time: "1주 전", likes: 45, comments: 15, visibility: "friends" as const },
];

const MY_COMMENTS = [
  { id: 1, postTitle: "ADsP 자격증 체감 난이도 후기", content: "저도 다음달에 시험 보는데 도움이 많이 됐어요!", time: "1일 전" },
  { id: 2, postTitle: "학교 카페테리아 신메뉴 후기", content: "저도 어제 먹어봤는데 맛있더라구요", time: "3일 전" },
];

const LIKED_POSTS = [
  { id: 1, title: "여름철 데이터 분석 꿀팁", board: "자유게시판", time: "1시간 전", likes: 89 },
  { id: 2, title: "공모전 팀원 모집", board: "공모전/자격증", time: "2시간 전", likes: 34 },
];

export function ProfileScreen() {
  const [activeTab, setActiveTab] = useState<"posts" | "comments" | "likes" | "scrapped">("posts");
  const [editMode, setEditMode] = useState(false);
  const [nickname, setNickname] = useState("27학번 샌애기");
  const [showVisibilityModal, setShowVisibilityModal] = useState<number | null>(null);

  return (
    <div className="flex flex-col flex-1 overflow-y-auto">
      {/* Profile header */}
      <div
        className="relative px-4 pt-8 pb-6"
        style={{ background: "linear-gradient(160deg, #111a30 0%, #0a0f1f 100%)" }}
      >
        <div className="flex items-start gap-4">
          <div className="relative">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-md"
              style={{ background: "var(--accent)", border: "3px solid var(--primary)" }}
            >
              🐕
            </div>
            <button
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center shadow"
              style={{ background: "var(--primary)" }}
            >
              <Camera size={13} color="white" />
            </button>
          </div>

          <div className="flex-1 pt-1">
            {editMode ? (
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="font-bold text-lg border-b-2 outline-none bg-transparent w-full"
                style={{ color: "var(--foreground)", borderColor: "var(--primary)" }}
              />
            ) : (
              <h2 className="font-bold text-lg" style={{ color: "var(--foreground)" }}>{nickname}</h2>
            )}
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>AI빅데이터전공 27학번</p>
            <div className="flex gap-3 mt-2">
              <div className="text-center">
                <p className="font-bold text-sm" style={{ color: "var(--foreground)" }}>{MY_POSTS.length}</p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>게시글</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-sm" style={{ color: "var(--foreground)" }}>{MY_COMMENTS.length}</p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>댓글</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-sm" style={{ color: "var(--foreground)" }}>{LIKED_POSTS.length}</p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>좋아요</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setEditMode(!editMode)}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "var(--card)" }}
          >
            <Edit3 size={16} style={{ color: "var(--primary)" }} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 px-4 gap-2 mb-3 mt-3">
        <button
          onClick={() => setActiveTab("posts")}
          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: activeTab === "posts" ? "var(--primary)" : "var(--muted)",
            color: activeTab === "posts" ? "white" : "var(--muted-foreground)",
          }}
        >
          <FileText size={14} />
          <span>내 글</span>
        </button>
        <button
          onClick={() => setActiveTab("comments")}
          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: activeTab === "comments" ? "var(--primary)" : "var(--muted)",
            color: activeTab === "comments" ? "white" : "var(--muted-foreground)",
          }}
        >
          <MessageCircle size={14} />
          <span>댓글</span>
        </button>
        <button
          onClick={() => setActiveTab("likes")}
          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: activeTab === "likes" ? "var(--primary)" : "var(--muted)",
            color: activeTab === "likes" ? "white" : "var(--muted-foreground)",
          }}
        >
          <Heart size={14} />
          <span>좋아요</span>
        </button>
        <button
          onClick={() => setActiveTab("scrapped")}
          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: activeTab === "scrapped" ? "var(--primary)" : "var(--muted)",
            color: activeTab === "scrapped" ? "white" : "var(--muted-foreground)",
          }}
        >
          <Bookmark size={14} />
          <span>스크랩</span>
        </button>
      </div>

      {/* Tab content */}
      <div className="px-4 pb-6 flex flex-col gap-3">
        {activeTab === "posts" && MY_POSTS.map((post) => (
          <div key={post.id} className="p-3.5 rounded-2xl shadow-sm" style={{ background: "var(--card)" }}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: "var(--secondary)", color: "var(--primary)" }}
                >
                  {post.board}
                </span>
                <p className="font-semibold text-sm mt-1.5" style={{ color: "var(--foreground)" }}>{post.title}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{post.time}</p>
              </div>
              <button onClick={() => setShowVisibilityModal(post.id)}>
                {post.visibility === "all" ? (
                  <Globe size={16} style={{ color: "var(--muted-foreground)" }} />
                ) : post.visibility === "friends" ? (
                  <Users size={16} style={{ color: "var(--muted-foreground)" }} />
                ) : (
                  <Lock size={16} style={{ color: "var(--muted-foreground)" }} />
                )}
              </button>
            </div>
            <div className="flex items-center gap-3 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-1">
                <Heart size={13} fill="var(--primary)" color="var(--primary)" />
                <span className="text-xs" style={{ color: "var(--primary)" }}>{post.likes}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageCircle size={13} style={{ color: "var(--muted-foreground)" }} />
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{post.comments}</span>
              </div>
            </div>
          </div>
        ))}

        {activeTab === "comments" && MY_COMMENTS.map((comment) => (
          <div key={comment.id} className="p-3.5 rounded-2xl shadow-sm" style={{ background: "var(--card)" }}>
            <div className="flex items-start justify-between mb-1">
              <p className="text-xs font-semibold" style={{ color: "var(--primary)" }}>
                {comment.postTitle}
              </p>
              <button onClick={() => confirm("댓글을 삭제하시겠습니까?")}>
                <X size={14} style={{ color: "#d4183d" }} />
              </button>
            </div>
            <p className="text-sm" style={{ color: "var(--foreground)" }}>{comment.content}</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{comment.time}</p>
          </div>
        ))}

        {activeTab === "likes" && LIKED_POSTS.map((post) => (
          <div key={post.id} className="p-3.5 rounded-2xl shadow-sm" style={{ background: "var(--card)" }}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: "var(--secondary)", color: "var(--primary)" }}
                >
                  {post.board}
                </span>
                <p className="font-semibold text-sm mt-1.5" style={{ color: "var(--foreground)" }}>{post.title}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{post.time}</p>
              </div>
              <button onClick={() => confirm("좋아요를 취소하시겠습니까?")}>
                <Heart size={18} fill="var(--primary)" color="var(--primary)" />
              </button>
            </div>
          </div>
        ))}

        {activeTab === "scrapped" && SCRAPPED.map((item) => (
          <div key={item.id} className="p-3.5 rounded-2xl shadow-sm" style={{ background: "var(--card)" }}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{item.emoji}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: "var(--secondary)", color: "var(--primary)" }}
                  >
                    {item.board}
                  </span>
                </div>
                <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{item.title}</p>
              </div>
              <button onClick={() => confirm("스크랩을 취소하시겠습니까?")}>
                <Bookmark size={18} fill="var(--primary)" color="var(--primary)" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Visibility modal */}
      {showVisibilityModal && (
        <div className="absolute inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div
            className="w-full rounded-t-3xl px-4 py-6 flex flex-col gap-3"
            style={{ background: "var(--background)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>공개 범위 설정</h3>
              <button onClick={() => setShowVisibilityModal(null)}>
                <X size={20} style={{ color: "var(--foreground)" }} />
              </button>
            </div>
            {[
              { id: "all", label: "전체 공개", icon: <Globe size={18} /> },
              { id: "friends", label: "친구만 공개", icon: <Users size={18} /> },
              { id: "private", label: "나만 보기", icon: <Lock size={18} /> },
            ].map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => {
                  alert(`공개 범위가 '${label}'로 변경되었습니다.`);
                  setShowVisibilityModal(null);
                }}
                className="w-full px-4 py-3 rounded-xl flex items-center gap-3 text-left text-sm"
                style={{ background: "var(--card)", color: "var(--foreground)" }}
              >
                <span style={{ color: "var(--primary)" }}>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
