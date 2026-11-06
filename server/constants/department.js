// 앱 가입자는 모두 AI 빅데이터 학과 소속이다. 학과는 사용자가 바꿀 수 없고, 화면에도 항상 이 값으로 내려준다.
const DEPARTMENT = "AI 빅데이터 학과";

// 탈퇴한 사용자는 학과를 비워서 보여준다.
const departmentOf = (u) => (u && !u.isWithdrawn ? DEPARTMENT : null);

module.exports = { DEPARTMENT, departmentOf };
