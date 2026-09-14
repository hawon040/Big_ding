import { Progress } from "bigdata-community-client";

export function Values() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: 320,
        background: "var(--background)",
        color: "var(--foreground)",
        padding: 24,
        borderRadius: 8,
      }}
    >
      <Progress value={13} />
      <Progress value={50} />
      <Progress value={80} />
      <Progress value={100} />
    </div>
  );
}
