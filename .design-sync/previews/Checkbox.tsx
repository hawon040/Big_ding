import { Checkbox, Label } from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 24,
  borderRadius: 8,
  display: "flex",
  flexDirection: "column" as const,
  gap: 12,
};

const row = { display: "flex", alignItems: "center", gap: 8 };

export function States() {
  return (
    <div style={stage}>
      <div style={row}>
        <Checkbox id="cb-unchecked" />
        <Label htmlFor="cb-unchecked">이용약관에 동의합니다</Label>
      </div>
      <div style={row}>
        <Checkbox id="cb-checked" defaultChecked />
        <Label htmlFor="cb-checked">알림 수신에 동의합니다</Label>
      </div>
      <div style={row}>
        <Checkbox id="cb-disabled" disabled />
        <Label htmlFor="cb-disabled">선택할 수 없음</Label>
      </div>
    </div>
  );
}
