import Icon from "@/components/ui/icon";
import type { ToolbarProps } from "./PlanToolbarShared";
import { TOOLS, IconBtn, ToolBtn, DropUp, DropItem, Sep } from "./PlanToolbarShared";
import MobileToolbar from "./PlanToolbarMobile";

export default function PlanToolbar(props: ToolbarProps) {
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

      {/* ФУНКЦИИ */}
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
