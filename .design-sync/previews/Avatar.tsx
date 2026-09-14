import { Avatar, AvatarImage, AvatarFallback } from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 24,
  borderRadius: 8,
  display: "flex",
  gap: 16,
  alignItems: "center",
};

export function Fallbacks() {
  return (
    <div style={stage}>
      <Avatar>
        <AvatarFallback>김민</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>이수</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>박</AvatarFallback>
      </Avatar>
    </div>
  );
}

export function BrokenImageFallsBack() {
  return (
    <div style={stage}>
      <Avatar>
        <AvatarImage src="https://example.invalid/avatar.png" alt="정하늘" />
        <AvatarFallback>정하</AvatarFallback>
      </Avatar>
    </div>
  );
}
