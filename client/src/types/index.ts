// 사용자
export interface User {
  _id: string;
  studentId: string;       // 학번
  professorCode: string;   // 교수님 고유번호
  nickname: string;
  avatar?: string;
  department: string;      // 학과
  year: number;            // 학년
  classGroup: string;      // 교수님 반
  createdAt: string;
  isFirstLogin: boolean;
}

// 게시물
export type BoardType = "free" | "qna" | "contest" | "event" | "lecture" | "meeting";

export interface Post {
  _id: string;
  author: User;
  board: BoardType;
  title: string;
  content: string;
  images: string[];        // Firebase Storage URLs
  tags: string[];
  likes: string[];         // user IDs
  dislikes: string[];
  comments: Comment[];
  rating?: number;         // 강의평가용
  maxParticipants?: number;
  currentParticipants?: number;
  price?: number;
  isBlocked: boolean;
  createdAt: string;
}

// 댓글
export interface Comment {
  _id: string;
  author: User;
  content: string;
  createdAt: string;
}

// 채팅 메시지
export interface ChatMessage {
  _id: string;
  from: User;
  to: User;
  content: string;
  createdAt: string;
  read: boolean;
}

// 친구
export interface Friend {
  _id: string;
  nickname: string;
  avatar?: string;
  online: boolean;
}

// 신고
export interface Report {
  _id: string;
  reporter: string;
  target: string;
  targetType: "post" | "comment" | "user";
  reason: string;
  status: "pending" | "resolved";
  createdAt: string;
}
