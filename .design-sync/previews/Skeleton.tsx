import { Skeleton } from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 24,
  borderRadius: 8,
  width: 340,
};

export function PostCardLoading() {
  return (
    <div style={stage}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <Skeleton style={{ width: 40, height: 40, borderRadius: "9999px" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Skeleton style={{ width: 120, height: 12 }} />
          <Skeleton style={{ width: 80, height: 10 }} />
        </div>
      </div>
      <Skeleton style={{ width: "100%", height: 12, marginBottom: 8 }} />
      <Skeleton style={{ width: "90%", height: 12, marginBottom: 8 }} />
      <Skeleton style={{ width: "60%", height: 12 }} />
    </div>
  );
}
