import React, { useRef } from "react";
import type { PageBlock } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";
import { BlockContent } from "./BlockContent";
import {
  blockStyleToCss, DEFAULT_SIZES, BLOCK_LABELS,
  HANDLES, HANDLE_CURSOR, HANDLE_POS,
} from "./editorTypes";
import type { Handle } from "./editorTypes";

interface Props {
  blocks: PageBlock[];
  selectedId: string | null;
  zoom: number;
  CW: number;
  CH: number;
  GRID: number;
  SNAP: boolean;
  isDroppingFromPalette: boolean;
  onCanvasClick: (e: React.MouseEvent) => void;
  onCanvasDrop: (e: React.DragEvent) => void;
  onBlockMouseDown: (e: React.MouseEvent, id: string) => void;
  onHandleMouseDown: (e: React.MouseEvent, id: string, handle: Handle) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  duplicateBlock: (id: string) => void;
  deleteBlock: (id: string) => void;
  canvasRef: React.RefObject<HTMLDivElement>;
}

export function EditorCanvas({
  blocks, selectedId, zoom, CW, CH, GRID, SNAP, isDroppingFromPalette,
  onCanvasClick, onCanvasDrop,
  onBlockMouseDown, onHandleMouseDown,
  bringToFront, sendToBack, duplicateBlock, deleteBlock,
  canvasRef,
}: Props) {
  const gridBg = SNAP
    ? `radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)`
    : undefined;

  return (
    <div className="flex-1 overflow-auto bg-[#07070f] flex items-start justify-center p-8"
      onDrop={onCanvasDrop} onDragOver={e => e.preventDefault()}>
      {/* Canvas frame */}
      <div
        style={{ width: CW * zoom, height: CH * zoom, position: "relative", flexShrink: 0 }}
        className={`rounded-2xl shadow-2xl border border-white/[0.08] overflow-hidden transition-shadow ${isDroppingFromPalette ? "ring-2 ring-violet-500/50" : ""}`}
      >
        {/* Canvas inner */}
        <div
          ref={canvasRef}
          style={{
            width: CW, height: CH,
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            position: "relative",
            background: "#0a0a14",
            backgroundImage: gridBg,
            backgroundSize: `${GRID}px ${GRID}px`,
          }}
          className="canvas-bg"
          onClick={onCanvasClick}
        >
          {/* Empty state */}
          {blocks.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-3">
                <Icon name="MousePointerClick" size={24} className="text-white/15" />
              </div>
              <p className="text-white/20 text-sm">Перетащите блок из панели</p>
              <p className="text-white/10 text-xs mt-1">или нажмите на тип блока</p>
            </div>
          )}

          {/* Blocks */}
          {[...blocks].sort((a,b) => (a.zIndex??1)-(b.zIndex??1)).map(block => {
            const bx = block.x ?? 0;
            const by = block.y ?? 0;
            const bw = block.w ?? DEFAULT_SIZES[block.type]?.w ?? 240;
            const bh = block.h ?? DEFAULT_SIZES[block.type]?.h ?? 80;
            const isSelected = selectedId === block.id;

            const extraStyle = blockStyleToCss(block.style_);
            const padStyle = block.style_
              ? { padding: extraStyle.padding }
              : { padding: "8px" };

            return (
              <div
                key={block.id}
                style={{
                  position: "absolute",
                  left: bx, top: by,
                  width: bw, height: bh,
                  zIndex: block.zIndex ?? 1,
                  opacity: block.hidden ? 0.25 : (extraStyle.opacity ?? 1),
                  background: extraStyle.background ?? (block.bg || "transparent"),
                  backgroundColor: extraStyle.background ? undefined : (extraStyle.backgroundColor ?? (block.bg || undefined)),
                  border: extraStyle.border,
                  borderRadius: extraStyle.borderRadius ?? 12,
                  boxShadow: extraStyle.boxShadow,
                }}
                className={`group overflow-hidden transition-shadow ${
                  isSelected
                    ? "ring-2 ring-violet-500 shadow-lg shadow-violet-500/20"
                    : "ring-1 ring-white/[0.04] hover:ring-white/[0.12]"
                }`}
                onMouseDown={e => onBlockMouseDown(e, block.id)}
              >
                {/* Content */}
                <div className="w-full h-full overflow-hidden" style={{ cursor: "move", ...padStyle }}>
                  <BlockContent block={block} />
                </div>

                {/* Block label (hover) */}
                {!isSelected && (
                  <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition pointer-events-none">
                    <span className="text-[8px] text-white/30 bg-black/60 px-1.5 py-0.5 rounded-full">
                      {BLOCK_LABELS[block.type]}
                    </span>
                  </div>
                )}

                {/* Resize handles */}
                {isSelected && HANDLES.map(handle => (
                  <div
                    key={handle}
                    className={`absolute w-3 h-3 rounded-sm bg-violet-500 border-2 border-white shadow-sm z-10 ${HANDLE_POS[handle]}`}
                    style={{ cursor: HANDLE_CURSOR[handle] }}
                    onMouseDown={e => onHandleMouseDown(e, block.id, handle)}
                  />
                ))}

                {/* Top toolbar when selected */}
                {isSelected && (
                  <div className="absolute -top-8 left-0 flex items-center gap-1 z-20 pointer-events-none">
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#1a1a2e] border border-violet-500/30 shadow-lg pointer-events-auto">
                      <span className="text-[9px] text-violet-400 font-bold mr-1">{BLOCK_LABELS[block.type]}</span>
                      <button onClick={e => { e.stopPropagation(); bringToFront(block.id); }}
                        className="text-white/40 hover:text-white/80 transition p-0.5" title="На передний план">
                        <Icon name="BringToFront" size={10} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); sendToBack(block.id); }}
                        className="text-white/40 hover:text-white/80 transition p-0.5" title="На задний план">
                        <Icon name="SendToBack" size={10} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); duplicateBlock(block.id); }}
                        className="text-white/40 hover:text-white/80 transition p-0.5" title="Дублировать">
                        <Icon name="Copy" size={10} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); deleteBlock(block.id); }}
                        className="text-red-400/60 hover:text-red-400 transition p-0.5" title="Удалить">
                        <Icon name="Trash2" size={10} />
                      </button>
                    </div>
                    <span className="text-[8px] text-white/20 ml-1">{Math.round(bx)},{Math.round(by)} · {Math.round(bw)}×{Math.round(bh)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
