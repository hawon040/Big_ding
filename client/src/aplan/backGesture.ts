// 아이폰 기본 "화면 왼쪽 가장자리에서 오른쪽으로 쓸어넘기면 이전 화면" 제스처를 웹에서 흉내낸다.
// 이 앱은 react-router 같은 전역 네비게이션 스택이 없고, 각 화면이 자기 onBack 콜백을 prop으로
// 따로 받는 구조라서, 화면이 열려 있는 동안 자기 onBack을 이 모듈의 스택에 등록해두고
// (useSwipeBack 훅), 실제 터치 제스처 인식은 여기 전역 리스너 하나가 도맡아 "지금 가장 위에
// 열려 있는 화면"의 onBack을 호출해주는 방식.
const backStack: Array<() => void> = [];

export function pushBackHandler(handler: () => void) {
  backStack.push(handler);
}

export function popBackHandler(handler: () => void) {
  const i = backStack.lastIndexOf(handler);
  if (i !== -1) backStack.splice(i, 1);
}

// 왼쪽 가장자리 몇 px 안에서 시작한 터치만 "뒤로가기 제스처 후보"로 본다 (iOS 엣지 제스처와 비슷한 폭).
const EDGE_ZONE_PX = 24;
// 가로로 이 정도는 밀어야 "의도한 스와이프"로 인정 (그냥 탭하거나 살짝 끈 건 무시).
const SWIPE_THRESHOLD_PX = 70;

let startX = 0;
let startY = 0;
let tracking = false;

function onTouchStart(e: TouchEvent) {
  const t = e.touches[0];
  if (!t || backStack.length === 0 || t.clientX > EDGE_ZONE_PX) {
    tracking = false;
    return;
  }
  startX = t.clientX;
  startY = t.clientY;
  tracking = true;
}

function onTouchEnd(e: TouchEvent) {
  if (!tracking) return;
  tracking = false;
  const t = e.changedTouches[0];
  if (!t) return;
  const dx = t.clientX - startX;
  const dy = Math.abs(t.clientY - startY);
  // 오른쪽으로 충분히, 그리고 세로보다는 가로로 밀렸을 때만 뒤로가기로 인정한다
  // (손가락이 살짝 비스듬해도 되게 dy < dx * 0.6 정도는 허용).
  if (dx > SWIPE_THRESHOLD_PX && dy < dx * 0.6) {
    const top = backStack[backStack.length - 1];
    top?.();
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
}
