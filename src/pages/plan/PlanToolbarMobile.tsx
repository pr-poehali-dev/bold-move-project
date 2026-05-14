import React from "react";
import Icon from "@/components/ui/icon";
import type { ToolbarProps } from "./PlanToolbarShared";
import { ALL_TOOLS_MENU, loadPinned } from "./PlanToolbarShared";
import type { ToolMode } from "./planTypes";
import PlanVariantPickerMobile from "./PlanVariantPickerMobile";
import { EXPORT_TYPES } from "./PlanExportMenu";
import type { ExportConfig, ExportType } from "./PlanExportMenu";

export default function MobileToolbar(props: ToolbarProps) {
  const {
    tool,
    canUndo, canRedo,
    onToolChange, onUndo, onRedo, onOpenLibrary, onReset,
    onBack, onSaveVariant, onOverwriteVariant, variants, variantsLoading,
    activeVariantId, onLoadVariant, onDeleteVariant, onRenameVariant, onSelectVariant,
  } = props;

  const [toolsOpen,         setToolsOpen]         = React.useState(false);
  const [exportOpen,        setExportOpen]         = React.useState(false);
  const [settingsOpen,      setSettingsOpen]       = React.useState(false);
  const [confirmReset,      setConfirmReset]       = React.useState(false);
  const [variantPickerOpen, setVariantPickerOpen]  = React.useState(false);
  const [pinned]            = React.useState<ToolMode[]>(loadPinned);
  const [exportCfg,         setExportCfg]          = React.useState<ExportConfig>({ scope: "project", type: "offer" });

  const { settings, onSettingChange } = props;

  const SETTINGS_ITEMS = [
    { key: "ortho",             label: "Ортогональный",   icon: "Axis3d"         },
    { key: "snapToPoints",      label: "Магнит",          icon: "Magnet"         },
    { key: "showGrid",          label: "Сетка",           icon: "Grid3x3"        },
    { key: "showPoints",        label: "Точки",           icon: "CircleDot"      },
    { key: "showPointLabels",   label: "Метки точек",     icon: "Tag"            },
    { key: "showSegmentLabels", label: "Подписи",         icon: "Type"           },
    { key: "showAngleLabels",   label: "Углы",            icon: "Angle"          },
    { key: "showDiagonals",     label: "Диагонали",       icon: "ArrowUpRight"   },
    { key: "showDimLines",      label: "Размерные линии", icon: "ArrowLeftRight" },
  ];

  const activeToolDef = ALL_TOOLS_MENU.find(t => t.id === tool);

  // Закрываем настройки при клике вне
  React.useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => setSettingsOpen(false);
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, [settingsOpen]);

  // Закрываем одну панель при открытии другой
  const openTools  = () => { setToolsOpen(v => !v); setExportOpen(false); setSettingsOpen(false); };
  const openExport = () => { setExportOpen(v => !v); setToolsOpen(false); setSettingsOpen(false); };

  return (
    <>
      {/* ── Основная панель ─────────────────────────────────────────────────── */}
      <div
        className="bg-[#161616] border-b border-white/[0.08] shrink-0 flex items-center gap-1 px-2"
        style={{ height: 52 }}
      >
        {/* Назад */}
        {onBack && (
          <>
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all text-white/50 hover:text-white hover:bg-white/[0.07]"
              title="Назад"
            >
              <Icon name="ChevronLeft" size={18} />
            </button>
            <div className="w-px h-4 bg-white/10 shrink-0" />
          </>
        )}

        {/* Undo / Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all disabled:opacity-30 text-white/50 hover:text-white hover:bg-white/[0.07]"
        >
          <Icon name="Undo2" size={16} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all disabled:opacity-30 text-white/50 hover:text-white hover:bg-white/[0.07]"
        >
          <Icon name="Redo2" size={16} />
        </button>

        <div className="w-px h-4 bg-white/10 shrink-0" />

        {/* Кнопка "Инструменты" */}
        <button
          onClick={openTools}
          className={`flex items-center gap-1.5 h-9 px-2.5 rounded-lg shrink-0 transition-all text-[12px] font-semibold ${
            toolsOpen
              ? "bg-violet-600/30 border border-violet-500/50 text-violet-300"
              : "bg-white/[0.06] border border-white/[0.08] text-white/70 hover:bg-white/[0.10]"
          }`}
          title="Инструменты"
        >
          <Icon name={activeToolDef?.icon ?? "Pencil"} size={15} />
          <Icon name={toolsOpen ? "ChevronUp" : "ChevronDown"} size={12} className="opacity-60" />
        </button>

        {/* Кнопка "Смета" */}
        {onSaveVariant && (
          <button
            onClick={openExport}
            className={`flex items-center gap-1 h-9 px-2.5 rounded-lg shrink-0 transition-all text-[12px] font-semibold ${
              exportOpen
                ? "bg-violet-600/30 border border-violet-500/50 text-violet-300"
                : "bg-white/[0.06] border border-white/[0.08] text-white/70 hover:bg-white/[0.10]"
            }`}
            title="Смета"
          >
            <Icon name="FileText" size={15} />
            <Icon name={exportOpen ? "ChevronUp" : "ChevronDown"} size={12} className="opacity-60" />
          </button>
        )}

        <div className="flex-1" />

        {/* Кнопка настроек */}
        <div className="relative shrink-0">
          {settingsOpen && (
            <div
              className="fixed z-[9999] bg-[#1c1c2e] border border-white/[0.12] rounded-2xl shadow-2xl p-2 flex flex-col gap-0.5 min-w-[210px]"
              style={{ right: 8, top: 56 }}
              onClick={e => e.stopPropagation()}
            >
              {SETTINGS_ITEMS.map(({ key, label, icon }) => (
                <button key={key}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-all text-left w-full ${
                    settings[key as keyof typeof settings]
                      ? "bg-violet-600/20 text-violet-200 border border-violet-500/30"
                      : "text-white/60 hover:bg-white/[0.06]"
                  }`}
                  onClick={() => onSettingChange({ [key]: !settings[key as keyof typeof settings] })}>
                  <Icon name={icon} size={14} />
                  <span className="flex-1">{label}</span>
                  {settings[key as keyof typeof settings] && <Icon name="Check" size={11} className="text-violet-400" />}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={e => { e.stopPropagation(); setSettingsOpen(v => !v); }}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
              settingsOpen
                ? "bg-violet-600/30 border border-violet-500/50 text-violet-300"
                : "bg-white/[0.06] border border-white/[0.08] text-white/70 hover:bg-white/[0.10]"
            }`}
            title="Настройки"
          >
            <Icon name="SlidersHorizontal" size={15} />
          </button>
        </div>

        {/* Сохранить / варианты */}
        {onSaveVariant ? (
          <div className="relative flex items-center gap-1 shrink-0">
            {/* Кнопка сохранить — только иконка */}
            <button onClick={onSaveVariant}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-[#111] font-bold bg-white transition hover:bg-white/90 shrink-0"
              title="Сохранить вариант">
              <Icon name="Save" size={15} />
            </button>
            {/* Кнопка вариантов */}
            <div className="relative">
              <button onClick={() => setVariantPickerOpen(v => !v)}
                className="w-9 h-9 flex items-center justify-center rounded-lg transition shrink-0"
                style={{ background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }}
                title="Варианты">
                <Icon name="Layers2" size={15} />
              </button>
              {variantPickerOpen && (
                <PlanVariantPickerMobile
                  variants={variants ?? []}
                  loading={variantsLoading}
                  activeVariantId={activeVariantId}
                  onSelect={v => { onSelectVariant?.(v.id); setVariantPickerOpen(false); }}
                  onLoad={v => { onLoadVariant?.(v.id, v.data); setVariantPickerOpen(false); }}
                  onDelete={id => onDeleteVariant?.(id)}
                  onRename={(id, name) => onRenameVariant?.(id, name)}
                  onClose={() => setVariantPickerOpen(false)}
                />
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={onOpenLibrary}
            title="Сохранённые планы"
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all text-white/45 hover:text-white hover:bg-white/[0.07]"
          >
            <Icon name="FolderOpen" size={16} />
          </button>
        )}
      </div>

      {/* ── Подпанель инструментов ───────────────────────────────────────────── */}
      {toolsOpen && (
        <div
          className="shrink-0 border-b border-white/[0.06] px-2 py-1.5 flex items-center gap-1"
          style={{ background: "#121220" }}
        >
          {ALL_TOOLS_MENU.map(t => {
            const disabled = !!t.comingSoon;
            const active = !disabled && tool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { if (!disabled) { onToolChange(t.id); setToolsOpen(false); } }}
                disabled={disabled}
                title={t.label}
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                  disabled
                    ? "opacity-25 cursor-not-allowed text-white/30"
                    : active
                      ? t.danger
                        ? "bg-rose-500/25 border border-rose-500/40 text-rose-300"
                        : "bg-white text-[#111]"
                      : t.danger
                        ? "text-rose-400/70 hover:bg-rose-500/10 border border-transparent"
                        : "text-white/50 hover:text-white hover:bg-white/[0.07] border border-transparent"
                }`}
              >
                <Icon name={t.icon} size={16} />
              </button>
            );
          })}

          <div className="flex-1" />

          {/* Очистить */}
          {confirmReset ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => { onReset(); setConfirmReset(false); setToolsOpen(false); }}
                className="h-8 px-3 rounded-lg bg-rose-600/80 border border-rose-400/30 text-white text-[11px] font-bold hover:bg-rose-600 transition"
              >
                Стереть всё
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:bg-white/[0.07] transition"
              >
                <Icon name="X" size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmReset(true)}
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/10 transition"
              title="Очистить"
            >
              <Icon name="Trash2" size={15} />
            </button>
          )}
        </div>
      )}

      {/* ── Подпанель сметы — 7 иконок, без скролла ─────────────────────────── */}
      {exportOpen && (
        <div
          className="shrink-0 border-b border-white/[0.06] px-2 py-1.5 flex items-center justify-between"
          style={{ background: "#121220" }}
        >
          {EXPORT_TYPES.map(t => {
            const active = exportCfg.type === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setExportCfg(c => ({ ...c, type: t.id as ExportType }))}
                title={t.label}
                className="flex-1 mx-0.5 h-9 flex items-center justify-center rounded-lg transition"
                style={{
                  background: active ? "rgba(124,58,237,0.35)" : "rgba(255,255,255,0.05)",
                  border: active ? "1px solid rgba(124,58,237,0.5)" : "1px solid rgba(255,255,255,0.08)",
                  color: active ? "#c4b5fd" : "rgba(255,255,255,0.45)",
                }}
              >
                <Icon name={t.icon} size={15} fallback="FileText" />
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}