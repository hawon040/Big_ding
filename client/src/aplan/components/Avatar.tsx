import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { resolveAssetUrl } from "@/api";

interface AvatarProps {
  src?: string | null;
  size: number;
  alt?: string;
}

// 원형 프로필 사진. 사진이 없거나 불러오지 못하면 회색 원 안에 흰 사람 모양의 기본 프로필 이미지를 보여준다.
export function Avatar({ src, size, alt = "" }: AvatarProps) {
  const url = resolveAssetUrl(src);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);

  if (!url || failed) {
    return (
      <span
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-full"
        style={{ width: size, height: size, background: "var(--a-color-border)" }}
      >
        <User size={Math.round(size * 0.6)} strokeWidth={1.5} fill="#fff" style={{ color: "#fff" }} aria-hidden />
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      className="block shrink-0 rounded-full object-cover"
      style={{ width: size, height: size, background: "var(--a-color-border)" }}
      onError={() => setFailed(true)}
    />
  );
}
