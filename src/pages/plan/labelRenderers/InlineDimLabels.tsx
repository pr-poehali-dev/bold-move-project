import React, { useEffect } from "react";
import ReactDOM from "react-dom";
import type { PlanState } from "../planTypes";
import { distPx, midPoint, segmentNormal } from "../planTypes";

// ── Inline-edit размеров прямо на чертеже ─────────────────────────────────────

interface InlineDimProps {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
  editingSegId?: string | null;
  onSetEditingSegId?: (id: string | null) => void;
  svgRef?: React.RefObject<SVGSVGElement>;
}

export function InlineDimLabels({ state, onChange, editingSegId, onSetEditingSegId, svgRef }: InlineDimProps) {
  const { points, segments } = state;
  // Если editingSegId пробрасывается снаружи — используем его, иначе локальный стейт
  const [localEditingId, setLocalEditingId] = React.useState<string | null>(null);
  const editingId = editingSegId !== undefined ? editingSegId : localEditingId;
  const setEditingId = (id: string | null) => {
    setLocalEditingId(id);
    onSetEditingSegId?.(id);
  };
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  // Экранная позиция поля ввода — вычисляется из SVG-координат
  const [inputPos, setInputPos] = React.useState<{ x: number; y: number } | null>(null);

  // Вычисляем экранную позицию метки редактируемого сегмента
  React.useEffect(() => {
    if (!editingId || !svgRef?.current) { setInputPos(null); return; }
    const seg = segments.find(s => s.id === editingId);
    if (!seg) { setInputPos(null); return; }
    const a = points.find(p => p.id === seg.fromId);
    const b = points.find(p => p.id === seg.toId);
    if (!a || !b) { setInputPos(null); return; }
    const zoom = state.settings?.zoom ?? 1;
    const mid = midPoint(a, b);
    const { nx, ny } = segmentNormal(a, b);
    const segLen = distPx(a, b);
    const BASE_OFF = 14;
    const svgOff = BASE_OFF / zoom;
    const extraOff = segLen < 20 / zoom ? Math.min(60 / zoom, 30 / zoom) : segLen < 50 / zoom ? Math.min(40 / zoom, 20 / zoom) : 0;
    const off = svgOff + extraOff;
    const lx = mid.x + nx * off;
    const ly = mid.y + ny * off;
    // Переводим SVG-координаты в экранные через CTM
    const svgEl = svgRef.current;
    const pt = svgEl.createSVGPoint();
    pt.x = lx; pt.y = ly;
    const ctm = (svgEl.querySelector("g") as SVGGElement | null)?.getScreenCTM();
    if (ctm) {
      const screen = pt.matrixTransform(ctm);
      setInputPos({ x: screen.x, y: screen.y });
    }
  }, [editingId, segments, points, state.settings?.zoom]);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId, inputPos]);

  const commitEdit = (segId: string) => {
    const val = parseFloat(draft);
    if (!isNaN(val) && val > 0) {
      const newSegments = segments.map(s => s.id === segId ? { ...s, lengthCm: val } : s);
      let baseScale = state.baseScale ?? null;
      if (!baseScale) {
        const seg = segments.find(s => s.id === segId);
        if (seg) {
          const a = points.find(p => p.id === seg.fromId);
          const b = points.find(p => p.id === seg.toId);
          if (a && b) {
            const px = distPx(a, b);
            if (px > 0) baseScale = px / val;
          }
        }
      }
      onChange({ segments: newSegments, baseScale: baseScale ?? undefined });
    }
    setEditingId(null);
    setDraft("");
  };

  const cancelEdit = () => { setEditingId(null); setDraft(""); };

  // Portal с HTML-инпутом вне SVG — не зависит от zoom
  const inputPortal = editingId && inputPos ? ReactDOM.createPortal(
    <input
      ref={inputRef}
      type="number"
      min={1} max={99999} step={0.5}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => commitEdit(editingId)}
      onKeyDown={e => {
        if (e.key === "Enter") commitEdit(editingId);
        if (e.key === "Escape") cancelEdit();
        e.stopPropagation();
      }}
      style={{
        position: "fixed",
        left: inputPos.x - 44,
        top: inputPos.y - 18,
        width: 88, height: 36,
        background: "rgba(17,17,30,0.97)", color: "rgba(255,255,255,0.95)",
        border: "2px solid rgba(124,58,237,0.8)", borderRadius: 8,
        padding: "0 10px",
        fontSize: 16, fontFamily: "monospace", fontWeight: 700,
        outline: "none",
        boxSizing: "border-box",
        boxShadow: "0 0 16px rgba(124,58,237,0.5), 0 2px 14px rgba(0,0,0,0.8)",
        zIndex: 9999,
      }}
    />,
    document.body
  ) : null;

  return (
    <>
      {inputPortal}
      {segments.map(seg => {
        const a = points.find(p => p.id === seg.fromId);
        const b = points.find(p => p.id === seg.toId);
        if (!a || !b) return null;

        const mid = midPoint(a, b);
        const { nx, ny } = segmentNormal(a, b);
        const segLen = distPx(a, b);
        const zoom = state.settings?.zoom ?? 1;
        const BASE_OFF = 14;
        const svgOff = BASE_OFF / zoom;
        const extraOff = segLen < 20 / zoom
          ? Math.min(60 / zoom, 30 / zoom)
          : segLen < 50 / zoom
            ? Math.min(40 / zoom, 20 / zoom)
            : 0;
        const off = svgOff + extraOff;
        const lx = mid.x + nx * off;
        const ly = mid.y + ny * off;

        const lenCm = seg.lengthCm ?? null;
        if (lenCm === null) return null;
        const displayText = `${lenCm}`;

        const isEditing = editingId === seg.id;
        // Во время редактирования прячем SVG-метку — вместо неё HTML-инпут
        if (isEditing) return null;

        // Фиксированные размеры в экранных пикселях — не зависят от zoom
        const FS_PX = 11;     // font-size физических пикселей
        const BOX_H_PX = 20;  // высота метки физических пикселей
        const BOX_R_PX = 4;   // скругление
        const CHAR_W_PX = FS_PX * 0.65;
        const BOX_W_PX = Math.max(FS_PX * 3.8, displayText.length * CHAR_W_PX + FS_PX);
        const PAD_PX = 6;
        // Переводим в SVG-координаты — честное деление без округления
        const fs = FS_PX / zoom;
        const boxH = BOX_H_PX / zoom;
        const boxR = BOX_R_PX / zoom;
        const textW = BOX_W_PX / zoom;
        const pad = PAD_PX / zoom;

        return (
          <g key={seg.id} style={{ cursor: "text" }}
            onClick={e => {
              e.stopPropagation();
              setEditingId(seg.id);
              setDraft(seg.lengthCm !== null ? String(seg.lengthCm) : "");
            }}>
            {(extraOff > 0) && (
              <line x1={mid.x} y1={mid.y} x2={lx} y2={ly}
                stroke="rgba(255,255,255,0.2)" strokeWidth={0.6 / zoom} strokeDasharray={`${3/zoom} ${2/zoom}`}
                className="pointer-events-none" />
            )}
            {/* Расширенная зона клика */}
            <rect x={lx - textW / 2 - pad} y={ly - boxH / 2 - pad / 2} width={textW + pad * 2} height={boxH + pad}
              rx={boxR} fill="transparent" />
            <rect x={lx - textW / 2} y={ly - boxH / 2} width={textW} height={boxH} rx={boxR}
              fill="rgba(17,17,17,0.85)" stroke="rgba(255,255,255,0.2)" strokeWidth={0.7 / zoom} />
            <text x={lx} y={ly}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={fs} fontFamily="monospace" fontWeight={700}
              fill="rgba(255,255,255,0.9)"
              className="select-none pointer-events-none">
              {displayText}
            </text>
          </g>
        );
      })}
    </>
  );
}
