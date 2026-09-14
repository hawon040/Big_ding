import { useState, useRef } from "react";
import { ArrowLeft, Plus, RotateCcw, Utensils, X } from "lucide-react";
import "@/styles/tokens.css";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { Badge } from "@/components/ui/Badge";

const DEFAULT_MENUS = ["한식", "중식", "일식", "양식", "분식", "샐러드", "패스트푸드", "국밥·국수"];

// 룰렛 조각 색은 여러 항목을 한눈에 구분해야 하는 게임 콘텐츠라, 파란 계열 위주인
// 공용 토큰 팔레트로는 표현이 안 된다. 게시판 액센트 색과 같은 성격의 예외로 유지한다.
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
    <div className="flex flex-1 flex-col overflow-hidden" style={{ background: "var(--bg-base)" }}>
      {/* 헤더 */}
      <div className="flex shrink-0 items-center gap-3 px-4 py-4">
        {onBack && (
          <IconButton aria-label="뒤로 가기" onClick={onBack}>
            <ArrowLeft size={16} />
          </IconButton>
        )}
        <Utensils size={18} style={{ color: "var(--blue-primary)" }} />
        <h2 className="text-base font-semibold" style={{ color: "var(--text-strong)" }}>
          점심메뉴 추천
        </h2>
      </div>
      <div className="no-scrollbar flex flex-1 flex-col items-center gap-6 overflow-y-auto px-4 py-6">
        {/* 룰렛 */}
        <div className="relative" style={{ width: size, height: size }}>
          {/* 포인터 */}
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              top: -6, zIndex: 10, width: 0, height: 0,
              borderLeft: "10px solid transparent",
              borderRight: "10px solid transparent",
              borderTop: "18px solid var(--blue-deep)",
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
            <circle cx={center} cy={center} r={radius + 4} fill="var(--bg-card)" />
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
                    stroke="var(--bg-card)"
                    strokeWidth={2}
                  />
                  <text
                    x={labelPos.x}
                    y={labelPos.y}
                    fontSize={menus.length > 8 ? 10 : 12}
                    fontWeight={700}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="var(--text-body)"
                    transform={`rotate(${textRotate}, ${labelPos.x}, ${labelPos.y})`}
                  >
                    {menu}
                  </text>
                </g>
              );
            })}
            <circle cx={center} cy={center} r={14} fill="var(--blue-deep)" />
          </svg>
        </div>

        <Button variant={spinning ? "secondary" : "primary"} size={52} disabled={spinning || menus.length < 2} onClick={handleSpin}>
          <RotateCcw size={16} />
          {spinning ? "돌아가는 중..." : "룰렛 돌리기"}
        </Button>

        {result && !spinning && (
          <Card className="w-full text-center" style={{ background: "var(--blue-soft)" }}>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>오늘의 점심은</p>
            <p className="mt-0.5 text-lg font-bold" style={{ color: "var(--text-strong)" }}>{result} 🍽️</p>
          </Card>
        )}

        {/* 메뉴 목록 편집 */}
        <div className="w-full">
          <p className="mb-2 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            메뉴 목록 ({menus.length}/12)
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            {menus.map((menu) => (
              <Badge key={menu} tone="info" className="gap-1 py-1.5 text-xs font-normal">
                {menu}
                {menus.length > 2 && (
                  <button onClick={() => removeMenu(menu)} aria-label={`${menu} 삭제`}>
                    <X size={12} />
                  </button>
                )}
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newMenu}
              onChange={(e) => setNewMenu(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addMenu(); }}
              placeholder="메뉴 추가 (예: 마라탕)"
              aria-label="메뉴 추가"
              className="flex-1 rounded-[var(--r-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-body)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--blue-primary)] focus:bg-[var(--blue-soft)] focus:ring-2 focus:ring-[var(--blue-primary)]/30"
            />
            <IconButton aria-label="메뉴 추가" onClick={addMenu} active>
              <Plus size={18} />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
}
