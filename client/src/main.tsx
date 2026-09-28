  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  const root = createRoot(document.getElementById("root")!);
  const previewMatch = import.meta.env.DEV ? /^\/__aplan\/([\w-]+)/.exec(window.location.pathname) : null;

  if (previewMatch) {
    // 개발 전용 A안 화면 미리보기 (Figma 비교 스크린샷용)
    import("./dev/AplanPreview.tsx").then(({ default: AplanPreview }) => {
      root.render(<AplanPreview name={previewMatch[1]} />);
    });
  } else {
    root.render(<App />);
  }
