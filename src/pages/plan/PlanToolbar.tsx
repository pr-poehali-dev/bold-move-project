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
  onToolChange: (t: ToolMode) => void;
  onSettingChange: (patch: Partial<PlanSettings>) => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
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
  { id: "draw",     icon: "Pencil",        label: "Рисовать",          shortcut: "D" },
  { id: "move",     icon: "MousePointer2", label: "Перемещение",       shortcut: "V" },
  { id: "segment",  icon: "Minus",         label: "Редактор отрезков", shortcut: "S" },
  { id: "diagonal", icon: "ArrowUpRight",  label: "Диагонали",         shortcut: "G", needsClosed: true },
  { id: "arc",      icon: "Spline",        label: "Дуги / скругления", shortcut: "A" },
  { id: "dimline",  icon: "Ruler",         label: "Размерные линии",   shortcut: "R", needsClosed: true },
  { id: "delete",   icon: "Trash2",        label: "Удаление",          shortcut: "X", danger: true },
];

export default function PlanToolbar({
  tool, phase, isClosed, settings, canUndo, canRedo,
  onToolChange, onSettingChange, onUndo, onRedo, onReset,
  onZoomIn, onZoomOut, onZoomFit,
}: Props) {

  const toolBtn = (active: boolean, disabled: boolean, danger: boolean) =>
    [
      "relative w-9 h-9 rounded-xl flex items-center justify-center transition-all border text-[13px] font-bold shrink-0",
      disabled ? "opacity-25 cursor-not-allowed bg-white/[0.02] border-white/[0.05] text-white/20"
        : active
          ? danger
            ? "bg-rose-500/25 border-rose-500/50 text-rose-300 shadow-lg shadow-rose-500/15"
            : "bg-violet-500/30 border-violet-500/60 text-violet-200 shadow-lg shadow-violet-500/20"
          : danger
            ? "bg-white/[0.03] border-white/[0.08] text-rose-400/60 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-300"
            : "bg-white/[0.03] border-white/[0.08] text-white/45 hover:bg-white/[0.08] hover:text-white/80",
    ].join(" ");

  const iconBtn = (disabled = false) =>
    [
      "w-8 h-8 rounded-lg flex items-center justify-center transition-all border shrink-0",
      disabled
        ? "bg-white/[0.02] border-white/[0.05] text-white/20 cursor-not-allowed"
        : "bg-white/[0.03] border-white/[0.08] text-white/45 hover:bg-white/[0.08] hover:text-white/80",
    ].join(" ");

  const toggleBtn = (active: boolean, color = "violet") => {
    const colors: Record<string, string> = {
      violet: active ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "bg-white/[0.03] border-white/[0.07] text-white/35 hover:bg-white/[0.06] hover:text-white/60",
      blue:   active ? "bg-blue-500/20 border-blue-500/40 text-blue-300"       : "bg-white/[0.03] border-white/[0.07] text-white/35 hover:bg-white/[0.06] hover:text-white/60",
      amber:  active ? "bg-amber-500/20 border-amber-500/40 text-amber-300"    : "bg-white/[0.03] border-white/[0.07] text-white/35 hover:bg-white/[0.06] hover:text-white/60",
    };
    return `flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[11px] font-semibold border transition-all shrink-0 ${colors[color]}`;
  };

  const sep = <div className="w-px h-5 bg-white/[0.08] mx-0.5 shrink-0" />;

  return (
    <div className="flex items-center gap-1.5 px-3 h-13 bg-[#12131e] border-b border-white/[0.07] shrink-0 overflow-x-auto" style={{ height: 52 }}>

      {/* Лого */}
      <div className="flex items-center gap-2 mr-1 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
          <Icon name="PenTool" size={14} className="text-white" />
        </div>
        <span className="text-[13px] font-bold text-white/70 hidden lg:block">Построитель</span>
      </div>

      {sep}

      {/* Undo / Redo */}
      <button className={iconBtn(!canUndo)} onClick={onUndo} disabled={!canUndo} title="Отменить (Ctrl+Z)">
        <Icon name="Undo2" size={15} />
      </button>
      <button className={iconBtn(!canRedo)} onClick={onRedo} disabled={!canRedo} title="Повторить (Ctrl+Y)">
        <Icon name="Redo2" size={15} />
      </button>

      {sep}

      {/* Инструменты */}
      {TOOLS.map(t => {
        const disabled = !!t.needsClosed && !isClosed;
        return (
          <button
            key={t.id}
            className={toolBtn(tool === t.id, disabled, !!t.danger)}
            onClick={() => !disabled && onToolChange(t.id)}
            disabled={disabled}
            title={`${t.label} (${t.shortcut})`}
          >
            <Icon name={t.icon} size={15} />
            {/* Индикатор активного инструмента */}
            {tool === t.id && !disabled && (
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-current opacity-70" />
            )}
          </button>
        );
      })}

      {sep}

      {/* Орто / Магнит / Сетка / Точки */}
      <button className={toggleBtn(settings.ortho, "violet")}
        onClick={() => onSettingChange({ ortho: !settings.ortho })} title="Ортогональное черчение (O)">
        <Icon name="Axis3d" size={12} />
        <span className="hidden xl:inline">Орто</span>
      </button>
      <button className={toggleBtn(settings.snapToPoints, "blue")}
        onClick={() => onSettingChange({ snapToPoints: !settings.snapToPoints })} title="Магнит к точкам (M)">
        <Icon name="Magnet" size={12} />
        <span className="hidden xl:inline">Магнит</span>
      </button>
      <button className={toggleBtn(settings.showGrid, "violet")}
        onClick={() => onSettingChange({ showGrid: !settings.showGrid })} title="Сетка">
        <Icon name="Grid3x3" size={12} />
        <span className="hidden xl:inline">Сетка</span>
      </button>
      <button className={toggleBtn(settings.showPoints, "blue")}
        onClick={() => onSettingChange({ showPoints: !settings.showPoints })} title="Точки">
        <Icon name="CircleDot" size={12} />
        <span className="hidden xl:inline">Точки</span>
      </button>

      {sep}

      {/* Видимость слоёв */}
      <button className={toggleBtn(settings.showSegmentLabels, "amber")}
        onClick={() => onSettingChange({ showSegmentLabels: !settings.showSegmentLabels })} title="Метки сторон">
        <Icon name="Type" size={12} />
        <span className="hidden xl:inline">Стороны</span>
      </button>
      <button className={toggleBtn(settings.showAngleLabels, "amber")}
        onClick={() => onSettingChange({ showAngleLabels: !settings.showAngleLabels })} title="Метки углов">
        <Icon name="Angle" size={12} />
        <span className="hidden xl:inline">Углы</span>
      </button>
      <button className={toggleBtn(settings.showDiagonals, "amber")}
        onClick={() => onSettingChange({ showDiagonals: !settings.showDiagonals })} title="Диагонали">
        <Icon name="ArrowUpRight" size={12} />
        <span className="hidden xl:inline">Диаг</span>
      </button>
      <button className={toggleBtn(settings.showDimLines, "amber")}
        onClick={() => onSettingChange({ showDimLines: !settings.showDimLines })} title="Размерные линии">
        <Icon name="Ruler" size={12} />
        <span className="hidden xl:inline">Размеры</span>
      </button>

      {sep}

      {/* Zoom */}
      <button className={iconBtn()} onClick={onZoomOut} title="Уменьшить (-)">
        <Icon name="ZoomOut" size={14} />
      </button>
      <span className="text-[11px] text-white/35 w-9 text-center font-mono shrink-0">
        {Math.round(settings.zoom * 100)}%
      </span>
      <button className={iconBtn()} onClick={onZoomIn} title="Увеличить (+)">
        <Icon name="ZoomIn" size={14} />
      </button>
      <button className={iconBtn()} onClick={onZoomFit} title="По размеру (0)">
        <Icon name="Maximize2" size={13} />
      </button>

      {sep}

      {/* Фаза */}
      {phase !== "draw" && isClosed && (
        <div className={`flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[11px] font-bold border shrink-0 ${
          phase === "lengths"
            ? "bg-blue-500/15 border-blue-500/30 text-blue-300"
            : "bg-amber-500/15 border-amber-500/30 text-amber-300"
        }`}>
          <Icon name={phase === "lengths" ? "Ruler" : "Angle"} size={12} />
          <span className="hidden sm:inline">{phase === "lengths" ? "Ввод длин" : "Ввод углов"}</span>
        </div>
      )}

      <div className="flex-1 min-w-2" />

      {/* Сброс */}
      <button
        onClick={onReset}
        className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-[11px] font-semibold border bg-white/[0.02] border-white/[0.06] text-rose-400/50 hover:bg-rose-500/10 hover:border-rose-500/20 hover:text-rose-300 transition-all shrink-0"
        title="Очистить чертёж"
      >
        <Icon name="RotateCcw" size={12} />
        <span className="hidden sm:inline">Очистить</span>
      </button>
    </div>
  );
}
