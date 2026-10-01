import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { StoryText } from "@/types/aplan";

interface StoryCanvasProps {
  src: string;
  texts: StoryText[];
  alt?: string;
  /** 편집 모드: 글을 눌러 선택하고 끌어서 옮긴다 */
  editor?: {
    selected: number | null;
    onSelect: (index: number | null) => void;
    onMove: (index: number, x: number, y: number) => void;
    placeholder?: string;
  };
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// 사진을 화면에 꽉 차게(비율 유지) 보여 주고 그 위에 글을 얹는다. 편집기와 뷰어가 같은 계산을 쓰기 때문에
// 글의 위치·크기는 사진 대비 비율(0~1)로만 저장해도 어느 화면에서나 같은 자리에 같은 모양으로 보인다.
// 글자 크기는 사진 상자 너비 기준(cqw)이라 상자가 커지고 작아져도 함께 비례한다.
export function StoryCanvas({ src, texts, alt = "", editor }: StoryCanvasProps) {
  const areaRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const drag = useRef<{ index: number; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    setNatural(null);
    const img = new Image();
    img.onload = () => setNatural({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.src = src;
    return () => {
      img.onload = null;
    };
  }, [src]);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => setArea({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = natural && area.w && area.h ? Math.min(area.w / natural.w, area.h / natural.h) : 0;
  const box = natural && scale ? { width: Math.round(natural.w * scale), height: Math.round(natural.h * scale) } : null;

  const startDrag = (e: React.PointerEvent<HTMLDivElement>, index: number) => {
    if (!editor || !boxRef.current) return;
    e.stopPropagation();
    editor.onSelect(index);
    const rect = boxRef.current.getBoundingClientRect();
    const t = texts[index];
    drag.current = { index, offsetX: e.clientX - (rect.left + t.x * rect.width), offsetY: e.clientY - (rect.top + t.y * rect.height) };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const moveDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !editor || !boxRef.current) return;
    const rect = boxRef.current.getBoundingClientRect();
    // 글 전체가 사진 안에 머물도록, 글 크기의 절반만큼 안쪽으로 이동 범위를 제한한다(글이 사진보다 크면 가운데)
    const halfW = Math.min(0.5, e.currentTarget.offsetWidth / 2 / rect.width);
    const halfH = Math.min(0.5, e.currentTarget.offsetHeight / 2 / rect.height);
    const x = Math.min(1 - halfW, Math.max(halfW, (e.clientX - d.offsetX - rect.left) / rect.width));
    const y = Math.min(1 - halfH, Math.max(halfH, (e.clientY - d.offsetY - rect.top) / rect.height));
    editor.onMove(d.index, clamp01(x), clamp01(y));
  };

  return (
    <div ref={areaRef} className="flex size-full items-center justify-center overflow-hidden">
      {box && (
        <div
          ref={boxRef}
          className="relative shrink-0 overflow-hidden"
          style={{ ...box, containerType: "inline-size" } as CSSProperties}
          onPointerDown={() => editor?.onSelect(null)}
        >
          <img src={src} alt={alt} draggable={false} className="absolute inset-0 size-full select-none" />
          {texts.map((t, i) => {
            const selected = editor?.selected === i;
            const empty = !t.text.trim();
            return (
              <div
                key={i}
                onPointerDown={(e) => startDrag(e, i)}
                onPointerMove={moveDrag}
                onPointerUp={() => (drag.current = null)}
                onPointerCancel={() => (drag.current = null)}
                className="absolute text-center font-bold break-words whitespace-pre-wrap select-none"
                style={{
                  left: `${t.x * 100}%`,
                  top: `${t.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                  maxWidth: "92%",
                  fontSize: `${t.size * 100}cqw`,
                  lineHeight: 1.2,
                  color: t.color,
                  textShadow: "0 1px 4px rgba(0,0,0,0.55)",
                  opacity: editor && empty ? 0.6 : 1,
                  touchAction: editor ? "none" : undefined,
                  cursor: editor ? "move" : undefined,
                  outline: selected ? "1.5px dashed rgba(255,255,255,0.9)" : undefined,
                  outlineOffset: 4,
                }}
              >
                {empty ? editor?.placeholder ?? "" : t.text}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
