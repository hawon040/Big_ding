import { Button } from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 24,
  borderRadius: 8,
};

export function Variants() {
  return (
    <div style={{ ...stage, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
      <Button variant="default">Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ ...stage, display: "flex", alignItems: "center", gap: 12 }}>
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ ...stage, display: "flex", gap: 12 }}>
      <Button disabled>Disabled</Button>
      <Button variant="destructive" disabled>
        Disabled destructive
      </Button>
      <Button variant="outline" disabled>
        Disabled outline
      </Button>
    </div>
  );
}
