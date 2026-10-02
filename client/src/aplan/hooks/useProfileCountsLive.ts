import { useEffect, useRef } from "react";
import { useChatSocket } from "./useChatSocket";

// 프로필 숫자(피드글·게시글·팔로워·팔로잉) 실시간 반영.
// 서버가 팔로우·언팔로우·글 작성/삭제 때 관련된 사용자에게 profile_counts_changed를 보내면 onChange를 부르고,
// 소켓이 끊겨 있던 사이의 변화도 놓치지 않도록 앱으로 다시 돌아왔을 때(탭 전환·화면 켜짐)도 다시 불러온다.
export function useProfileCountsLive(onChange: () => void) {
  const ref = useRef(onChange);
  ref.current = onChange;

  useChatSocket({ profile_counts_changed: () => ref.current() });

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") ref.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
}
