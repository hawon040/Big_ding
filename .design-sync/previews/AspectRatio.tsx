import { AspectRatio } from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 24,
  borderRadius: 8,
  width: 360,
};

const placeholder = {
  width: "100%",
  height: "100%",
  background: "var(--muted, #1c2540)",
  color: "var(--muted-foreground, #9fb0d0)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  borderRadius: 6,
};

export function Widescreen() {
  return (
    <div style={stage}>
      <AspectRatio ratio={16 / 9}>
        <div style={placeholder}>강의실 사진 16:9</div>
      </AspectRatio>
    </div>
  );
}

export function Square() {
  return (
    <div style={{ ...stage, width: 220 }}>
      <AspectRatio ratio={1}>
        <div style={placeholder}>프로필 배경 1:1</div>
      </AspectRatio>
    </div>
  );
}
