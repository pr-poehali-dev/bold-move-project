import React from "react";
import Icon from "@/components/ui/icon";
import type { ToolMode, PlanSettings, PlanState } from "./planTypes";

interface Props {
  tool: ToolMode;
  phase: PlanState["phase"];
  isClosed: boolean;
  settings: PlanSettings;
  canUndo: boolean;
  canRedo: boolean;
  isMobile: boolean;
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

export default function PlanToolbar({
  tool, phase, isClosed, settings, canUndo, canRedo, isMobile,
  onToolChange, onSettingChange, onUndo, onRedo, onReset,
  onZoomIn, onZoomOut, onZoomFit, onOpenPanel, onExport,
}: Props) {

  const [showMore, setShowMore] = React.useState(false);

  const toolBtn = (active: boolean, disabled: boolean, danger: boolean) =>
    [
      "relative flex-shrink-0 rounded-xl flex items-center justify-center transition-all border font-bold",
      isMobile ? "w-10 h-10" : "w-9 h-9",
      disabled
        ? "opacity-25 cursor-not-allowed bg-white/[0.02] border-white/[0.05] text-white/20"
        : active
          ? danger
            ? "bg-rose-500/25 border-rose-500/50 text-rose-200 shadow-lg shadow-rose-500/15"
            : "bg-violet-500/30 border-violet-500/60 text-violet-200 shadow-lg shadow-violet-500/20"
          : danger
            ? "bg-white/[0.03] border-white/[0.08] text-rose-400/60 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-300"
            : "bg-white/[0.03] border-white/[0.08] text-white/45 hover:bg-white/[0.08] hover:text-white/80",
    ].join(" ");

  const iconBtn = (disabled = false) =>
    [
      "flex-shrink-0 rounded-lg flex items-center justify-center transition-all border",
      isMobile ? "w-10 h-10" : "w-8 h-8",
      disabled
        ? "bg-white/[0.02] border-white/[0.05] text-white/20 cursor-not-allowed"
        : "bg-white/[0.03] border-white/[0.08] text-white/45 hover:bg-white/[0.08] hover:text-white/80",
    ].join(" ");

  const toggleBtn = (active: boolean, color = "violet") => {
    const base = isMobile ? "flex items-center gap-1 px-2 h-9 rounded-xl text-xs font-semibold border transition-all shrink-0"
                          : "flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[11px] font-semibold border transition-all shrink-0";
    const clr: Record<string, string> = {
      violet: active ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "bg-white/[0.03] border-white/[0.07] text-white/35",
      blue:   active ? "bg-blue-500/20 border-blue-500/40 text-blue-300"       : "bg-white/[0.03] border-white/[0.07] text-white/35",
      amber:  active ? "bg-amber-500/20 border-amber-500/40 text-amber-300"    : "bg-white/[0.03] border-white/[0.07] text-white/35",
    };
    return `${base} ${clr[color]}`;
  };

  const sep = <div className="w-px h-5 bg-white/[0.08] mx-0.5 flex-shrink-0" />;

  // ── МОБИЛЬНЫЙ TOOLBAR ──────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="bg-[#12131e] border-b border-white/[0.07] shrink-0">
        {/* Строка 1: лого + инструменты рисования + undo/redo */}
        <div className="flex items-center gap-1.5 px-2 h-14">
          {/* Лого */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shrink-0">
            <Icon name="PenTool" size={15} className="text-white" />
          </div>

          <div className="w-px h-5 bg-white/[0.08] mx-0.5 shrink-0" />

          {/* Undo/Redo */}
          <button className={iconBtn(!canUndo)} onClick={onUndo} disabled={!canUndo}>
            <Icon name="Undo2" size={16} />
          </button>
          <button className={iconBtn(!canRedo)} onClick={onRedo} disabled={!canRedo}>
            <Icon name="Redo2" size={16} />
          </button>

          <div className="w-px h-5 bg-white/[0.08] mx-0.5 shrink-0" />

          {/* Инструменты — скролл горизонтально */}
          <div className="flex items-center gap-1.5 overflow-x-auto flex-1 no-scrollbar">
            {TOOLS.map(t => {
              const disabled = !!t.needsClosed && !isClosed;
              return (
                <button key={t.id}
                  className={toolBtn(tool === t.id, disabled, !!t.danger)}
                  onClick={() => !disabled && onToolChange(t.id)}
                  disabled={disabled}
                  title={t.label}
                >
                  <Icon name={t.icon} size={16} />
                </button>
              );
            })}
          </div>

          <div className="w-px h-5 bg-white/[0.08] mx-0.5 shrink-0" />

          {/* Кнопка панели */}
          <button
            onClick={onOpenPanel}
            className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/40 text-violet-300 flex items-center justify-center shrink-0"
            title="Открыть панель"
          >
            <Icon name="PanelRight" size={16} />
          </button>
        </div>

        {/* Строка 2: переключатели орто/магнит/сетка + zoom */}
        <div className="flex items-center gap-1.5 px-2 pb-2">
          <button className={toggleBtn(settings.ortho, "violet")}
            onClick={() => onSettingChange({ ortho: !settings.ortho })}>
            <Icon name="Axis3d" size={12} />
            <span>Орто</span>
          </button>
          <button className={toggleBtn(settings.snapToPoints, "blue")}
            onClick={() => onSettingChange({ snapToPoints: !settings.snapToPoints })}>
            <Icon name="Magnet" size={12} />
            <span>Магнит</span>
          </button>
          <button className={toggleBtn(settings.showGrid, "violet")}
            onClick={() => onSettingChange({ showGrid: !settings.showGrid })}>
            <Icon name="Grid3x3" size={12} />
          </button>

          <div className="flex-1" />

          {/* Zoom */}
          <button className={iconBtn()} onClick={onZoomOut}><Icon name="ZoomOut" size={14} /></button>
          <span className="text-[10px] text-white/30 font-mono w-9 text-center shrink-0">
            {Math.round(settings.zoom * 100)}%
          </span>
          <button className={iconBtn()} onClick={onZoomIn}><Icon name="ZoomIn" size={14} /></button>
          <button className={iconBtn()} onClick={onZoomFit}><Icon name="Maximize2" size={13} /></button>

          {/* Экспорт */}
          <button onClick={onExport}
            className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 flex items-center justify-center transition-all shrink-0"
            title="Экспортировать">
            <Icon name="Download" size={14} />
          </button>

          {/* Очистить */}
          <button onClick={onReset}
            className="w-9 h-9 rounded-lg bg-white/[0.02] border border-white/[0.06] text-rose-400/50 hover:bg-rose-500/10 flex items-center justify-center transition-all shrink-0">
            <Icon name="RotateCcw" size={14} />
          </button>
        </div>

        {/* Индикатор фазы */}
        {phase !== "draw" && isClosed && (
          <div className={`mx-2 mb-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
            phase === "lengths"
              ? "bg-blue-500/15 border-blue-500/30 text-blue-300"
              : "bg-amber-500/15 border-amber-500/30 text-amber-300"
          }`}>
            <Icon name={phase === "lengths" ? "Ruler" : "Angle"} size={13} />
            {phase === "lengths" ? "Введи длины сторон в панели →" : "Введи углы в панели →"}
          </div>
        )}
      </div>
    );
  }

  // ── ДЕСКТОП TOOLBAR ────────────────────────────────────────────────────────
  return (
    <div className="flex items-center gap-1.5 px-3 bg-[#12131e] border-b border-white/[0.07] shrink-0 overflow-x-auto" style={{ height: 52 }}>

      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shrink-0">
        <Icon name="PenTool" size={14} className="text-white" />
      </div>
      <span className="text-[13px] font-bold text-white/70 hidden lg:block shrink-0">Построитель</span>

      {sep}

      <button className={iconBtn(!canUndo)} onClick={onUndo} disabled={!canUndo} title="Отменить (Ctrl+Z)">
        <Icon name="Undo2" size={15} />
      </button>
      <button className={iconBtn(!canRedo)} onClick={onRedo} disabled={!canRedo} title="Повторить (Ctrl+Y)">
        <Icon name="Redo2" size={15} />
      </button>

      {sep}

      {TOOLS.map(t => {
        const disabled = !!t.needsClosed && !isClosed;
        return (
          <button key={t.id}
            className={toolBtn(tool === t.id, disabled, !!t.danger)}
            onClick={() => !disabled && onToolChange(t.id)}
            disabled={disabled}
            title={`${t.label} (${t.shortcut})`}>
            <Icon name={t.icon} size={15} />
            {tool === t.id && !disabled && (
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-current opacity-70" />
            )}
          </button>
        );
      })}

      {sep}

      <button className={toggleBtn(settings.ortho, "violet")} onClick={() => onSettingChange({ ortho: !settings.ortho })} title="Ортогональное (O)">
        <Icon name="Axis3d" size={12} /><span className="hidden xl:inline">Орто</span>
      </button>
      <button className={toggleBtn(settings.snapToPoints, "blue")} onClick={() => onSettingChange({ snapToPoints: !settings.snapToPoints })} title="Магнит (M)">
        <Icon name="Magnet" size={12} /><span className="hidden xl:inline">Магнит</span>
      </button>
      <button className={toggleBtn(settings.showGrid, "violet")} onClick={() => onSettingChange({ showGrid: !settings.showGrid })} title="Сетка">
        <Icon name="Grid3x3" size={12} /><span className="hidden xl:inline">Сетка</span>
      </button>
      <button className={toggleBtn(settings.showPoints, "blue")} onClick={() => onSettingChange({ showPoints: !settings.showPoints })} title="Точки">
        <Icon name="CircleDot" size={12} /><span className="hidden xl:inline">Точки</span>
      </button>

      {sep}

      {/* Видимость — под кнопкой "Ещё" на десктопе */}
      <button onClick={() => setShowMore(v => !v)}
        className={toggleBtn(showMore, "amber")}>
        <Icon name="Layers" size={12} />
        <span className="hidden md:inline">Слои</span>
        <Icon name={showMore ? "ChevronUp" : "ChevronDown"} size={10} />
      </button>

      {showMore && (
        <div className="flex items-center gap-1">
          <button className={toggleBtn(settings.showSegmentLabels, "amber")} onClick={() => onSettingChange({ showSegmentLabels: !settings.showSegmentLabels })}>
            <Icon name="Type" size={11} /><span className="hidden xl:inline">Стороны</span>
          </button>
          <button className={toggleBtn(settings.showAngleLabels, "amber")} onClick={() => onSettingChange({ showAngleLabels: !settings.showAngleLabels })}>
            <Icon name="Angle" size={11} /><span className="hidden xl:inline">Углы</span>
          </button>
          <button className={toggleBtn(settings.showDiagonals, "amber")} onClick={() => onSettingChange({ showDiagonals: !settings.showDiagonals })}>
            <Icon name="ArrowUpRight" size={11} /><span className="hidden xl:inline">Диаг</span>
          </button>
          <button className={toggleBtn(settings.showDimLines, "amber")} onClick={() => onSettingChange({ showDimLines: !settings.showDimLines })}>
            <Icon name="Ruler" size={11} /><span className="hidden xl:inline">Размеры</span>
          </button>
        </div>
      )}

      {sep}

      <button className={iconBtn()} onClick={onZoomOut} title="Уменьшить (-)"><Icon name="ZoomOut" size={14} /></button>
      <span className="text-[11px] text-white/35 w-9 text-center font-mono shrink-0">{Math.round(settings.zoom * 100)}%</span>
      <button className={iconBtn()} onClick={onZoomIn} title="Увеличить (+)"><Icon name="ZoomIn" size={14} /></button>
      <button className={iconBtn()} onClick={onZoomFit} title="По размеру (0)"><Icon name="Maximize2" size={13} /></button>

      {sep}

      {phase !== "draw" && isClosed && (
        <div className={`flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[11px] font-bold border shrink-0 ${
          phase === "lengths" ? "bg-blue-500/15 border-blue-500/30 text-blue-300" : "bg-amber-500/15 border-amber-500/30 text-amber-300"
        }`}>
          <Icon name={phase === "lengths" ? "Ruler" : "Angle"} size={12} />
          <span className="hidden sm:inline">{phase === "lengths" ? "Ввод длин" : "Ввод углов"}</span>
        </div>
      )}

      <div className="flex-1 min-w-2" />

      <button onClick={onExport}
        className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-[11px] font-semibold border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all shrink-0"
        title="Экспорт SVG / PNG">
        <Icon name="Download" size={12} />
        <span className="hidden sm:inline">Экспорт</span>
      </button>

      <button onClick={onReset}
        className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-[11px] font-semibold border bg-white/[0.02] border-white/[0.06] text-rose-400/50 hover:bg-rose-500/10 hover:text-rose-300 transition-all shrink-0">
        <Icon name="RotateCcw" size={12} />
        <span className="hidden sm:inline">Очистить</span>
      </button>
    </div>
  );
}