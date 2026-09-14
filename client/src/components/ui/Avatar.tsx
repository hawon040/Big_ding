import * as React from "react";
import { cn } from "./utils";

export interface AvatarProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src?: string | null;
  fallbackSrc: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const SIZE_CLASS: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-14 w-14",
  xl: "h-20 w-20",
};

/** Rounded profile image with a required fallback (this app has no default-avatar CSS, only asset files). */
export function Avatar({ src, fallbackSrc, size = "md", className, alt = "프로필 사진", ...props }: AvatarProps) {
  return (
    <img
      src={src || fallbackSrc}
      alt={alt}
      className={cn("shrink-0 rounded-full object-cover", SIZE_CLASS[size], className)}
      {...props}
    />
  );
}
