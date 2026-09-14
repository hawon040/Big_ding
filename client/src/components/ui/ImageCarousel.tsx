import * as React from "react";
import { cn } from "./utils";

export interface ImageCarouselProps {
  images: string[];
  /** square: 1:1 (feed thumbnails). auto: natural height, capped (post detail). */
  aspect?: "square" | "auto";
  className?: string;
  onImageClick?: (src: string, index: number) => void;
}

/** Image + left/right tap zones + dot indicators + "N/total" counter. Used identically across feed cards and post detail. */
export function ImageCarousel({ images, aspect = "square", className, onImageClick }: ImageCarouselProps) {
  const [index, setIndex] = React.useState(0);
  if (images.length === 0) return null;
  const clamped = Math.min(index, images.length - 1);

  return (
    <div className={cn("relative overflow-hidden rounded-[var(--r-md)]", aspect === "square" ? "aspect-square" : "max-h-72", className)}>
      <img
        src={images[clamped]}
        alt={`이미지 ${clamped + 1}/${images.length}`}
        className={cn("h-full w-full object-cover", onImageClick && "cursor-pointer")}
        onClick={() => onImageClick?.(images[clamped], clamped)}
      />

      {images.length > 1 && (
        <>
          {clamped > 0 && (
            <button
              aria-label="이전 이미지"
              onClick={(e) => { e.stopPropagation(); setIndex(clamped - 1); }}
              className="absolute inset-y-0 left-0 w-1/3"
            />
          )}
          {clamped < images.length - 1 && (
            <button
              aria-label="다음 이미지"
              onClick={(e) => { e.stopPropagation(); setIndex(clamped + 1); }}
              className="absolute inset-y-0 right-0 w-1/3"
            />
          )}

          <span
            className="absolute right-2 top-2 rounded-[var(--r-pill)] px-2 py-0.5 text-[11px] font-semibold text-white"
            style={{ background: "rgba(15,23,42,0.55)" }}
          >
            {clamped + 1}/{images.length}
          </span>

          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
            {images.map((_, i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: i === clamped ? "white" : "rgba(255,255,255,0.5)" }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
