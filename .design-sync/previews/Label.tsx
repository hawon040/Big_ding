import { Label, Input, Checkbox } from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 24,
  borderRadius: 8,
  display: "flex",
  flexDirection: "column" as const,
  gap: 16,
  width: 320,
};

const field = { display: "flex", flexDirection: "column" as const, gap: 6 };

export function WithInput() {
  return (
    <div style={stage}>
      <div style={field}>
        <Label htmlFor="nickname">닉네임</Label>
        <Input id="nickname" placeholder="닉네임을 입력하세요" />
      </div>
    </div>
  );
}

export function WithCheckbox() {
  return (
    <div style={stage}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Checkbox id="agree" />
        <Label htmlFor="agree">개인정보 수집에 동의합니다</Label>
      </div>
    </div>
  );
}
