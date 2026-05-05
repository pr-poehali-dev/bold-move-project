import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useBrand } from "@/context/BrandContext";
import type { NavButton, PageBlock, PageSettings } from "@/context/AuthContext";
import { updateBrand } from "./admin/own-agent/brandApi";
import func2url from "@/../backend/func2url.json";

import { genId, snap, defaultBlock, SNAP_EDGE } from "./editor/editorTypes";
import type { Handle } from "./editor/editorTypes";
import { EditorHeader } from "./editor/EditorHeader";
import { EditorCanvas } from "./editor/EditorCanvas";
import { EditorSidebar } from "./editor/EditorSidebar";

const PAGE_AI_URL = (func2url as Record<string, string>)["page-ai"];

interface Props { panelId: string; onBack: () => void; }

export default function PageEditor({ panelId, onBack }: Props) {
  const { token } = useAuth();
  const { brand, patchBrand } = useBrand();

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
  const [zoom, setZoom] = useState(1);

  const canvasRef = useRef<HTMLDivElement>(null);
  const paletteType = useRef<PageBlock["type"] | null>(null);
  const [isDroppingFromPalette, setIsDroppingFromPalette] = useState(false);

  const dragState = useRef<{
    type: "move" | "resize";
    id: string;
    handle?: Handle;
    startX: number; startY: number;
    origX: number; origY: number;
    origW: number; origH: number;
  } | null>(null);

  const GRID = settings.gridSize ?? 8;
  const SNAP = settings.snap ?? true;
  const CW = settings.canvasWidth ?? 390;
  const CH = settings.canvasHeight ?? 1200;

  // ── Block operations ──────────────────────────────────────────────────────
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

  // ── Snap to edges ─────────────────────────────────────────────────────────
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

  const onCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as Element).classList.contains("canvas-bg")) {
      setSelectedId(null);
    }
  };

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
      patchBrand({ nav_config: newNav });
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

  return (
    <div className="fixed inset-0 z-[200] bg-[#07070f] flex flex-col">

      <EditorHeader
        title={title}
        onTitleChange={setTitle}
        navBtnLabel={navBtn?.label}
        zoom={zoom}
        onZoomChange={setZoom}
        saving={saving}
        saved={saved}
        onSave={handleSave}
        aiPrompt={aiPrompt}
        onAiPromptChange={setAiPrompt}
        aiLoading={aiLoading}
        aiError={aiError}
        onAiApply={handleAi}
      />

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <EditorCanvas
          blocks={blocks}
          selectedId={selectedId}
          zoom={zoom}
          CW={CW}
          CH={CH}
          GRID={GRID}
          SNAP={SNAP}
          isDroppingFromPalette={isDroppingFromPalette}
          onCanvasClick={onCanvasClick}
          onCanvasDrop={onCanvasDrop}
          onBlockMouseDown={onBlockMouseDown}
          onHandleMouseDown={onHandleMouseDown}
          bringToFront={bringToFront}
          sendToBack={sendToBack}
          duplicateBlock={duplicateBlock}
          deleteBlock={deleteBlock}
          canvasRef={canvasRef}
        />

        <EditorSidebar
          blocks={blocks}
          selectedId={selectedId}
          sidebarTab={sidebarTab}
          settings={settings}
          token={token}
          paletteType={paletteType}
          onSidebarTabChange={setSidebarTab}
          onSelectId={setSelectedId}
          onSettingsChange={setSettings}
          addBlock={addBlock}
          setIsDroppingFromPalette={setIsDroppingFromPalette}
          updateBlock={updateBlock}
          deleteBlock={deleteBlock}
          duplicateBlock={duplicateBlock}
          bringToFront={bringToFront}
          sendToBack={sendToBack}
        />
      </div>
    </div>
  );
}