import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useBrand } from "@/context/BrandContext";
import type { NavButton, PageBlock, PageSettings } from "@/context/AuthContext";
import { updateBrand } from "./admin/own-agent/brandApi";
import Icon from "@/components/ui/icon";
import func2url from "@/../backend/func2url.json";

import {
  genId, snap, defaultBlock, blockStyleToCss,
  DEFAULT_SIZES, ADD_BLOCKS, BLOCK_LABELS,
  HANDLES, HANDLE_CURSOR, HANDLE_POS,
  SNAP_EDGE,
} from "./editor/editorTypes";
import type { Handle } from "./editor/editorTypes";
import { BlockContent } from "./editor/BlockContent";
import { BlockEditor, CanvasSettingsPanel } from "./editor/BlockEditor";

const PAGE_AI_URL = (func2url as Record<string, string>)["page-ai"];

// ── Main PageEditor ────────────────────────────────────────────────────────────
interface Props { panelId: string; onBack: () => void; }

export default function PageEditor({ panelId, onBack }: Props) {
  const { token } = useAuth();
  const { brand } = useBrand();

  const navBtn = brand.nav_config?.find(b => b.id === panelId) as NavButton | undefined;
  const initialBlocks: PageBlock[] = navBtn?.content?.blocks ?? [];
  const initialTitle = navBtn?.content?.title ?? navBtn?.label ?? "";
  const initialSettings: PageSettings = {
    freeCanvas: true, snap: true, gridSize: 8,
    canvasWidth: 390, canvasHeight: 1200,
    ...navBtn?.content?.pageSettings,
  };

  const [blocks, setBlocks] = useState<PageBlock[]>(initialBlocks);
  const [title, setTitle] = useState(initialTitle);
  const [settings, setSettings] = useState<PageSettings>(initialSettings);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"blocks" | "settings">("blocks");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  // Canvas zoom/pan
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Dragging state
  const dragState = useRef<{
    type: "move" | "resize";
    id: string;
    handle?: Handle;
    startX: number; startY: number;
    origX: number; origY: number;
    origW: number; origH: number;
  } | null>(null);

  // Palette drag
  const paletteType = useRef<PageBlock["type"] | null>(null);
  const [isDroppingFromPalette, setIsDroppingFromPalette] = useState(false);

  const selectedBlock = blocks.find(b => b.id === selectedId) ?? null;

  const GRID = settings.gridSize ?? 8;
  const SNAP = settings.snap ?? true;
  const CW = settings.canvasWidth ?? 390;
  const CH = settings.canvasHeight ?? 1200;

  const updateBlock = useCallback((id: string, updated: PageBlock) => {
    setBlocks(bs => bs.map(b => b.id === id ? updated : b));
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setBlocks(bs => bs.filter(b => b.id !== id));
    setSelectedId(null);
  }, []);

  const duplicateBlock = useCallback((id: string) => {
    setBlocks(bs => {
      const b = bs.find(x => x.id === id);
      if (!b) return bs;
      const copy = { ...b, id: genId(), x: (b.x ?? 0) + 16, y: (b.y ?? 0) + 16, zIndex: Math.max(...bs.map(x => x.zIndex ?? 1)) + 1 };
      return [...bs, copy];
    });
  }, []);

  const bringToFront = useCallback((id: string) => {
    setBlocks(bs => {
      const maxZ = Math.max(...bs.map(b => b.zIndex ?? 1));
      return bs.map(b => b.id === id ? { ...b, zIndex: maxZ + 1 } : b);
    });
  }, []);

  const sendToBack = useCallback((id: string) => {
    setBlocks(bs => {
      const minZ = Math.min(...bs.map(b => b.zIndex ?? 1));
      return bs.map(b => b.id === id ? { ...b, zIndex: Math.max(0, minZ - 1) } : b);
    });
  }, []);

  const addBlock = (type: PageBlock["type"], cx?: number, cy?: number) => {
    const x = snap(cx ?? 40, GRID, SNAP);
    const y = snap(cy ?? 40, GRID, SNAP);
    const maxZ = blocks.length ? Math.max(...blocks.map(b => b.zIndex ?? 1)) + 1 : 1;
    const nb = { ...defaultBlock(type, x, y), zIndex: maxZ };
    setBlocks(bs => [...bs, nb]);
    setSelectedId(nb.id);
    setSidebarTab("blocks");
  };

  // ── Snap helpers ──────────────────────────────────────────────────────────
  function snapToEdges(id: string, nx: number, ny: number, nw: number, nh: number) {
    if (!SNAP) return { nx, ny };
    let rx = nx, ry = ny;
    for (const b of blocks) {
      if (b.id === id) continue;
      const bx = b.x ?? 0, by = b.y ?? 0, bw = b.w ?? 100, bh = b.h ?? 60;
      if (Math.abs(nx - (bx + bw)) < SNAP_EDGE) rx = bx + bw;
      if (Math.abs((nx + nw) - bx) < SNAP_EDGE) rx = bx - nw;
      if (Math.abs(ny - (by + bh)) < SNAP_EDGE) ry = by + bh;
      if (Math.abs((ny + nh) - by) < SNAP_EDGE) ry = by - nh;
      if (Math.abs(nx - bx) < SNAP_EDGE) rx = bx;
      if (Math.abs(ny - by) < SNAP_EDGE) ry = by;
    }
    return { nx: rx, ny: ry };
  }

  // ── Mouse events ──────────────────────────────────────────────────────────
  const onBlockMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(id);
    setSidebarTab("blocks");
    const b = blocks.find(x => x.id === id)!;
    dragState.current = {
      type: "move", id,
      startX: e.clientX, startY: e.clientY,
      origX: b.x ?? 0, origY: b.y ?? 0,
      origW: b.w ?? 100, origH: b.h ?? 60,
    };
  };

  const onHandleMouseDown = (e: React.MouseEvent, id: string, handle: Handle) => {
    e.stopPropagation();
    e.preventDefault();
    const b = blocks.find(x => x.id === id)!;
    dragState.current = {
      type: "resize", id, handle,
      startX: e.clientX, startY: e.clientY,
      origX: b.x ?? 0, origY: b.y ?? 0,
      origW: b.w ?? 100, origH: b.h ?? 60,
    };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const ds = dragState.current;
      if (!ds) return;
      const dx = (e.clientX - ds.startX) / zoom;
      const dy = (e.clientY - ds.startY) / zoom;

      setBlocks(bs => bs.map(b => {
        if (b.id !== ds.id) return b;
        if (ds.type === "move") {
          let nx = snap(ds.origX + dx, GRID, SNAP);
          let ny = snap(ds.origY + dy, GRID, SNAP);
          const ed = snapToEdges(ds.id, nx, ny, b.w ?? 100, b.h ?? 60);
          nx = Math.max(0, Math.min(CW - (b.w ?? 100), ed.nx));
          ny = Math.max(0, ed.ny);
          return { ...b, x: nx, y: ny };
        }
        const handle = ds.handle!;
        let nx = ds.origX, ny = ds.origY;
        let nw = ds.origW, nh = ds.origH;
        if (handle.includes("e")) nw = Math.max(60, snap(ds.origW + dx, GRID, SNAP));
        if (handle.includes("w")) { nw = Math.max(60, snap(ds.origW - dx, GRID, SNAP)); nx = ds.origX + ds.origW - nw; }
        if (handle.includes("s")) nh = Math.max(30, snap(ds.origH + dy, GRID, SNAP));
        if (handle.includes("n")) { nh = Math.max(30, snap(ds.origH - dy, GRID, SNAP)); ny = ds.origY + ds.origH - nh; }
        return { ...b, x: Math.max(0, nx), y: Math.max(0, ny), w: nw, h: nh };
      }));
    };
    const onUp = () => { dragState.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [zoom, GRID, SNAP, CW, blocks]);

  // ── Canvas click (deselect) ───────────────────────────────────────────────
  const onCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as Element).classList.contains("canvas-bg")) {
      setSelectedId(null);
    }
  };

  // ── Palette drop onto canvas ──────────────────────────────────────────────
  const onCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!paletteType.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = (e.clientX - rect.left) / zoom;
    const cy = (e.clientY - rect.top) / zoom;
    addBlock(paletteType.current, cx, cy);
    paletteType.current = null;
    setIsDroppingFromPalette(false);
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!brand.nav_config) return;
    setSaving(true);
    try {
      const newNav = brand.nav_config.map(b =>
        b.id === panelId
          ? { ...b, content: { ...(b.content || {}), title, blocks, pageSettings: settings } }
          : b
      );
      await updateBrand(token, { ...brand, nav_config: newNav } as Parameters<typeof updateBrand>[1]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      const cid = new URLSearchParams(window.location.search).get("c");
      if (cid) localStorage.removeItem(`mp_brand_${cid}`);
    } finally { setSaving(false); }
  };

  const handleAi = async () => {
    if (!aiPrompt.trim() || aiLoading) return;
    setAiLoading(true); setAiError("");
    try {
      const res = await fetch(PAGE_AI_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks, prompt: aiPrompt }),
      });
      const d = await res.json();
      if (!res.ok || d.error) { setAiError(d.error || "Ошибка AI"); return; }
      setBlocks(d.blocks as PageBlock[]);
      setAiPrompt(""); setSelectedId(null);
    } catch { setAiError("Не удалось подключиться к AI"); }
    finally { setAiLoading(false); }
  };

  // Grid dots bg
  const gridBg = SNAP
    ? `radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)`
    : undefined;

  return (
    <div className="fixed inset-0 z-[200] bg-[#07070f] flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-white/[0.08] bg-[#0e0e1a]">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 rounded-xl hover:bg-white/5 text-white/40 hover:text-white/80 transition">
              <Icon name="ArrowLeft" size={17} />
            </button>
            <div>
              <input value={title} onChange={e => setTitle(e.target.value)}
                className="bg-transparent text-white font-bold text-sm focus:outline-none border-b border-transparent focus:border-white/20 transition min-w-[140px]"
                placeholder="Название страницы" />
              <p className="text-white/20 text-[10px]">{navBtn?.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Zoom */}
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.07]">
              <button onClick={() => setZoom(z => Math.max(0.25, z - 0.1))} className="text-white/40 hover:text-white/70 transition w-5 text-center">−</button>
              <span className="text-xs text-white/40 w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="text-white/40 hover:text-white/70 transition w-5 text-center">+</button>
              <button onClick={() => setZoom(1)} className="text-white/20 hover:text-white/50 text-[9px] ml-1 transition">1:1</button>
            </div>
            <button onClick={handleSave} disabled={saving}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white transition disabled:opacity-50 ${
                saved ? "bg-emerald-500/80" : "bg-gradient-to-r from-orange-500 to-rose-500"
              }`}>
              <Icon name={saved ? "CheckCircle2" : saving ? "Loader" : "Save"} size={14} className={saving ? "animate-spin" : ""} />
              {saved ? "Сохранено!" : saving ? "..." : "Сохранить"}
            </button>
          </div>
        </div>
        {/* AI */}
        <div className="px-4 pb-2.5 flex gap-2 items-center">
          <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-500/[0.07] border border-violet-500/20 focus-within:border-violet-500/40 transition">
            <Icon name="Sparkles" size={13} className="text-violet-400 shrink-0" />
            <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAi()}
              placeholder="Попросите AI изменить страницу..."
              className="flex-1 bg-transparent text-xs text-white placeholder:text-white/25 focus:outline-none" />
          </div>
          <button onClick={handleAi} disabled={aiLoading || !aiPrompt.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 transition shrink-0">
            <Icon name={aiLoading ? "Loader" : "Wand2"} size={13} className={aiLoading ? "animate-spin" : ""} />
            {aiLoading ? "..." : "Применить"}
          </button>
        </div>
        {aiError && <p className="px-4 pb-2 text-xs text-red-400">{aiError}</p>}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* Canvas area */}
        <div className="flex-1 overflow-auto bg-[#07070f] flex items-start justify-center p-8"
          onDrop={onCanvasDrop} onDragOver={e => e.preventDefault()}>
          {/* Canvas frame */}
          <div
            style={{
              width: CW * zoom,
              height: CH * zoom,
              position: "relative",
              flexShrink: 0,
            }}
            className={`rounded-2xl shadow-2xl border border-white/[0.08] overflow-hidden transition-shadow ${isDroppingFromPalette ? "ring-2 ring-violet-500/50" : ""}`}
          >
            {/* Scrollable canvas inner (zoom) */}
            <div
              ref={canvasRef}
              style={{
                width: CW,
                height: CH,
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

                    {/* Resize handles (only when selected) */}
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

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <div className="w-64 shrink-0 border-l border-white/[0.07] bg-[#0c0c18] flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="shrink-0 flex border-b border-white/[0.07]">
            {(["blocks","settings"] as const).map(tab => (
              <button key={tab} onClick={() => { setSidebarTab(tab); if (tab==="settings") setSelectedId(null); }}
                className={`flex-1 py-2.5 text-xs font-bold transition ${
                  (sidebarTab === tab && !selectedId) || (sidebarTab === tab && tab === "settings")
                    ? "text-violet-300 border-b-2 border-violet-500"
                    : "text-white/25 hover:text-white/50"
                }`}>
                {tab === "blocks" ? "Элементы" : "Холст"}
              </button>
            ))}
          </div>

          {selectedBlock ? (
            <div className="flex-1 overflow-y-auto p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-white/50 uppercase tracking-wider">{BLOCK_LABELS[selectedBlock.type]}</span>
                <button onClick={() => setSelectedId(null)} className="text-white/20 hover:text-white/50 transition"><Icon name="X" size={13} /></button>
              </div>
              <BlockEditor
                block={selectedBlock}
                onChange={updated => updateBlock(selectedBlock.id, updated)}
                onDelete={() => deleteBlock(selectedBlock.id)}
                onDuplicate={() => duplicateBlock(selectedBlock.id)}
                onBringFront={() => bringToFront(selectedBlock.id)}
                onSendBack={() => sendToBack(selectedBlock.id)}
                token={token}
              />
            </div>

          ) : sidebarTab === "settings" ? (
            <div className="flex-1 overflow-y-auto">
              <CanvasSettingsPanel settings={settings} onChange={setSettings} />
            </div>

          ) : (
            <div className="flex-1 overflow-y-auto p-3">
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2.5">Перетащить или нажать</p>
              <div className="grid grid-cols-2 gap-2">
                {ADD_BLOCKS.map(({ type, icon, label, color, bg }) => (
                  <div key={type}
                    draggable
                    onDragStart={() => { paletteType.current = type; setIsDroppingFromPalette(true); }}
                    onDragEnd={() => { paletteType.current = null; setIsDroppingFromPalette(false); }}
                    onClick={() => addBlock(type)}
                    className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-white/[0.07] hover:border-white/20 transition-all group cursor-grab active:cursor-grabbing select-none hover:scale-[1.03] active:scale-95"
                    style={{ background: "rgba(255,255,255,0.025)" }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                      style={{ background: bg }}>
                      <Icon name={icon} size={17} style={{ color }} />
                    </div>
                    <span className="text-[10px] font-semibold text-white/50 group-hover:text-white/80 transition text-center leading-tight">{label}</span>
                    <div className="w-6 h-0.5 rounded-full opacity-50 group-hover:opacity-100 transition" style={{ background: color }} />
                  </div>
                ))}
              </div>

              {blocks.length > 0 && (
                <div className="mt-4 pt-3 border-t border-white/[0.06]">
                  <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-1.5">Слои ({blocks.length})</p>
                  <div className="space-y-0.5">
                    {[...blocks].sort((a,b)=>(b.zIndex??1)-(a.zIndex??1)).map(block => {
                      const pal = ADD_BLOCKS.find(b => b.type === block.type);
                      return (
                        <button key={block.id} onClick={() => { setSelectedId(block.id); setSidebarTab("blocks"); }}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-left transition group ${selectedId===block.id?"bg-violet-500/10 border border-violet-500/20":"hover:bg-white/[0.04] border border-transparent"}`}>
                          <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                            style={{ background: pal?.bg ?? "rgba(255,255,255,0.05)" }}>
                            <Icon name={pal?.icon ?? "Box"} size={10} style={{ color: pal?.color ?? "#ffffff60" }} />
                          </div>
                          <span className="text-[11px] text-white/40 group-hover:text-white/70 truncate flex-1">
                            {block.type==="heading"?block.text:block.type==="text"?block.text.slice(0,24)+(block.text.length>24?"…":""):block.type==="card"?block.title:BLOCK_LABELS[block.type]}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {block.hidden && <Icon name="EyeOff" size={8} className="text-orange-400/60" />}
                            {block.style_?.bgType && block.style_.bgType !== "none" && (
                              <div className="w-2 h-2 rounded-full" style={{
                                background: block.style_.bgType === "gradient"
                                  ? `linear-gradient(135deg,${block.style_.bgGradFrom},${block.style_.bgGradTo})`
                                  : block.style_.bgColor
                              }} />
                            )}
                            <span className="text-[8px] text-white/15">{block.zIndex??1}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
