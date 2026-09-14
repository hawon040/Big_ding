import * as React from "react";
import { Calendar } from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 24,
  borderRadius: 8,
  display: "flex" as const,
  width: "fit-content",
};

export function Default() {
  const [selected, setSelected] = React.useState<Date | undefined>(
    new Date(2026, 8, 14),
  );
  return (
    <div style={stage}>
      <Calendar mode="single" selected={selected} onSelect={setSelected} />
    </div>
  );
}
