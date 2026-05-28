import { useState } from "react";
import type { PlanState } from "./planTypes";

interface Props {
  floorItems: PlanState["floorItems"];
  polyCx: number;
  polyCy: number;
  polyBBox: { w: number; h: number } | null;
  onChange: (patch: Partial<PlanState>) => void;
  onEditFloorItem?: (id: string) => void;
}

export default function PlanCanvasFloorItems({
  floorItems, polyCx, polyCy, polyBBox, onChange, onEditFloorItem,
}: Props) {
  const [hoverTooltip, setHoverTooltip] = useState<{
    x: number; y: number; name: string; qty: number; unit: string;
  } | null>(null);

  if (!polyBBox) return null;

  const visibleItems = (floorItems ?? []).filter(fi =>
    fi.category !== "Монтаж" &&
    fi.name !== "Раскрой ПВХ" &&
    fi.name !== "Огарпунивание ПВХ"
  );
  if (visibleItems.length === 0) return null;

  const S = Math.min(32, Math.max(20, (polyBBox.w * 0.12)));
  const GAP = S * 0.3;
  const cols = Math.max(1, Math.floor((polyBBox.w * 0.7) / (S + GAP)));
  const rows = Math.ceil(visibleItems.length / cols);
  const gridW = cols * (S + GAP) - GAP;
  const gridH = rows * (S + GAP) - GAP;
  const startX = polyCx - gridW / 2 + S / 2;
  const startY = polyCy - gridH / 2 + S / 2;

  return (
    <>
      {visibleItems.map((fi, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const fx = startX + col * (S + GAP);
        const fy = startY + row * (S + GAP);

        return (
          <g key={fi.id}
            style={{ cursor: "pointer" }}
            onClick={e => { e.stopPropagation(); onEditFloorItem?.(fi.id); }}
            onDoubleClick={e => { e.stopPropagation(); onChange({ floorItems: (floorItems ?? []).filter(f => f.id !== fi.id) }); }}
            onMouseEnter={() => setHoverTooltip({ x: fx, y: fy - S / 2 - 4, name: fi.name, qty: fi.quantity, unit: fi.unit })}
            onMouseLeave={() => setHoverTooltip(null)}
          >
            <rect x={fx - S / 2} y={fy - S / 2} width={S} height={S} rx={S * 0.22}
              fill="rgba(17,12,36,0.92)" stroke="rgba(124,58,237,0.5)" strokeWidth={1.2}
            />
            {fi.imageUrl ? (
              <image href={fi.imageUrl} x={fx - S / 2 + 2} y={fy - S / 2 + 2}
                width={S - 4} height={S - 4}
                preserveAspectRatio="xMidYMid meet"
                style={{ pointerEvents: "none" }}
              />
            ) : (
              <text x={fx} y={fy + 1} textAnchor="middle" dominantBaseline="middle"
                fontSize={S * 0.4} fontWeight={700} fill="rgba(196,181,253,0.9)"
                fontFamily="system-ui" className="pointer-events-none select-none">
                {fi.name.charAt(0).toUpperCase()}
              </text>
            )}
            <rect x={fx - S / 2} y={fy + S / 2 - 9} width={S} height={9} rx={3}
              fill="rgba(124,58,237,0.75)" className="pointer-events-none" />
            <text x={fx} y={fy + S / 2 - 4} textAnchor="middle" dominantBaseline="middle"
              fontSize={6.5} fontWeight={700} fill="#e9d5ff"
              fontFamily="monospace" className="pointer-events-none select-none">
              {fi.quantity} {fi.unit}
            </text>
            <title>{fi.name} — {fi.quantity} {fi.unit} · двойной клик = удалить</title>
          </g>
        );
      })}

      {hoverTooltip && (
        <g className="pointer-events-none">
          <rect
            x={hoverTooltip.x - 60} y={hoverTooltip.y - 28}
            width={120} height={22} rx={6}
            fill="rgba(17,12,36,0.97)" stroke="rgba(124,58,237,0.5)" strokeWidth={1}
          />
          <text x={hoverTooltip.x} y={hoverTooltip.y - 14}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={9} fill="#e9d5ff" fontFamily="system-ui" fontWeight={600}>
            {hoverTooltip.name} · {hoverTooltip.qty} {hoverTooltip.unit}
          </text>
        </g>
      )}
    </>
  );
}
