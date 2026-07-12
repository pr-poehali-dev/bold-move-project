import React from "react";
import Icon from "@/components/ui/icon";
import type { ToolMode, PlanSettings, PlanState } from "./planTypes";
import type { SaveStatus } from "./usePlanStorage";
import type { PlanVariant } from "./usePlanVariants";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ToolbarProps {
  tool: ToolMode;
  phase: PlanState["phase"];
  isClosed: boolean;
  settings: PlanSettings;
  canUndo: boolean;
  canRedo: boolean;
  isMobile: boolean;
  saveStatus: SaveStatus;
  isDirty: boolean;
  isLoggedIn: boolean;
  currentPlanId: number | null;
  onToolChange: (t: ToolMode) => void;
  onSettingChange: (patch: Partial<PlanSettings>) => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onOpenPanel: () => void;
  onExport: () => void;
  onSave: () => void;
  onOpenLibrary: () => void;
  onBack?: () => void;
  backLabel?: string;
  roomSaveStatus?: "idle" | "saving" | "saved" | "error";
  onSaveVariant?: () => void;
  onOverwriteVariant?: () => void;
  variants?: PlanVariant[];
  variantsLoading?: boolean;
  activeVariantId?: number | null;
  onLoadVariant?: (id: number, data: object) => void;
  onDeleteVariant?: (id: number) => void;
  onRenameVariant?: (id: number, name: string) => void;
  onSelectVariant?: (id: number) => void;
  onVariantPickerOpenChange?: (open: boolean) => void;
  /** Мобиле: id проекта плана для фото (кнопка "Фото" в тулбаре) — undefined = проект не открыт */
  photosProjectId?: number | null;
  onOpenPhotos?: () => void;
}

// ── ToolDef ───────────────────────────────────────────────────────────────────

export interface ToolDef {
  id: ToolMode;
  icon: string;
  label: string;
  shortcut: string;
  needsClosed?: boolean;
  danger?: boolean;
  comingSoon?: boolean;
}

export const TOOLS: ToolDef[] = [
  { id: "draw",     icon: "Pencil",        label: "Рисовать",    shortcut: "D" },
  { id: "move",     icon: "MousePointer2", label: "Перемещение", shortcut: "V" },
  { id: "segment",  icon: "Minus",         label: "Отрезки",     shortcut: "S",  comingSoon: true },
  { id: "arc",      icon: "Spline",        label: "Дуги",        shortcut: "A",  comingSoon: true },
  { id: "dimline",  icon: "Ruler",         label: "Размеры",     shortcut: "R",  comingSoon: true },
  { id: "delete",   icon: "Eraser",        label: "Удалить",     shortcut: "X",  danger: true },
];

export const ALL_TOOLS_MENU: { id: ToolMode; icon: string; label: string; danger?: boolean; comingSoon?: boolean }[] = [
  { id: "draw",     icon: "Pencil",        label: "Рисовать"              },
  { id: "move",     icon: "MousePointer2", label: "Перемещение"           },
  { id: "segment",  icon: "Minus",         label: "Отрезки",    comingSoon: true },
  { id: "arc",      icon: "Spline",        label: "Дуги",       comingSoon: true },
  { id: "dimline",  icon: "Ruler",         label: "Размеры",    comingSoon: true },
  { id: "delete",   icon: "Eraser",        label: "Удалить элемент", danger: true },
];

// ── localStorage helpers ──────────────────────────────────────────────────────

export const DEFAULT_PINNED: ToolMode[] = ["draw", "move"];
export const LS_KEY = "plan_pinned_tools";

export function loadPinned(): ToolMode[] {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v) return JSON.parse(v);
  } catch { /* ignore */ }
  return DEFAULT_PINNED;
}

export function savePinned(pinned: ToolMode[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(pinned)); } catch { /* ignore */ }
}

// ── Shared UI atoms ───────────────────────────────────────────────────────────

export function ToolBtn({ t, active, disabled, onClick }: {
  t: ToolDef; active: boolean; disabled: boolean; onClick: () => void;
}) {
  const style = disabled
    ? "opacity-40 cursor-not-allowed bg-transparent border-transparent text-white"
    : active
      ? t.danger
        ? "bg-red-500/25 border-red-500/40 text-red-300"
        : "bg-white/95 text-[#111] border-white/80 shadow-sm"
      : t.danger
        ? "bg-transparent border-transparent text-white/35 hover:bg-red-500/10 hover:border-red-500/25 hover:text-red-300"
        : "bg-transparent border-transparent text-white/45 hover:bg-white/[0.07] hover:text-white";

  return (
    <button
      className={`relative flex flex-col items-center justify-center gap-0.5 px-2.5 py-1.5 min-w-[58px] rounded-lg border transition-all shrink-0 ${style}`}
      onClick={onClick}
      disabled={disabled}
      title={`${t.label} (${t.shortcut})`}
    >
      <Icon name={t.icon} size={14} />
      <span className={`text-[10px] font-medium leading-none whitespace-nowrap ${active && !t.danger ? "text-[#111]" : ""}`}>
        {t.label}
      </span>
    </button>
  );
}

export function IconBtn({ icon, onClick, disabled = false, title = "", size = 14 }: {
  icon: string; onClick?: () => void; disabled?: boolean; title?: string; size?: number;
}) {
  return (
    <button
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0 ${
        disabled
          ? "opacity-25 cursor-not-allowed text-white/20"
          : "text-white/45 hover:bg-white/[0.07] hover:text-white"
      }`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}

export function DropUp({ label, icon, children, badge }: {
  label: string; icon: string; children: React.ReactNode; badge?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState({ x: 0, y: 0 });
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const openMenu = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ x: r.left, y: r.bottom });
    }
    setOpen(v => !v);
  };

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        className={`flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-semibold rounded-lg border transition-all ${
          open
            ? "bg-white/[0.1] border-white/[0.15] text-white"
            : "bg-transparent border-white/[0.1] text-white/45 hover:text-white hover:border-white/20"
        }`}
        onClick={openMenu}
      >
        <Icon name={icon} size={12} />
        <span>{label}</span>
        {badge && <span className="bg-white/20 rounded px-1 text-[9px] font-bold ml-0.5">{badge}</span>}
        <Icon name="ChevronDown" size={9} className={`transition-transform opacity-60 ${open ? "rotate-180" : "rotate-0"}`} />
      </button>

      {open && (
        <div
          ref={menuRef}
          className="fixed z-[9999] bg-[#1c1c1c] border border-white/[0.12] rounded-xl shadow-2xl p-1.5 flex flex-col gap-0.5 min-w-[190px]"
          style={{ left: pos.x, top: pos.y + 4 }}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropItem({ active, label, icon, onClick }: {
  active: boolean; label: string; icon: string; onClick: () => void;
}) {
  return (
    <button
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all text-left w-full ${
        active ? "bg-white text-[#111]" : "text-white/60 hover:bg-white/[0.07] hover:text-white"
      }`}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <Icon name={icon} size={13} />
      <span className="flex-1">{label}</span>
      {active && <Icon name="Check" size={11} />}
    </button>
  );
}

export const Sep = () => <div className="w-px h-5 bg-white/[0.08] mx-1 flex-shrink-0" />;