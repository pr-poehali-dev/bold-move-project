import React from "react";
import Icon from "@/components/ui/icon";
import type { ToolbarProps } from "./PlanToolbarShared";
import { ALL_TOOLS_MENU, loadPinned } from "./PlanToolbarShared";
import type { ToolMode } from "./planTypes";
import PlanVariantPickerMobile from "./PlanVariantPickerMobile";

export default function MobileToolbar(props: ToolbarProps) {
  const {
    tool,
    canUndo, canRedo,
    onToolChange, onUndo, onRedo, onOpenLibrary, onReset,
    onBack, onSaveVariant, onOverwriteVariant, variants, variantsLoading,
    activeVariantId, onLoadVariant, onDeleteVariant, onRenameVariant, onSelectVariant,
  } = props;

  const [toolsOpen,         setToolsOpen]         = React.useState(false);
  const [confirmReset,      setConfirmReset]       = React.useState(false);
  const [variantPickerOpen, setVariantPickerOpen]  = React.useState(false);
  const [pinned]            = React.useState<ToolMode[]>(loadPinned);

  const activeToolDef = ALL_TOOLS_MENU.find(t => t.id === tool);

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

        {/* Кнопка "Инструменты" — показывает текущий активный инструмент */}
        <button
          onClick={() => setToolsOpen(v => !v)}
          className={`flex items-center gap-1.5 h-9 px-2.5 rounded-lg shrink-0 transition-all text-[12px] font-semibold ${
            toolsOpen
              ? "bg-violet-600/30 border border-violet-500/50 text-violet-300"
              : "bg-white/[0.06] border border-white/[0.08] text-white/70 hover:bg-white/[0.10]"
          }`}
          title="Инструменты"
        >
          <Icon name={activeToolDef?.icon ?? "Pencil"} size={15} />
          <span className="hidden xs:inline">{activeToolDef?.label ?? "Инструменты"}</span>
          <Icon name={toolsOpen ? "ChevronUp" : "ChevronDown"} size={12} className="opacity-60" />
        </button>

        <div className="flex-1" />

        {/* Сохранить / варианты */}
        {onSaveVariant ? (
          <div className="relative flex items-center shrink-0">
            <button onClick={onSaveVariant}
              className="flex items-center gap-1 px-2.5 h-8 rounded-l-lg text-[11px] font-bold bg-white text-[#111] transition hover:bg-white/90"
              title="Сохранить как новый вариант">
              <Icon name="Save" size={13} />
              <span>Сохранить</span>
            </button>

            <div className="relative">
              <button onClick={() => setVariantPickerOpen(v => !v)}
                className="flex items-center justify-center w-8 h-8 rounded-r-lg bg-white text-[#111] border-l border-l-black/10 transition hover:bg-white/90">
                <Icon name="ChevronDown" size={13} />
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
          {/* Инструменты — иконки без подписей, один ряд */}
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
    </>
  );
}