import React, { useRef, useState } from "react";
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
  updateBlock: (id: string, updated: PageBlock) => void;
  canvasRef: React.RefObject<HTMLDivElement>;
}

// ── Inline block editor — рендерит редактируемое содержимое прямо на холсте ──
function InlineBlockEditor({ block, onChange }: { block: PageBlock; onChange: (b: PageBlock) => void }) {
  const baseInput = "w-full h-full bg-transparent focus:outline-none resize-none text-white";

  if (block.type === "heading") {
    const sz = block.size === "xl" ? "text-2xl font-black" : block.size === "lg" ? "text-xl font-bold" : "text-base font-bold";
    const ac = block.align === "center" ? "text-center" : block.align === "right" ? "text-right" : "text-left";
    return (
      <textarea
        autoFocus
        value={block.text}
        onChange={e => onChange({ ...block, text: e.target.value })}
        className={`${baseInput} ${sz} ${ac} leading-tight break-words`}
        style={{ caretColor: "#a78bfa" }}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
      />
    );
  }

  if (block.type === "text") {
    const ac = block.align === "center" ? "text-center" : block.align === "right" ? "text-right" : "text-left";
    return (
      <textarea
        autoFocus
        value={block.text}
        onChange={e => onChange({ ...block, text: e.target.value })}
        className={`${baseInput} text-sm leading-relaxed text-white/80 ${ac}`}
        style={{ caretColor: "#a78bfa" }}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
      />
    );
  }

  if (block.type === "card") {
    const ac = block.align === "center" ? "text-center items-center" : block.align === "right" ? "text-right items-end" : "text-left items-start";
    return (
      <div className={`flex flex-col gap-1 w-full h-full justify-center ${ac}`}
        onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
        <input
          autoFocus
          value={block.icon}
          onChange={e => onChange({ ...block, icon: e.target.value })}
          className="bg-transparent focus:outline-none text-2xl w-10 text-center"
          style={{ caretColor: "#a78bfa" }}
        />
        <input
          value={block.title}
          onChange={e => onChange({ ...block, title: e.target.value })}
          className="bg-transparent focus:outline-none text-white font-bold text-sm w-full border-b border-violet-500/30 focus:border-violet-500"
          placeholder="Заголовок"
          style={{ caretColor: "#a78bfa" }}
        />
        <textarea
          value={block.text}
          onChange={e => onChange({ ...block, text: e.target.value })}
          className="bg-transparent focus:outline-none text-white/50 text-xs w-full resize-none"
          rows={2}
          placeholder="Описание"
          style={{ caretColor: "#a78bfa" }}
        />
      </div>
    );
  }

  // Для остальных типов показываем обычный превью (inline не применимо)
  return <BlockContent block={block} />;
}

export function EditorCanvas({
  blocks, selectedId, zoom, CW, CH, GRID, SNAP, isDroppingFromPalette,
  onCanvasClick, onCanvasDrop,
  onBlockMouseDown, onHandleMouseDown,
  bringToFront, sendToBack, duplicateBlock, deleteBlock, updateBlock,
  canvasRef,
}: Props) {
  const gridBg = SNAP
    ? `radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)`
    : undefined;

  // ID блока в режиме inline-редактирования (двойной клик)
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleBlockClick = (e: React.MouseEvent, id: string) => {
    // Двойной клик — входим в inline-редактирование
    if (e.detail === 2) {
      e.stopPropagation();
      const block = blocks.find(b => b.id === id);
      if (block && ["heading","text","card","quote"].includes(block.type)) {
        setEditingId(id);
      }
    }
  };

  const exitEditing = () => setEditingId(null);

  // Сбрасываем редактирование при клике вне блока
  const handleCanvasClick = (e: React.MouseEvent) => {
    setEditingId(null);
    onCanvasClick(e);
  };

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
          onClick={handleCanvasClick}
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
            const bw = block.w ?? DEFAULT_SIZES[block.type]?.w ?? 200;
            const bh = block.h ?? DEFAULT_SIZES[block.type]?.h ?? 48;
            const isSelected = selectedId === block.id;
            const isEditing  = editingId  === block.id;
            const canInline  = ["heading","text","card","quote"].includes(block.type);

            const extraStyle = blockStyleToCss(block.style_);
            const pad = block.style_?.padTop || block.style_?.padLeft ? extraStyle.padding : "6px 8px";

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
                  border: isEditing ? "1.5px solid rgba(139,92,246,0.7)" : extraStyle.border,
                  borderRadius: extraStyle.borderRadius ?? 8,
                  boxShadow: isEditing ? "0 0 0 3px rgba(139,92,246,0.15)" : extraStyle.boxShadow,
                }}
                className={`group transition-shadow ${
                  // текстовые блоки: overflow visible чтобы текст не обрезался
                  ["heading","text","card","quote","price"].includes(block.type) ? "overflow-visible" : "overflow-hidden"
                } ${
                  isEditing
                    ? ""
                    : isSelected
                    ? "ring-2 ring-violet-500 shadow-lg shadow-violet-500/20"
                    : "ring-1 ring-white/[0.04] hover:ring-white/[0.12]"
                }`}
                onMouseDown={e => {
                  if (isEditing) return; // не начинаем drag в режиме редактирования
                  onBlockMouseDown(e, block.id);
                }}
                onClick={e => handleBlockClick(e, block.id)}
              >
                {/* Content — текстовые блоки могут выходить за высоту */}
                <div
                  className="w-full"
                  style={{
                    cursor: isEditing ? "text" : "move",
                    padding: pad,
                    boxSizing: "border-box",
                    minHeight: "100%",
                    // overflow visible чтобы текст не обрезался при любом масштабе
                    overflow: ["heading","text","card"].includes(block.type) ? "visible" : "hidden",
                  }}
                >
                  {isEditing
                    ? <InlineBlockEditor block={block} onChange={b => updateBlock(block.id, b)} />
                    : <BlockContent block={block} blockW={bw} blockH={bh} />
                  }
                </div>

                {/* Block label (hover, only when not editing) */}
                {!isSelected && !isEditing && (
                  <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition pointer-events-none">
                    <span className="text-[8px] text-white/30 bg-black/60 px-1.5 py-0.5 rounded-full">
                      {BLOCK_LABELS[block.type]}
                    </span>
                  </div>
                )}

                {/* Hint: двойной клик для редактирования */}
                {isSelected && canInline && !isEditing && (
                  <div className="absolute bottom-1 right-1 pointer-events-none">
                    <span className="text-[7px] text-violet-400/60 bg-violet-500/10 px-1 py-0.5 rounded">
                      2× для правки
                    </span>
                  </div>
                )}

                {/* Exit editing button */}
                {isEditing && (
                  <button
                    onClick={e => { e.stopPropagation(); exitEditing(); }}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center z-20 shadow-sm"
                    title="Готово (Esc)"
                  >
                    <Icon name="Check" size={10} className="text-white" />
                  </button>
                )}

                {/* Resize handles (only when selected, not editing) */}
                {isSelected && !isEditing && HANDLES.map(handle => (
                  <div
                    key={handle}
                    className={`absolute w-2.5 h-2.5 rounded-sm bg-violet-500 border-2 border-white shadow-sm z-10 ${HANDLE_POS[handle]}`}
                    style={{ cursor: HANDLE_CURSOR[handle] }}
                    onMouseDown={e => { e.stopPropagation(); onHandleMouseDown(e, block.id, handle); }}
                  />
                ))}

                {/* Top toolbar when selected */}
                {isSelected && !isEditing && (
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