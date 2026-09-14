import { Toggle } from "bigdata-community-client";

const stage = { background: "var(--background)", color: "var(--foreground)", padding: 24, borderRadius: 8 };

export function Pressed() {
  return (
    <div style={{ ...stage, display: "flex", gap: 12 }}>
      <Toggle defaultPressed>스크랩됨</Toggle>
      <Toggle>스크랩</Toggle>
    </div>
  );
}

export function OutlineSizes() {
  return (
    <div style={{ ...stage, display: "flex", alignItems: "center", gap: 12 }}>
      <Toggle variant="outline" size="sm">
        Sm
      </Toggle>
      <Toggle variant="outline" size="default">
        Default
      </Toggle>
      <Toggle variant="outline" size="lg">
        Lg
      </Toggle>
    </div>
  );
}
