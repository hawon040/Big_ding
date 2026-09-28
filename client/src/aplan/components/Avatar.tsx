import { resolveAssetUrl } from "@/api";
import defaultAvatar from "@/assets/figma/avatar-default.svg";

interface AvatarProps {
  src?: string | null;
  size: number;
  alt?: string;
}

// 원형 프로필 사진. 사진이 없거나 불러오지 못하면 Figma 기본 아바타(#D9D9D9 원, 2:120)를 쓴다.
export function Avatar({ src, size, alt = "" }: AvatarProps) {
  const url = resolveAssetUrl(src) || defaultAvatar;
  return (
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      className="block shrink-0 rounded-full object-cover"
      style={{ width: size, height: size, background: "var(--a-color-border)" }}
      onError={(e) => {
        if (e.currentTarget.src !== defaultAvatar) e.currentTarget.src = defaultAvatar;
      }}
    />
  );
}
