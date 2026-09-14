import { RadioGroup, RadioGroupItem, Label } from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 24,
  borderRadius: 8,
};

export function Default() {
  return (
    <div style={stage}>
      <RadioGroup defaultValue="all" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <RadioGroupItem value="all" id="grade-all" />
          <Label htmlFor="grade-all">전체 학년</Label>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <RadioGroupItem value="1" id="grade-1" />
          <Label htmlFor="grade-1">1학년</Label>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <RadioGroupItem value="2" id="grade-2" />
          <Label htmlFor="grade-2">2학년</Label>
        </div>
      </RadioGroup>
    </div>
  );
}
