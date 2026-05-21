import { useState } from "react";
import type { PlanState } from "./planTypes";
import { usePlanCanvasState } from "./usePlanCanvasState";
import { usePlanCanvasEvents } from "./usePlanCanvasEvents";
import PlanCanvasSvg from "./PlanCanvasSvg";
import PlanCanvasOverlay from "./PlanCanvasOverlay";
import type { SegmentHandlers } from "./PlanCanvasRenderers";

interface Props {
  state: PlanState;
  eventState?: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
  onReplace: (patch: Partial<PlanState>) => void;
  onOpenCatalog?: () => void;
  onEditFloorItem?: (id: string) => void;
  onEditSegItem?: (segId: string, priceId: number) => void;
}

export default function PlanCanvas({ state, eventState, onChange, onReplace, onOpenCatalog, onEditFloorItem, onEditSegItem }: Props) {
  const { tool } = state;

  // ── Локальные стейты и refs ───────────────────────────────────────────────
  const cs = usePlanCanvasState(tool);

  // Редактирование длины стены — пробрасывается из контекстного меню в InlineDimLabels
  const [editingSegId, setEditingSegId] = useState<string | null>(null);

  // ── Все обработчики событий (используем реальный state, не display) ───────
  const events = usePlanCanvasEvents({ state: eventState ?? state, onChange, onReplace, cs });

  // ── Cursor ────────────────────────────────────────────────────────────────
  const cursor = cs.isPanning.current
    ? "grabbing"
    : tool === "draw" ? "crosshair"
    : tool === "move" ? "default"
    : tool === "delete" ? "crosshair"
    : tool === "arc" ? "cell"
    : "default";

  // ── Handlers для рендерера ────────────────────────────────────────────────
  const handlers: SegmentHandlers = {
    onSegmentClick:   events.handleSegmentClick,
    onSegmentCtxMenu: events.handleSegmentCtxMenu,
    onDimLineClick:   events.handleDimLineClick,
    onDiagonalClick:  events.handleDiagonalClick,
    onPointClick:     events.handlePointClick,
    onPointMouseDown: events.handlePointMouseDown,
    onPointCtxMenu:   events.handlePointCtxMenu,
  };

  return (
    <div className="w-full h-full overflow-hidden relative bg-[#111] select-none touch-none">
      <PlanCanvasSvg
        svgRef={cs.svgRef}
        state={state}
        onChange={onChange}
        cursor={cursor}
        ghost={cs.ghost}
        dimLineFrom={cs.dimLineFrom}
        isPanning={cs.isPanning}
        handlers={handlers}
        deleteHover={cs.deleteHover}
        onMouseMove={events.handleMouseMove}
        onMouseDown={events.handleMouseDown}
        onMouseUp={events.handleMouseUp}
        onCanvasClick={events.handleCanvasClick}
        onCanvasDblClick={events.handleCanvasDblClick}
        onTouchStart={events.handleTouchStart}
        onTouchMove={events.handleTouchMove}
        onTouchEnd={events.handleTouchEnd}
        onDimLineClick={events.handleDimLineClick}
        onEditFloorItem={onEditFloorItem}
        onEditSegItem={onEditSegItem}
        editingSegId={editingSegId}
        onSetEditingSegId={setEditingSegId}
      />

      <PlanCanvasOverlay
        state={state}
        onChange={onChange}
        ctxMenu={cs.ctxMenu}
        onCloseCtxMenu={() => cs.setCtxMenu(null)}
        lpIndicator={cs.lpIndicator}
        onSettingChange={patch => onChange({ settings: { ...state.settings, ...patch } })}
        onOpenCatalog={onOpenCatalog}
        onEditSegmentLength={id => { setEditingSegId(id); cs.setCtxMenu(null); }}
      />
    </div>
  );
}