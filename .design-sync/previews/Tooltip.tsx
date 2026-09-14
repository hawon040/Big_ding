import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  buttonVariants,
} from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 24,
  borderRadius: 8,
  minHeight: 200,
};

export function Default() {
  return (
    <div style={{ ...stage, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 80 }}>
      <Tooltip open>
        <TooltipTrigger className={buttonVariants({ variant: "outline" })}>
          저장
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8}>
          임시 저장됩니다
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
