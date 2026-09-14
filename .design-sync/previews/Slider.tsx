import { Slider } from "bigdata-community-client";

const stage = { background: "var(--background)", color: "var(--foreground)", padding: 24, borderRadius: 8 };

export function Default() {
  return (
    <div style={{ ...stage, width: 320 }}>
      <div style={{ fontSize: 12, marginBottom: 8, color: "var(--muted-foreground)" }}>
        최소 평점 필터
      </div>
      <Slider defaultValue={[40]} min={0} max={100} step={1} />
    </div>
  );
}

export function Range() {
  return (
    <div style={{ ...stage, width: 320 }}>
      <div style={{ fontSize: 12, marginBottom: 8, color: "var(--muted-foreground)" }}>
        학점 범위 (2.0 ~ 4.5)
      </div>
      <Slider defaultValue={[20, 70]} min={0} max={100} step={5} />
    </div>
  );
}
