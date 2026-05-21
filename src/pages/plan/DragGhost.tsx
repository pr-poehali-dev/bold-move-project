import type { SegmentPriceItem } from "./planTypes";

interface Props {
  dragItem: SegmentPriceItem;
  dragPos: { x: number; y: number };
  hoverSegId: string | null;
}

export default function DragGhost({ dragItem, dragPos, hoverSegId }: Props) {
  return (
    <div style={{
      position: "fixed",
      left: dragPos.x, top: dragPos.y,
      transform: "translate(-50%, -50%)",
      zIndex: 9999, pointerEvents: "none",
      display: "flex", alignItems: "center", gap: 8,
      background: "rgba(15,16,23,0.92)",
      border: `1px solid ${hoverSegId ? "rgba(124,58,237,0.7)" : "rgba(255,255,255,0.15)"}`,
      borderRadius: 12, padding: "6px 10px 6px 6px",
      boxShadow: hoverSegId ? "0 0 20px rgba(124,58,237,0.4)" : "0 4px 20px rgba(0,0,0,0.5)",
      transition: "border-color 0.15s, box-shadow 0.15s", maxWidth: 180,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, overflow: "hidden", flexShrink: 0,
        background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {dragItem.imageUrl
          ? <img src={dragItem.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 16 }}>📦</span>}
      </div>
      <span style={{
        fontSize: 11, fontWeight: 600,
        color: hoverSegId ? "rgba(167,139,250,1)" : "rgba(255,255,255,0.8)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{dragItem.name}</span>
    </div>
  );
}