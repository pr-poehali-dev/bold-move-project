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
  comingSoon?: boolean;
}

const TOOLS: ToolDef[] = [
  { id: "draw",     icon: "Pencil",        label: "Рисовать",    shortcut: "D" },
  { id: "move",     icon: "MousePointer2", label: "Перемещение", shortcut: "V" },
  { id: "segment",  icon: "Minus",         label: "Отрезки",     shortcut: "S",  comingSoon: true },
  { id: "arc",      icon: "Spline",        label: "Дуги",        shortcut: "A",  comingSoon: true },
  { id: "dimline",  icon: "Ruler",         label: "Размеры",     shortcut: "R",  comingSoon: true },
];

function ToolBtn({ t, active, disabled, onClick }: {
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

function IconBtn({ icon, onClick, disabled = false, title = "", size = 14 }: {
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

function DropUp({ label, icon, children, badge }: {
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

function DropItem({ active, label, icon, onClick }: {
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

const Sep = () => <div className="w-px h-5 bg-white/[0.08] mx-1 flex-shrink-0" />;

// Раскрывающееся меню дополнительных инструментов (вместо кнопки "Отрезок")
const EXTRA_TOOLS = [
  { id: "segment" as ToolMode, icon: "Minus",  label: "Отрезки",        danger: false },
  { id: "delete"  as ToolMode, icon: "Eraser", label: "Удалить элемент", danger: true  },
];

function MobileToolDropdown({ tool, onToolChange }: {
  tool: ToolMode;
  onToolChange: (t: ToolMode) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const activeExtra = EXTRA_TOOLS.find(t => t.id === tool);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      {/* Дропдаун вверх */}
      {open && (
        <div className="absolute bottom-11 left-0 bg-[#1a1b2e] border border-white/[0.12] rounded-xl shadow-2xl p-1.5 flex flex-col gap-1 min-w-[160px] z-50">
          {EXTRA_TOOLS.map(t => (
            <button
              key={t.id}
              onClick={() => { onToolChange(t.id); setOpen(false); }}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all text-left w-full ${
                tool === t.id
                  ? t.danger ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" : "bg-white/10 text-white"
                  : t.danger ? "text-white/50 hover:bg-rose-500/10 hover:text-rose-300" : "text-white/50 hover:bg-white/[0.07] hover:text-white"
              }`}
            >
              <Icon name={t.icon} size={14} />
              <span>{t.label}</span>
              {tool === t.id && <Icon name="Check" size={11} className="ml-auto" />}
            </button>
          ))}
        </div>
      )}

      {/* Кнопка — показывает активный инструмент или Minus по умолчанию */}
      <button
        onClick={() => setOpen(v => !v)}
        title="Дополнительные инструменты"
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all relative ${
          activeExtra
            ? activeExtra.danger
              ? "bg-rose-500/25 border border-rose-500/40 text-rose-300"
              : "bg-white/95 text-[#111] border border-white/80"
            : open
              ? "bg-white/10 text-white"
              : "text-white/45 hover:text-white"
        }`}
      >
        <Icon name={activeExtra?.icon ?? "Minus"} size={16} />
        {/* Маленький индикатор раскрытия */}
        <span className="absolute bottom-1 right-1 w-1 h-1 rounded-full bg-current opacity-40" />
      </button>
    </div>
  );
}

function MobileToolbar(props: Props) {
  const {
    tool, isClosed,
    canUndo, canRedo,
    onToolChange, onUndo, onRedo, onOpenLibrary, onReset,
  } = props;

  const [confirmReset, setConfirmReset] = React.useState(false);

  return (
    <div className="bg-[#161616] border-b border-white/[0.08] shrink-0 flex items-center gap-0.5 px-2" style={{ height: 52 }}>
      <IconBtn icon="Undo2" onClick={onUndo} disabled={!canUndo} title="Отменить" />
      <IconBtn icon="Redo2" onClick={onRedo} disabled={!canRedo} title="Повторить" />
      <div className="w-px h-4 bg-white/10 mx-0.5 shrink-0" />
      {/* Инструменты — компактные иконки без подписей */}
      <div className="flex items-center gap-0.5 flex-1">
        {TOOLS.map(t => {
          // "segment" — раскрывающееся меню с дополнительными инструментами
          if (t.id === "segment") {
            return (
              <MobileToolDropdown
                key="extra-tools"
                tool={tool}
                onToolChange={onToolChange}
              />
            );
          }
          const disabled = !!t.comingSoon || (!!t.needsClosed && !isClosed);
          const active   = !t.comingSoon && tool === t.id;
          const style = disabled
            ? "opacity-40 cursor-not-allowed text-white"
            : active
              ? "bg-white/95 text-[#111] border border-white/80"
              : "text-white/45 hover:text-white";
          return (
            <button key={t.id}
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all ${style}`}
              disabled={disabled}
              title={t.label}
              onClick={() => !disabled && onToolChange(t.id)}>
              <Icon name={t.icon} size={16} />
            </button>
          );
        })}
      </div>

      {/* Очистить холст */}
      <div className="w-px h-4 bg-white/10 mx-0.5 shrink-0" />
      {confirmReset ? (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => { onReset(); setConfirmReset(false); }}
            className="h-8 px-2.5 rounded-lg bg-rose-600/80 border border-rose-400/30 text-white text-[11px] font-bold hover:bg-rose-600 transition active:scale-95"
          >
            Стереть
          </button>
          <button
            onClick={() => setConfirmReset(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:bg-white/[0.07] transition"
          >
            <Icon name="X" size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmReset(true)}
          title="Очистить холст"
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all text-white/35 hover:text-rose-400 hover:bg-rose-500/10"
        >
          <Icon name="Trash2" size={16} />
        </button>
      )}

      {/* Сохранённые — справа */}
      <div className="w-px h-4 bg-white/10 mx-0.5 shrink-0" />
      <button
        onClick={onOpenLibrary}
        title="Сохранённые планы"
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all text-white/45 hover:text-white hover:bg-white/[0.07]"
      >
        <Icon name="FolderOpen" size={16} />
      </button>
    </div>
  );
}

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

  const fnCount = [
    settings.ortho, settings.snapToPoints,
    settings.showGrid, settings.showPoints,
    settings.showDimLines, settings.showSegmentLabels,
    settings.showAngleLabels, settings.showDiagonals, settings.showPointLabels,
  ].filter(Boolean).length;

  return (
    <div className="flex items-center gap-0.5 px-2 bg-[#161616] border-b border-white/[0.08] shrink-0"
      style={{ height: 52, overflowX: "visible", overflowY: "visible" }}>

      {/* Лого */}
      <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shrink-0 mr-1.5">
        <Icon name="PenTool" size={13} className="text-[#111]" />
      </div>

      <Sep />

      {/* Undo / Redo */}
      <IconBtn icon="Undo2" onClick={onUndo} disabled={!canUndo} title="Отменить (Ctrl+Z)" />
      <IconBtn icon="Redo2" onClick={onRedo} disabled={!canRedo} title="Повторить (Ctrl+Y)" />

      <Sep />

      {/* ИНСТРУМЕНТЫ */}
      <div className="flex items-center gap-0 bg-white/[0.04] border border-white/[0.07] rounded-xl px-1 py-1 shrink-0">
        {TOOLS.map(t => {
          const disabled = !!t.comingSoon || (!!t.needsClosed && !isClosed);
          return (
            <ToolBtn key={t.id} t={t} active={!t.comingSoon && tool === t.id} disabled={disabled}
              onClick={() => !disabled && onToolChange(t.id)} />
          );
        })}
      </div>

      <Sep />

      {/* ФУНКЦИИ (объединяет Функции + Разметка + Слои) */}
      <DropUp label="Функции" icon="Zap" badge={fnCount > 0 ? String(fnCount) : undefined}>
        <div className="px-2 pt-1.5 pb-0.5">
          <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Рисование</p>
        </div>
        <DropItem active={settings.ortho} label="Ортогональный" icon="Axis3d"
          onClick={() => onSettingChange({ ortho: !settings.ortho })} />
        <DropItem active={settings.snapToPoints} label="Магнит к точкам" icon="Magnet"
          onClick={() => onSettingChange({ snapToPoints: !settings.snapToPoints })} />
        <div className="px-2 pt-2 pb-0.5">
          <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Разметка</p>
        </div>
        <DropItem active={settings.showGrid} label="Сетка" icon="Grid3x3"
          onClick={() => onSettingChange({ showGrid: !settings.showGrid })} />
        <DropItem active={settings.showPoints} label="Точки" icon="CircleDot"
          onClick={() => onSettingChange({ showPoints: !settings.showPoints })} />
        <div className="px-2 pt-2 pb-0.5">
          <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Слои</p>
        </div>
        <DropItem active={settings.showDimLines} label="Размерные линии" icon="ArrowLeftRight"
          onClick={() => onSettingChange({ showDimLines: !settings.showDimLines })} />
        <DropItem active={settings.showSegmentLabels} label="Подписи A-B" icon="Type"
          onClick={() => onSettingChange({ showSegmentLabels: !settings.showSegmentLabels })} />
        <DropItem active={settings.showAngleLabels} label="Метки углов" icon="Angle"
          onClick={() => onSettingChange({ showAngleLabels: !settings.showAngleLabels })} />
        <DropItem active={settings.showDiagonals} label="Диагонали" icon="ArrowUpRight"
          onClick={() => onSettingChange({ showDiagonals: !settings.showDiagonals })} />
        <DropItem active={settings.showPointLabels} label="Метки точек" icon="Tag"
          onClick={() => onSettingChange({ showPointLabels: !settings.showPointLabels })} />
      </DropUp>

      <Sep />

      {/* Zoom */}
      <IconBtn icon="ZoomOut" onClick={onZoomOut} title="Уменьшить (-)" />
      <span className="text-[11px] text-white/35 w-9 text-center font-mono shrink-0 select-none">
        {Math.round(settings.zoom * 100)}%
      </span>
      <IconBtn icon="ZoomIn" onClick={onZoomIn} title="Увеличить (+)" />
      <IconBtn icon="Maximize2" onClick={onZoomFit} title="По размеру (0)" size={13} />

      {/* Фаза */}


      <div className="flex-1 min-w-2" />

      <IconBtn icon="Download" onClick={onExport} title="Экспорт (E)" />
      <IconBtn icon="RotateCcw" onClick={onReset} title="Очистить" />

      <Sep />

      <button onClick={onOpenLibrary}
        className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-[11px] font-semibold border transition-all shrink-0 bg-transparent border-white/[0.1] text-white/45 hover:bg-white/[0.07] hover:text-white"
        title="Мои планы (L)">
        <Icon name="FolderOpen" size={12} />
        <span className="hidden md:inline">Планы</span>
      </button>

      <button onClick={onSave} disabled={saveStatus === "saving"}
        className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-[11px] font-bold border transition-all shrink-0 disabled:opacity-50 ${
          isDirty || !currentPlanId
            ? "bg-white text-[#111] border-white hover:bg-white/90"
            : "bg-white/[0.08] border-white/[0.15] text-white/60 hover:bg-white/[0.12]"
        }`}
        title="Сохранить (Ctrl+S)">
        <Icon name={saveIcon} size={12} className={saveStatus === "saving" ? "animate-spin" : ""} />
        <span>{saveLabel}</span>
      </button>
    </div>
  );
}