import bigdingLogo from "@/assets/bigding-logo.png";
import "@/styles/aplan-tokens.css";

// A-01 스플래시 (Figma 2:7, node 181:35 로고 워드마크). 폰 목업 테두리(radius 28, #D9D9D9)는 제외했다.
// 로고는 Figma에서 내려받은 "BIGDING" 워드마크 PNG(배경 #212121, 스플래시 배경과 동일)를 그대로 쓴다.
export function SplashScreen() {
  return (
    // 넓은 화면에서도 배경이 끊기지 않도록 바깥은 화면 전체를 같은 색으로 채운다.
    <div className="min-h-dvh" style={{ background: "var(--a-color-surface-inverse)" }}>
      {/* data-node-id 2:8 Body */}
      <main
        className="a-screen flex flex-col items-center justify-center gap-[16px] px-[20px] py-[12px]"
        style={{ background: "var(--a-color-surface-inverse)" }}
        aria-label="Big Ding 시작 화면"
      >
        {/* data-node-id 181:35 로고 워드마크 */}
        <img src={bigdingLogo} alt="Big Ding" className="h-auto w-[230px] max-w-full" />
        {/* data-node-id 2:6 슬로건 */}
        <p className="m-0 whitespace-nowrap text-[13px] font-normal leading-[16px]" style={{ color: "var(--a-color-text-secondary)" }}>
          빅데이터 학생들의 연결 공간
        </p>
      </main>
    </div>
  );
}
