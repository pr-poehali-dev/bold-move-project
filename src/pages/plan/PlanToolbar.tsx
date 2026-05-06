import React from "react";
import Icon from "@/components/ui/icon";
import type { ToolMode, PlanSettings, PlanState } from "./planTypes";
import type { SaveStatus } from "./usePlanStorage";

interface Props {
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
}

interface ToolDef {
  id: ToolMode;
  icon: string;
  label: string;
  shortcut: string;
  needsClosed?: boolean;
  danger?: boolean;
}

const TOOLS: ToolDef[] = [
  { id: "draw",     icon: "Pencil",        label: "Рисовать",       shortcut: "D" },
  { id: "move",     icon: "MousePointer2", label: "Перемещение",    shortcut: "V" },
  { id: "segment",  icon: "Minus",         label: "Отрезки",        shortcut: "S" },
  { id: "diagonal", icon: "ArrowUpRight",  label: "Диагонали",      shortcut: "G", needsClosed: true },
  { id: "arc",      icon: "Spline",        label: "Дуги",           shortcut: "A" },
  { id: "dimline",  icon: "Ruler",         label: "Размеры",        shortcut: "R", needsClosed: true },
  { id: "delete",   icon: "Trash2",        label: "Удалить",        shortcut: "X", danger: true },
];

// ─── Общие стили ──────────────────────────────────────────────────────────────

const ghost = "bg-transparent border-transparent hover:bg-white/[0.07] hover:border-white/[0.12]";

function ToolBtn({ t, active, disabled, isMobile, onClick }: {
  t: ToolDef; active: boolean; disabled: boolean; isMobile: boolean; onClick: () => void;
}) {
  const base = isMobile
    ? "relative flex flex-col items-center justify-center gap-0.5 w-12 h-12 rounded-xl border transition-all shrink-0"
    : "relative flex flex-col items-center justify-center gap-0.5 w-11 h-11 rounded-xl border transition-all shrink-0";

  const style = disabled
    ? "opacity-20 cursor-not-allowed bg-transparent border-transparent text-white/30"
    : active
      ? t.danger
        ? "bg-red-500/20 border-red-500/50 text-red-300 shadow shadow-red-500/10"
        : "bg-white text-black border-white shadow shadow-white/10"
      : t.danger
        ? "bg-transparent border-transparent text-white/40 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-300"
        : `${ghost} text-white/50 hover:text-white`;

  return (
    <button className={`${base} ${style}`} onClick={onClick} disabled={disabled}
      title={`${t.label} (${t.shortcut})`}>
      <Icon name={t.icon} size={isMobile ? 17 : 15} />
      <span className={`text-[9px] font-medium leading-none ${active && !t.danger ? "text-black" : ""}`}>
        {t.label}
      </span>
    </button>
  );
}

function IconBtn({ icon, onClick, disabled = false, title = "", size = 14, isMobile = false }: {
  icon: string; onClick?: () => void; disabled?: boolean; title?: string; size?: number; isMobile?: boolean;
}) {
  const dim = isMobile ? "w-10 h-10" : "w-8 h-8";
  return (
    <button
      className={`${dim} rounded-lg flex items-center justify-center transition-all border shrink-0 ${
        disabled
          ? "opacity-25 cursor-not-allowed bg-transparent border-transparent text-white/20"
          : `${ghost} text-white/45 hover:text-white`
      }`}
      onClick={onClick} disabled={disabled} title={title}>
      <Icon name={icon} size={size} />
    </button>
  );
}

function ToggleBtn({ active, label, icon, onClick, isMobile = false }: {
  active: boolean; label: string; icon: string; onClick: () => void; isMobile?: boolean;
}) {
  const h = isMobile ? "h-8 px-2.5 text-xs rounded-xl gap-1.5" : "h-7 px-2.5 text-[11px] rounded-lg gap-1.5";
  return (
    <button
      className={`flex items-center ${h} font-semibold border transition-all shrink-0 ${
        active
          ? "bg-white text-black border-white"
          : `bg-transparent border-white/[0.12] text-white/45 hover:text-white hover:border-white/25`
      }`}
      onClick={onClick}>
      <Icon name={icon} size={12} />
      <span>{label}</span>
    </button>
  );
}

function DropGroup({ label, icon, children, isMobile = false }: {
  label: string; icon: string; children: React.ReactNode; isMobile?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const h = isMobile ? "h-8 px-2.5 text-xs rounded-xl gap-1.5" : "h-7 px-2.5 text-[11px] rounded-lg gap-1.5";

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        className={`flex items-center ${h} font-semibold border transition-all ${
          open
            ? "bg-white/10 border-white/20 text-white"
            : "bg-transparent border-white/[0.12] text-white/45 hover:text-white hover:border-white/25"
        }`}
        onClick={() => setOpen(v => !v)}>
        <Icon name={icon} size={12} />
        <span>{label}</span>
        <Icon name={open ? "ChevronUp" : "ChevronDown"} size={10} className="ml-0.5 opacity-60" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-[#111] border border-white/[0.12] rounded-xl shadow-2xl p-2 flex flex-col gap-1 min-w-[160px]">
          {children}
        </div>
      )}
    </div>
  );
}

function DropItem({ active, label, icon, onClick }: {
  active: boolean; label: string; icon: string; onClick: () => void;
}) {
  return (
    <button
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all ${
        active ? "bg-white text-black" : "text-white/60 hover:bg-white/[0.07] hover:text-white"
      }`}
      onClick={onClick}>
      <Icon name={icon} size={13} />
      {label}
      {active && <Icon name="Check" size={11} className="ml-auto" />}
    </button>
  );
}

const Sep = () => <div className="w-px h-5 bg-white/[0.1] mx-1 flex-shrink-0" />;

// ─── МОБИЛЬНЫЙ ────────────────────────────────────────────────────────────────
function MobileToolbar(props: Props) {
  const {
    tool, phase, isClosed, settings, canUndo, canRedo,
    saveStatus, isDirty, currentPlanId,
    onToolChange, onSettingChange, onUndo, onRedo, onSave, onOpenPanel,
  } = props;

  const saveLabel = saveStatus === "saving" ? "Сохранение…" : saveStatus === "saved" ? "Сохранён" : "Сохранить";
  const saveIcon  = saveStatus === "saving" ? "Loader2" : saveStatus === "saved" ? "CheckCircle2" : isDirty ? "Save" : "Cloud";

  return (
    <div className="bg-black border-b border-white/[0.08] shrink-0">
      {/* Строка 1 */}
      <div className="flex items-center gap-1.5 px-2 h-13 pt-1">
        <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shrink-0">
          <Icon name="PenTool" size={14} className="text-black" />
        </div>
        <div className="w-px h-4 bg-white/10 mx-0.5 shrink-0" />
        <IconBtn icon="Undo2" onClick={onUndo} disabled={!canUndo} isMobile title="Отменить" />
        <IconBtn icon="Redo2" onClick={onRedo} disabled={!canRedo} isMobile title="Повторить" />
        <div className="w-px h-4 bg-white/10 mx-0.5 shrink-0" />

        {/* Инструменты */}
        <div className="flex items-center gap-1 overflow-x-auto flex-1 no-scrollbar">
          {TOOLS.map(t => (
            <ToolBtn key={t.id} t={t} active={tool === t.id}
              disabled={!!t.needsClosed && !isClosed} isMobile
              onClick={() => !t.needsClosed || isClosed ? onToolChange(t.id) : undefined} />
          ))}
        </div>

        <div className="w-px h-4 bg-white/10 mx-0.5 shrink-0" />
        <button onClick={onOpenPanel}
          className="w-9 h-9 rounded-xl bg-white/[0.08] border border-white/[0.12] text-white/60 flex items-center justify-center shrink-0">
          <Icon name="PanelRight" size={16} />
        </button>
      </div>

      {/* Строка 2 */}
      <div className="flex items-center gap-1.5 px-2 pb-2 pt-1">
        <ToggleBtn active={settings.ortho} label="Ортогональный" icon="Axis3d" isMobile
          onClick={() => onSettingChange({ ortho: !settings.ortho })} />
        <ToggleBtn active={settings.snapToPoints} label="Магнит" icon="Magnet" isMobile
          onClick={() => onSettingChange({ snapToPoints: !settings.snapToPoints })} />
        <ToggleBtn active={settings.showGrid} label="Сетка" icon="Grid3x3" isMobile
          onClick={() => onSettingChange({ showGrid: !settings.showGrid })} />
        <div className="flex-1" />
        <button onClick={onSave} disabled={saveStatus === "saving"}
          className={`flex items-center gap-1.5 px-3 h-8 rounded-xl text-[11px] font-bold border transition-all shrink-0 ${
            isDirty || !currentPlanId
              ? "bg-white text-black border-white"
              : "bg-transparent border-white/[0.12] text-white/45"
          }`}>
          <Icon name={saveIcon} size={12} className={saveStatus === "saving" ? "animate-spin" : ""} />
          <span>{saveLabel}</span>
        </button>
      </div>

      {/* Фаза */}
      {phase !== "draw" && isClosed && (
        <div className={`mx-2 mb-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
          phase === "lengths" ? "bg-white/10 border-white/20 text-white" : "bg-white/[0.07] border-white/[0.12] text-white/70"
        }`}>
          <Icon name={phase === "lengths" ? "Ruler" : "Angle"} size={13} />
          {phase === "lengths" ? "Введи длины сторон →" : "Введи углы →"}
        </div>
      )}
    </div>
  );
}

// ─── ДЕСКТОП ──────────────────────────────────────────────────────────────────
export default function PlanToolbar(props: Props) {
  const {
    tool, phase, isClosed, settings, canUndo, canRedo, isMobile,
    saveStatus, isDirty, currentPlanId,
    onToolChange, onSettingChange, onUndo, onRedo, onReset,
    onZoomIn, onZoomOut, onZoomFit, onExport, onSave, onOpenLibrary,
  } = props;

  if (isMobile) return <MobileToolbar {...props} />;

  const saveLabel = saveStatus === "saving" ? "Сохранение…" : saveStatus === "saved" ? "Сохранён" : "Сохранить";
  const saveIcon  = saveStatus === "saving" ? "Loader2" : saveStatus === "saved" ? "CheckCircle2" : isDirty ? "Save" : "Cloud";

  return (
    <div
      className="flex items-center gap-0.5 px-3 bg-black border-b border-white/[0.08] shrink-0 overflow-x-auto"
      style={{ height: 56 }}>

      {/* ── Лого ── */}
      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 mr-1">
        <Icon name="PenTool" size={14} className="text-black" />
      </div>
      <span className="text-[13px] font-bold text-white/80 hidden lg:block shrink-0 mr-1">Построитель</span>

      <Sep />

      {/* ── Undo / Redo ── */}
      <IconBtn icon="Undo2" onClick={onUndo} disabled={!canUndo} title="Отменить (Ctrl+Z)" />
      <IconBtn icon="Redo2" onClick={onRedo} disabled={!canRedo} title="Повторить (Ctrl+Y)" />

      <Sep />

      {/* ── ИНСТРУМЕНТЫ — центральный блок ── */}
      <div className="flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.08] rounded-xl px-1.5 py-1 shrink-0">
        {TOOLS.map(t => {
          const disabled = !!t.needsClosed && !isClosed;
          return (
            <ToolBtn key={t.id} t={t} active={tool === t.id} disabled={disabled} isMobile={false}
              onClick={() => !disabled && onToolChange(t.id)} />
          );
        })}
      </div>

      <Sep />

      {/* ── ФУНКЦИИ ── */}
      <ToggleBtn active={settings.ortho} label="Ортогональный" icon="Axis3d"
        onClick={() => onSettingChange({ ortho: !settings.ortho })} />
      <ToggleBtn active={settings.snapToPoints} label="Магнит" icon="Magnet"
        onClick={() => onSettingChange({ snapToPoints: !settings.snapToPoints })} />

      <Sep />

      {/* ── РАЗМЕТКА ── */}
      <DropGroup label="Разметка" icon="Layers">
        <DropItem active={settings.showGrid} label="Сетка" icon="Grid3x3"
          onClick={() => onSettingChange({ showGrid: !settings.showGrid })} />
        <DropItem active={settings.showPoints} label="Точки" icon="CircleDot"
          onClick={() => onSettingChange({ showPoints: !settings.showPoints })} />
      </DropGroup>

      {/* ── СЛОИ ── */}
      <DropGroup label="Слои" icon="Eye">
        <DropItem active={settings.showSegmentLabels} label="Стороны" icon="Ruler"
          onClick={() => onSettingChange({ showSegmentLabels: !settings.showSegmentLabels })} />
        <DropItem active={settings.showAngleLabels} label="Углы" icon="Angle"
          onClick={() => onSettingChange({ showAngleLabels: !settings.showAngleLabels })} />
        <DropItem active={settings.showDiagonals} label="Диагонали" icon="ArrowUpRight"
          onClick={() => onSettingChange({ showDiagonals: !settings.showDiagonals })} />
        <DropItem active={settings.showDimLines} label="Размерные линии" icon="ArrowLeftRight"
          onClick={() => onSettingChange({ showDimLines: !settings.showDimLines })} />
        <DropItem active={settings.showPointLabels} label="Метки точек" icon="Tag"
          onClick={() => onSettingChange({ showPointLabels: !settings.showPointLabels })} />
      </DropGroup>

      <Sep />

      {/* ── Zoom ── */}
      <IconBtn icon="ZoomOut" onClick={onZoomOut} title="Уменьшить (-)" />
      <span className="text-[11px] text-white/35 w-9 text-center font-mono shrink-0 select-none">
        {Math.round(settings.zoom * 100)}%
      </span>
      <IconBtn icon="ZoomIn" onClick={onZoomIn} title="Увеличить (+)" />
      <IconBtn icon="Maximize2" onClick={onZoomFit} title="По размеру (0)" size={13} />

      <Sep />

      {/* ── Фаза ── */}
      {phase !== "draw" && isClosed && (
        <div className={`flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-[11px] font-bold border shrink-0 ${
          phase === "lengths" ? "bg-white/10 border-white/20 text-white" : "bg-white/[0.07] border-white/[0.12] text-white/70"
        }`}>
          <Icon name={phase === "lengths" ? "Ruler" : "Angle"} size={12} />
          <span>{phase === "lengths" ? "Ввод длин" : "Ввод углов"}</span>
        </div>
      )}

      <div className="flex-1 min-w-2" />

      {/* ── Экспорт / Очистить ── */}
      <IconBtn icon="Download" onClick={onExport} title="Экспорт (E)" />
      <IconBtn icon="RotateCcw" onClick={onReset} title="Очистить" />

      <Sep />

      {/* ── Мои планы ── */}
      <button onClick={onOpenLibrary}
        className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-[11px] font-semibold border transition-all shrink-0 ${ghost} text-white/45 hover:text-white border-white/[0.12]`}
        title="Мои планы (L)">
        <Icon name="FolderOpen" size={12} />
        <span className="hidden md:inline">Планы</span>
      </button>

      {/* ── Сохранить ── */}
      <button onClick={onSave} disabled={saveStatus === "saving"}
        className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-[11px] font-bold border transition-all shrink-0 disabled:opacity-50 ${
          isDirty || !currentPlanId
            ? "bg-white text-black border-white hover:bg-white/90"
            : "bg-white/[0.08] border-white/[0.15] text-white/60 hover:bg-white/[0.12]"
        }`}
        title="Сохранить (Ctrl+S)">
        <Icon name={saveIcon} size={12} className={saveStatus === "saving" ? "animate-spin" : ""} />
        <span>{saveLabel}</span>
      </button>
    </div>
  );
}
