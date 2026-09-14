import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 24,
  borderRadius: 8,
  minHeight: 320,
};

export function Open() {
  return (
    <div style={stage}>
      <Select defaultOpen defaultValue="2">
        <SelectTrigger style={{ width: 200 }}>
          <SelectValue placeholder="학년 선택" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">1학년</SelectItem>
          <SelectItem value="2">2학년</SelectItem>
          <SelectItem value="3">3학년</SelectItem>
          <SelectItem value="4">4학년</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
