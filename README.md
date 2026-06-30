# 빅데이터학과 커뮤니티 앱

## 기술 스택
| 구분 | 기술 | 용도 |
|------|------|------|
| 프론트 | React + TypeScript + Vite | UI |
| 서버 | Node.js + Express | API 서버 |
| DB | MongoDB + Mongoose | 데이터 저장 |
| 실시간 | Socket.io | 채팅, 실시간 댓글 |
| 이미지 | Firebase Storage | 사진 업로드 |
| 인증 | JWT | 로그인 상태 유지 |

## 폴더 구조
```
BigData_Community/
├── client/          ← React 프론트엔드
│   ├── src/
│   │   ├── app/         ← 화면 컴포넌트
│   │   ├── api/         ← axios API 설정
│   │   ├── hooks/       ← 커스텀 훅 (useSocket 등)
│   │   ├── types/       ← TypeScript 타입 정의
│   │   └── utils/       ← 유틸 함수, Firebase 설정
│   └── package.json
│
└── server/          ← Node.js 백엔드
    ├── models/      ← MongoDB 스키마
    ├── routes/      ← API 라우터
    ├── middleware/  ← JWT 인증, 욕설 필터
    ├── socket/      ← Socket.io 채팅
    ├── config/      ← DB 연결
    └── index.js     ← 서버 진입점
```

## 시작하기

### 1. 클라이언트
```bash
cd client
npm install
cp .env.example .env   # 환경변수 설정
npm run dev
```

### 2. 서버
```bash
cd server
npm install
cp .env.example .env   # 환경변수 설정 (MongoDB URI, JWT_SECRET 등)
npm run dev
```

## 환경변수 설정
- `client/.env` : Firebase 설정, API URL
- `server/.env` : MongoDB URI, JWT Secret
