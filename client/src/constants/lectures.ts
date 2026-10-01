// 전공 강의평가 글쓰기용 교과군·강의·교수 목록. 교수 목록은 server/models/User.js의 professor enum과 같게 유지할 것.
export const LECTURE_GROUPS: Record<string, string[]> = {
  "기초교과군": ["C언어프로그래밍", "파이썬 프로그래밍"],
  "심화교과군": ["데이터베이스이론 및 실습", "컴퓨터네트워크", "인공지능"],
  "응용교과군": ["데이터시각화", "스마트폰프로그래밍", "Open CV프로그래밍", "캡스톤디자인", "클라우드응용시스템", "딥러닝 프로젝트"],
  "핵심교과군": ["자료구조론", "유닉스 프로그래밍", "JAVA프로그래밍", "C++프로그래밍", "데이터베이스이론 및 실습", "파이썬응용", "빅데이터와AI"],
};
export const LECTURE_GRADES = Object.keys(LECTURE_GROUPS);
export const PROFESSORS = ["유진호", "차대현", "홍진근"];
export const LECTURE_MIN_CONTENT = 20;
