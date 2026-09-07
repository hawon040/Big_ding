// 사용자 입력을 MongoDB $regex에 그대로 꽂으면 정규식 메타문자(., *, +, ( 등)가 그대로
// 해석되어 의도치 않은 매칭이 되거나, 악의적으로 patological한 패턴을 넣어 서버의
// 정규식 매칭을 오래 걸리게 만드는 ReDoS 공격이 가능해진다. 검색어를 리터럴 문자열로만
// 다루도록 특수문자를 이스케이프한다.
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports = { escapeRegex };
