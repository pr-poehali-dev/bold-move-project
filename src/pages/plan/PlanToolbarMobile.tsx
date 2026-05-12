import React from "react";
import Icon from "@/components/ui/icon";
import type { ToolbarProps } from "./PlanToolbarShared";
import { ALL_TOOLS_MENU, IconBtn, loadPinned, savePinned } from "./PlanToolbarShared";
import type { ToolMode } from "./planTypes";
import MobileToolDropdown from "./PlanToolbarMobileDropdown";
import PlanVariantPickerMobile from "./PlanVariantPickerMobile";

export default function MobileToolbar(props: ToolbarProps) {
  const {
    tool, isClosed,
    canUndo, canRedo,
    onToolChange, onUndo, onRedo, onOpenLibrary, onReset,
    onBack, onSaveVariant, variants, variantsLoading, onLoadVariant, onDeleteVariant, onRenameVariant,
  } = props;

  const [confirmReset,      setConfirmReset]      = React.useState(false);
  const [variantPickerOpen, setVariantPickerOpen] = React.useState(false);
  const [pinned, setPinned] = React.useState<ToolMode[]>(loadPinned);

  const handleTogglePin = React.useCallback((id: ToolMode) => {
    setPinned(prev => {
      const next = prev.includes(id)
        ? prev.filter(p => p !== id)
        : [...prev, id];
      savePinned(next);
      return next;
    });
  }, []);

  return (
    <div className="bg-[#161616] border-b border-white/[0.08] shrink-0 flex items-center gap-0.5 px-2" style={{ height: 52 }}>
      {onBack && (
        <>
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all text-white/50 hover:text-white hover:bg-white/[0.07]"
            title="Назад"
          >
            <Icon name="ChevronLeft" size={18} />
          </button>
          <div className="w-px h-4 bg-white/10 mx-0.5 shrink-0" />
        </>
      )}
      <IconBtn icon="Undo2" onClick={onUndo} disabled={!canUndo} title="Отменить" />
      <IconBtn icon="Redo2" onClick={onRedo} disabled={!canRedo} title="Повторить" />
      <div className="w-px h-4 bg-white/10 mx-0.5 shrink-0" />

      {/* Быстрый доступ — закреплённые инструменты слева направо */}
      <div className="flex items-center gap-0.5 flex-1">
        {pinned.map(id => {
          const t = ALL_TOOLS_MENU.find(x => x.id === id);
          if (!t) return null;
          const disabled = !!t.comingSoon;
          const active = !disabled && tool === id;
          return (
            <button key={id}
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                disabled ? "opacity-40 cursor-not-allowed text-white/30" :
                active
                  ? t.danger ? "bg-rose-500/25 border border-rose-500/40 text-rose-300" : "bg-white/95 text-[#111] border border-white/80"
                  : t.danger ? "text-white/35 hover:text-rose-400" : "text-white/45 hover:text-white"
              }`}
              disabled={disabled}
              title={t.label}
              onClick={() => !disabled && onToolChange(id)}>
              <Icon name={t.icon} size={16} />
            </button>
          );
        })}

        {/* Кнопка раскрытия всех инструментов */}
        <MobileToolDropdown
          tool={tool}
          pinned={pinned}
          onToolChange={onToolChange}
          onTogglePin={handleTogglePin}
        />
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

      {/* Справа: сохранить вариант или обычный архив */}
      <div className="w-px h-4 bg-white/10 mx-0.5 shrink-0" />

      {onSaveVariant ? (
        <div className="relative flex items-center shrink-0">
          <button onClick={onSaveVariant}
            className="flex items-center gap-1 px-2 h-8 rounded-l-lg text-[11px] font-bold bg-white text-[#111] transition hover:bg-white/90">
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
                onLoad={v => { onLoadVariant?.(v.data); setVariantPickerOpen(false); }}
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
  );
}