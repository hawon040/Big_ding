// 욕설 필터
const PROFANITY_LIST = ["욕설", "비속어", "씨발", "개새끼", "병신", "지랄", "꺼져", "죽어"];

export const filterProfanity = (text: string): string => {
  let filtered = text;
  PROFANITY_LIST.forEach((word) => {
    const regex = new RegExp(word, "gi");
    filtered = filtered.replace(regex, "*".repeat(word.length));
  });
  return filtered;
};

// 날짜 포맷
export const formatTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;
  return date.toLocaleDateString("ko-KR");
};

// JWT 디코드 (간단 버전)
export const getTokenPayload = (token: string) => {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
};
