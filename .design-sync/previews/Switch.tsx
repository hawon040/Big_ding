import { Switch } from "bigdata-community-client";

const stage = { background: "var(--background)", color: "var(--foreground)", padding: 24, borderRadius: 8 };
const row = { display: "flex", alignItems: "center", gap: 10, fontSize: 14 };

export function States() {
  return (
    <div style={{ ...stage, display: "flex", flexDirection: "column", gap: 14, width: 260 }}>
      <div style={row}>
        <Switch defaultChecked id="s1" />
        <span>새 댓글 알림 받기</span>
      </div>
      <div style={row}>
        <Switch id="s2" />
        <span>이메일 알림 받기</span>
      </div>
      <div style={row}>
        <Switch disabled id="s3" />
        <span style={{ opacity: 0.6 }}>SNS 연동 (준비 중)</span>
      </div>
    </div>
  );
}
