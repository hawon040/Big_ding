import { useState, useRef } from "react";
import { Plus, X, Utensils, RotateCcw, ChevronLeft } from "lucide-react";

const DEFAULT_MENUS = ["한식", "중식", "일식", "양식", "분식", "샐러드", "패스트푸드", "국밥·국수"];

const WHEEL_COLORS = [
  "#FDE68A", "#FCA5A5", "#A7F3D0", "#93C5FD",
  "#C4B5FD", "#F9A8D4", "#FDBA74", "#5EEAD4",
  "#BEF264", "#FDA4AF",
];

const SPIN_DURATION = 4200; // ms — 아래 transition 시간과 반드시 맞춰야 함

interface LunchScreenProps {
  onBack?: () => void;
}

export function LunchScreen({ onBack }: LunchScreenProps) {
  const [menus, setMenus] = useState<string[]>(DEFAULT_MENUS);
  const [newMenu, setNewMenu] = useState("");
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const targetIndexRef = useRef<number | null>(null);

  const sliceAngle = 360 / menus.length;

  const addMenu = () => {
    const trimmed = newMenu.trim();
    if (!trimmed || menus.includes(trimmed) || menus.length >= 12) return;
    setMenus((prev) => [...prev, trimmed]);
    setNewMenu("");
  };

  const removeMenu = (menu: string) => {
    if (menus.length <= 2) return; // 최소 2개는 유지
    setMenus((prev) => prev.filter((m) => m !== menu));
  };

  const handleSpin = () => {
    if (spinning || menus.length < 2) return;
    setResult(null);
    setSpinning(true);

    const randomIndex = Math.floor(Math.random() * menus.length);
    targetIndexRef.current = randomIndex;

    // 슬라이스 중심 각도가 상단 포인터(-90deg = 270deg) 위치에 오도록 회전량 계산
    const targetCenterAngle = randomIndex * sliceAngle + sliceAngle / 2;
    const currentMod = ((rotation % 360) + 360) % 360;
    const desiredMod = (((270 - targetCenterAngle) % 360) + 360) % 360;
    const diff = ((desiredMod - currentMod) % 360 + 360) % 360;
    const newRotation = rotation + 360 * 5 + diff; // 최소 5바퀴 이상 돌고 정확히 착지

    setRotation(newRotation);

    window.setTimeout(() => {
      setSpinning(false);
      setResult(menus[randomIndex]);
    }, SPIN_DURATION);
  };

  const size = 280;
  const center = size / 2;
  const radius = size / 2 - 6;

  const polarToCartesian = (angleDeg: number, r: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: center + r * Math.cos(rad), y: center + r * Math.sin(rad) };
  };

  const buildSlicePath = (index: number) => {
    const startAngle = index * sliceAngle;
    const endAngle = startAngle + sliceAngle;
    const start = polarToCartesian(startAngle, radius);
    const end = polarToCartesian(endAngle, radius);
    const largeArc = sliceAngle > 180 ? 1 : 0;
    return `M ${center} ${center} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 py-5 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        {onBack && (
          <button onClick={onBack} className="shrink-0">
            <ChevronLeft size={22} style={{ color: "var(--foreground)" }} />
          </button>
        )}
        <Utensils size={20} style={{ color: "var(--primary)" }} />
        <h2 className="font-semibold text-base" style={{ color: "var(--foreground)" }}>
          점심메뉴 추천
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col items-center gap-6 no-scrollbar">
        {/* 룰렛 */}
        <div className="relative" style={{ width: size, height: size }}>
          {/* 포인터 */}
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              top: -6, zIndex: 10, width: 0, height: 0,
              borderLeft: "10px solid transparent",
              borderRight: "10px solid transparent",
              borderTop: "18px solid var(--primary)",
            }}
          />
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning
                ? `transform ${SPIN_DURATION}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`
                : "none",
            }}
          >
            <circle cx={center} cy={center} r={radius + 4} fill="var(--card)" />
            {menus.map((menu, i) => {
              const midAngle = i * sliceAngle + sliceAngle / 2;
              const labelPos = polarToCartesian(midAngle, radius * 0.62);
              let textRotate = midAngle;
              if (textRotate > 90 && textRotate < 270) textRotate += 180;
              return (
                <g key={menu}>
                  <path
                    d={buildSlicePath(i)}
                    fill={WHEEL_COLORS[i % WHEEL_COLORS.length]}
                    stroke="var(--card)"
                    strokeWidth={2}
                  />
                  <text
                    x={labelPos.x}
                    y={labelPos.y}
                    fontSize={menus.length > 8 ? 10 : 12}
                    fontWeight={700}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#1f2937"
                    transform={`rotate(${textRotate}, ${labelPos.x}, ${labelPos.y})`}
                  >
                    {menu}
                  </text>
                </g>
              );
            })}
            <circle cx={center} cy={center} r={14} fill="var(--primary)" />
          </svg>
        </div>

        <button
          onClick={handleSpin}
          disabled={spinning || menus.length < 2}
          className="px-8 py-3 rounded-2xl font-semibold text-sm shadow-sm flex items-center gap-2"
          style={{
            background: spinning ? "var(--muted)" : "var(--primary)",
            color: spinning ? "var(--muted-foreground)" : "white",
          }}
        >
          <RotateCcw size={16} />
          {spinning ? "돌아가는 중..." : "룰렛 돌리기"}
        </button>

        {result && !spinning && (
          <div className="w-full text-center py-3 rounded-2xl" style={{ background: "var(--accent)" }}>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>오늘의 점심은</p>
            <p className="text-lg font-bold mt-0.5" style={{ color: "var(--foreground)" }}>{result} 🍽️</p>
          </div>
        )}

        {/* 메뉴 목록 편집 */}
        <div className="w-full">
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>
            메뉴 목록 ({menus.length}/12)
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {menus.map((menu) => (
              <span
                key={menu}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs"
                style={{ background: "var(--muted)", color: "var(--foreground)" }}
              >
                {menu}
                {menus.length > 2 && (
                  <button onClick={() => removeMenu(menu)}>
                    <X size={12} style={{ color: "var(--muted-foreground)" }} />
                  </button>
                )}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newMenu}
              onChange={(e) => setNewMenu(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addMenu(); }}
              placeholder="메뉴 추가 (예: 마라탕)"
              className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
            />
            <button
              onClick={addMenu}
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "var(--primary)" }}
            >
              <Plus size={18} color="white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}