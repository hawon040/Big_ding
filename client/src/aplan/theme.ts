const THEME_KEY = "aplan-theme";

// 다크 모드 켜기/끄기. <html data-theme>을 바꾸고, 새로고침 때 깜빡임이 없도록 기기에도 저장해 둔다.
export function applyTheme(dark: boolean) {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  try {
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  } catch {
    /* 저장 실패는 무시 */
  }
}

// 앱 시작 시 기기에 저장된 테마를 먼저 적용한다.
export function applySavedTheme() {
  let dark = false;
  try {
    dark = localStorage.getItem(THEME_KEY) === "dark";
  } catch {
    /* 읽기 실패는 라이트로 */
  }
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}