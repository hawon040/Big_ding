import { Badge } from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 24,
  borderRadius: 8,
  display: "flex",
  gap: 10,
  flexWrap: "wrap" as const,
  alignItems: "center",
};

export function Variants() {
  return (
    <div style={stage}>
      <Badge>전공필수</Badge>
      <Badge variant="secondary">교양</Badge>
      <Badge variant="destructive">마감임박</Badge>
      <Badge variant="outline">모집중</Badge>
    </div>
  );
}
