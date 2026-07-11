import type { SegmentPriceItem } from "./planTypes";

interface Props {
  dragCardItem: SegmentPriceItem;
  dragCardPos: { x: number; y: number };
  hoverSegId: string | null;
}

export default function DragCardGhost({ dragCardItem, dragCardPos, hoverSegId }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        left: dragCardPos.x,
        top:  dragCardPos.y,
        transform: hoverSegId ? "translate(-50%, -50%) scale(0.88)" : "translate(-50%, -50%) scale(1)",
        zIndex: 9998,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: hoverSegId ? "rgba(239,68,68,0.25)" : "rgba(12,10,28,0.88)",
        border: `1.5px solid ${hoverSegId ? "rgba(239,68,68,0.9)" : "rgba(124,58,237,0.4)"}`,
        borderRadius: 14,
        padding: "7px 12px 7px 8px",
        backdropFilter: "blur(16px)",
        boxShadow: hoverSegId
          ? "0 0 28px rgba(239,68,68,0.6), 0 8px 24px rgba(0,0,0,0.5)"
          : "0 4px 20px rgba(0,0,0,0.5)",

        opacity: hoverSegId ? 0.85 : 1,
        transition: "transform 0.18s ease, opacity 0.18s ease, background 0.15s, box-shadow 0.15s",
        maxWidth: 180,
      }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 8, overflow: "hidden", flexShrink: 0,
        background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {dragCardItem.imageUrl
          ? <img src={dragCardItem.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 16 }}>📦</span>}
      </div>
      <span style={{
        fontSize: 11, fontWeight: 700,
        color: hoverSegId ? "rgba(252,165,165,1)" : "rgba(255,255,255,0.85)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        transition: "color 0.15s",
      }}>{dragCardItem.name}</span>
      {hoverSegId && (
        <span style={{ fontSize: 14, marginLeft: 2, animation: "pulse 0.6s ease-in-out infinite alternate" }}>
          →
        </span>
      )}
    </div>
  );
}