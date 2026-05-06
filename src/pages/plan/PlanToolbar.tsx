import React from "react";
import Icon from "@/components/ui/icon";
import type { ToolMode, PlanSettings, PlanState } from "./planTypes";

interface PlanToolbarProps {
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

interface ToolBtn {
  id: ToolMode;
  icon: string;
  label: string;
  shortcut?: string;
  onlyWhenClosed?: boolean;
}

const TOOLS: ToolBtn[] = [
  { id: "draw",     icon: "Pencil",         label: "Рисовать",         shortcut: "D" },
  { id: "move",     icon: "MousePointer2",  label: "Перемещение",      shortcut: "V" },
  { id: "segment",  icon: "Minus",          label: "Отрезки",          shortcut: "S", onlyWhenClosed: false },
  { id: "diagonal", icon: "ArrowUpRight",   label: "Диагонали",        shortcut: "G", onlyWhenClosed: true },
  { id: "arc",      icon: "Spline",         label: "Дуги / скругления",shortcut: "A", onlyWhenClosed: false },
  { id: "delete",   icon: "Trash2",         label: "Удаление",         shortcut: "X" },
];

export default function PlanToolbar({
  tool, phase, isClosed, settings, canUndo, canRedo,
  onToolChange, onSettingChange, onUndo, onRedo, onReset, onZoomIn, onZoomOut, onZoomFit,
}: PlanToolbarProps) {
  const btn = (active: boolean, danger = false) =>
    `w-10 h-10 rounded-xl flex items-center justify-center transition-all border text-sm font-bold
    ${active
      ? "bg-violet-500/30 border-violet-500/60 text-violet-300 shadow-lg shadow-violet-500/20"
      : danger
        ? "bg-white/[0.03] border-white/[0.08] text-rose-400/70 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-300"
        : "bg-white/[0.03] border-white/[0.08] text-white/50 hover:bg-white/[0.08] hover:text-white/80"}`;

  const iconBtn = (disabled = false) =>
    `w-10 h-10 rounded-xl flex items-center justify-center transition-all border
    ${disabled
      ? "bg-white/[0.02] border-white/[0.05] text-white/20 cursor-not-allowed"
      : "bg-white/[0.03] border-white/[0.08] text-white/50 hover:bg-white/[0.08] hover:text-white/80"}`;

  const toggleBtn = (active: boolean) =>
    `flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold border transition-all
    ${active
      ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
      : "bg-white/[0.03] border-white/[0.07] text-white/40 hover:bg-white/[0.07] hover:text-white/70"}`;

  const sep = <div className="w-px h-6 bg-white/[0.08] mx-1" />;

  return (
    <div className="flex items-center gap-2 px-3 h-14 bg-[#13141f] border-b border-white/[0.07] shrink-0">

      {/* ── Логотип / название ── */}
      <div className="flex items-center gap-2 mr-2">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
          <Icon name="PenTool" size={15} className="text-white" />
        </div>
        <span className="text-sm font-bold text-white/80 hidden sm:block">Построитель</span>
      </div>

      {sep}

      {/* ── Undo / Redo ── */}
      <button className={iconBtn(!canUndo)} onClick={onUndo} disabled={!canUndo} title="Отменить (Ctrl+Z)">
        <Icon name="Undo2" size={16} />
      </button>
      <button className={iconBtn(!canRedo)} onClick={onRedo} disabled={!canRedo} title="Повторить (Ctrl+Y)">
        <Icon name="Redo2" size={16} />
      </button>

      {sep}

      {/* ── Инструменты ── */}
      {TOOLS.map(t => {
        const disabled = t.onlyWhenClosed === true && !isClosed;
        return (
          <button
            key={t.id}
            className={disabled
              ? `${btn(false)} opacity-30 cursor-not-allowed`
              : btn(tool === t.id, t.id === "delete")
            }
            onClick={() => !disabled && onToolChange(t.id)}
            title={`${t.label}${t.shortcut ? ` (${t.shortcut})` : ""}`}
            disabled={disabled}
          >
            <Icon name={t.icon} size={16} />
          </button>
        );
      })}

      {sep}

      {/* ── Переключатели ── */}
      <button className={toggleBtn(settings.ortho)} onClick={() => onSettingChange({ ortho: !settings.ortho })} title="Ортогональное черчение">
        <Icon name="Axis3d" size={13} />
        <span className="hidden md:inline">Орто</span>
      </button>
      <button className={toggleBtn(settings.snapToPoints)} onClick={() => onSettingChange({ snapToPoints: !settings.snapToPoints })} title="Магнит к точкам">
        <Icon name="Magnet" size={13} />
        <span className="hidden md:inline">Магнит</span>
      </button>
      <button className={toggleBtn(settings.showGrid)} onClick={() => onSettingChange({ showGrid: !settings.showGrid })} title="Сетка">
        <Icon name="Grid3x3" size={13} />
        <span className="hidden md:inline">Сетка</span>
      </button>

      {sep}

      {/* ── Zoom ── */}
      <button className={iconBtn()} onClick={onZoomOut} title="Уменьшить">
        <Icon name="ZoomOut" size={15} />
      </button>
      <span className="text-xs text-white/40 w-10 text-center font-mono">
        {Math.round(settings.zoom * 100)}%
      </span>
      <button className={iconBtn()} onClick={onZoomIn} title="Увеличить">
        <Icon name="ZoomIn" size={15} />
      </button>
      <button className={iconBtn()} onClick={onZoomFit} title="По размеру">
        <Icon name="Maximize2" size={14} />
      </button>

      {sep}

      {/* ── Фаза ── */}
      {phase !== "draw" && (
        <div className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold border bg-amber-500/10 border-amber-500/30 text-amber-300">
          <Icon name={phase === "lengths" ? "Ruler" : "Angle"} size={12} />
          {phase === "lengths" ? "Ввод длин" : "Ввод углов"}
        </div>
      )}

      <div className="flex-1" />

      {/* ── Сброс ── */}
      <button
        className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold border bg-white/[0.02] border-white/[0.06] text-rose-400/60 hover:bg-rose-500/10 hover:border-rose-500/20 hover:text-rose-300 transition-all"
        onClick={onReset}
        title="Очистить чертёж"
      >
        <Icon name="RotateCcw" size={12} />
        <span className="hidden sm:inline">Очистить</span>
      </button>
    </div>
  );
}
