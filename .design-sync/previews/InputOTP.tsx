import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 24,
  borderRadius: 8,
  display: "flex" as const,
  flexDirection: "column" as const,
  gap: 12,
};

export function Default() {
  return (
    <div style={stage}>
      <InputOTP maxLength={6} defaultValue="482913">
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}
