import type { PlanState } from "./planTypes";
import { usePlanCanvasState } from "./usePlanCanvasState";
import { usePlanCanvasEvents } from "./usePlanCanvasEvents";
import PlanCanvasSvg from "./PlanCanvasSvg";
import PlanCanvasOverlay from "./PlanCanvasOverlay";
import type { SegmentHandlers } from "./PlanCanvasRenderers";

interface Props {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
  onOpenCatalog?: () => void;
}

export default function PlanCanvas({ state, onChange, onOpenCatalog }: Props) {
  const { tool } = state;

  // ── Локальные стейты и refs ───────────────────────────────────────────────
  const cs = usePlanCanvasState(tool);

  // ── Все обработчики событий ───────────────────────────────────────────────
  const events = usePlanCanvasEvents({ state, onChange, cs });

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
        onMouseMove={events.handleMouseMove}
        onMouseDown={events.handleMouseDown}
        onMouseUp={events.handleMouseUp}
        onCanvasClick={events.handleCanvasClick}
        onTouchStart={events.handleTouchStart}
        onTouchMove={events.handleTouchMove}
        onTouchEnd={events.handleTouchEnd}
        onDimLineClick={events.handleDimLineClick}
      />

      <PlanCanvasOverlay
        state={state}
        onChange={onChange}
        ctxMenu={cs.ctxMenu}
        onCloseCtxMenu={() => cs.setCtxMenu(null)}
        lpIndicator={cs.lpIndicator}
        onSettingChange={patch => onChange({ settings: { ...state.settings, ...patch } })}
        onOpenCatalog={onOpenCatalog}
      />
    </div>
  );
}