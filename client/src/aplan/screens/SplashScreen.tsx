import appIcon from "@/assets/big-roading-icon.png";
import "@/styles/aplan-tokens.css";

// A-01 스플래시 (Figma 2:7). 폰 목업 테두리(radius 28, #D9D9D9)는 제외했다.
// 글자 줄 높이는 Figma 텍스트 상자 높이(36/16px)에 맞췄다 (브라우저의 normal은 Noto Sans KR에서 더 크다).
// 로고 자리의 흰 박스(84×84, radius 24)에 실제 앱 아이콘을 넣었다.
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
        {/* data-node-id 2:4 로고 */}
        <div
          className="size-[84px] shrink-0 overflow-hidden"
          style={{ background: "var(--a-color-bg)", borderRadius: "var(--a-radius-logo)" }}
        >
          <img src={appIcon} alt="" className="size-full object-contain" />
        </div>
        {/* data-node-id 2:5 앱 이름 (Figma "Datalk" → "Big Ding") */}
        <h1 className="m-0 whitespace-nowrap text-[30px] font-bold leading-[36px]" style={{ color: "var(--a-color-on-inverse)" }}>
          Big Ding
        </h1>
        {/* data-node-id 2:6 슬로건 */}
        <p className="m-0 whitespace-nowrap text-[13px] font-normal leading-[16px]" style={{ color: "var(--a-color-text-secondary)" }}>
          빅데이터 학생들의 연결 공간
        </p>
      </main>
    </div>
  );
}
