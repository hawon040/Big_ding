import bigdingLogo from "@/assets/bigding-logo.png";
import "@/styles/aplan-tokens.css";

// A-01 스플래시 (Figma 2:7, node 181:35 로고 워드마크). 폰 목업 테두리(radius 28, #D9D9D9)는 제외했다.
// 로고는 Figma에서 내려받은 "BIGDING" 워드마크 PNG(배경 #212121)를 그대로 쓴다.
//
// 주의: 배경·슬로건 색은 var(--a-color-surface-inverse) 등 테마 변수를 쓰지 않는다.
// 그 변수는 다크모드(data-theme="dark")에서 #212121 ↔ #f2f2f2로 뒤집히도록 설계돼 있는데,
// 로고 PNG는 흰 픽셀로 고정돼 있어 다크모드에서 배경이 밝아지면 흰 배경 위에 흰 로고가 겹쳐
// 안 보이게 된다. Figma 스플래시는 테마와 무관하게 항상 어두운 배경 하나뿐이라 고정 hex로 둔다.
const SPLASH_BG = "#212121";
const SPLASH_SLOGAN_COLOR = "#999999";

export function SplashScreen() {
  return (
    // 넓은 화면에서도 배경이 끊기지 않도록 바깥은 화면 전체를 같은 색으로 채운다.
    <div className="min-h-dvh" style={{ background: SPLASH_BG }}>
      {/* data-node-id 2:8 Body */}
      <main
        className="a-screen flex flex-col items-center justify-center gap-[16px] px-[20px] py-[12px]"
        style={{ background: SPLASH_BG }}
        aria-label="Big Ding 시작 화면"
      >
        {/* data-node-id 181:35 로고 워드마크 */}
        <img src={bigdingLogo} alt="Big Ding" className="h-auto w-[230px] max-w-full" />
        {/* data-node-id 2:6 슬로건 */}
        <p className="m-0 whitespace-nowrap text-[13px] font-normal leading-[16px]" style={{ color: SPLASH_SLOGAN_COLOR }}>
          빅데이터 학생들의 연결 공간
        </p>
      </main>
    </div>
  );
}
