import { useEffect } from "react";
import { popBackHandler, pushBackHandler } from "@/aplan/backGesture";

// 화면이 열려 있는 동안만 "왼쪽 가장자리 스와이프 → 뒤로가기" 제스처를 이 화면의 onBack에 연결한다.
// 화면이 닫히면(언마운트) 자동으로 해제되니 따로 정리할 게 없다.
export function useSwipeBack(onBack: (() => void) | undefined | null) {
  useEffect(() => {
    if (!onBack) return;
    pushBackHandler(onBack);
    return () => popBackHandler(onBack);
  }, [onBack]);
}
