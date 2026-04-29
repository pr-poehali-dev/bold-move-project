import { useState } from "react";
import { useTheme } from "./themeContext";
import { STATUS_LABELS, STATUS_COLORS } from "./crmApi";
import DrumPicker, { DrumItem } from "./DrumPicker";
import Icon from "@/components/ui/icon";

const STATUS_ORDER = [
  "new",
  "call",
  "measure",
  "measured",
  "contract",
  "prepaid",
  "install_scheduled",
  "install_done",
  "extra_paid",
  "done",
  "cancelled",
];

const DRUM_ITEMS: DrumItem[] = STATUS_ORDER.map(s => ({
  value: s,
  label: STATUS_LABELS[s] ?? s,
  color: STATUS_COLORS[s] ?? "#8b5cf6",
}));

export function StatusSelector({ status, onSave }: { status: string; onSave: (s: string) => void }) {
  const t = useTheme();
  const [pending, setPending] = useState<string | null>(null);

  const currentItem = DRUM_ITEMS.find(i => i.value === status) ?? DRUM_ITEMS[0];
  const pendingItem = pending ? (DRUM_ITEMS.find(i => i.value === pending) ?? currentItem) : null;
  const displayItem = pendingItem ?? currentItem;
  const hasChange   = pending !== null && pending !== status;

  const handleChange = (val: string) => {
    if (val !== status) {
      setPending(val);
    } else {
      setPending(null);
    }
  };

  const handleSave = () => {
    if (pending) {
      onSave(pending);
      setPending(null);
    }
  };

  const handleCancel = () => {
    setPending(null);
  };

  return (
    <div className="py-2">
      {/* Заголовок + статус */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: t.textMute }}>
          Статус заявки
        </span>
        <div className="flex items-center gap-1.5">
          {/* Старый статус (если есть изменение) */}
          {hasChange && (
            <>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg line-through opacity-50"
                style={{ background: currentItem.color + "15", color: currentItem.color }}>
                {currentItem.label}
              </span>
              <Icon name="ArrowRight" size={10} style={{ color: t.textMute }} />
            </>
          )}
          {/* Новый / текущий статус */}
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg"
            style={{ background: displayItem.color + "20", color: displayItem.color }}>
            {displayItem.label}
          </span>
        </div>
      </div>

      {/* Барабан — 3 элемента = компактнее */}
      <div style={{
        borderRadius: 16,
        overflow: "hidden",
        background: t.surface2,
        border: `1px solid ${hasChange ? displayItem.color + "50" : t.border}`,
        transition: "border-color 0.2s",
        ["--drum-bg" as string]: t.surface2,
      }}>
        <DrumPicker
          items={DRUM_ITEMS}
          value={pending ?? status}
          onChange={handleChange}
          itemHeight={40}
          visibleCount={3}
        />
      </div>

      {/* Кнопки подтверждения — появляются когда выбран новый статус */}
      <div className={`overflow-hidden transition-all duration-200 ${hasChange ? "max-h-20 mt-2.5" : "max-h-0 mt-0"}`}>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold text-white transition active:scale-95"
            style={{ background: displayItem.color }}>
            <Icon name="Check" size={14} />
            Сохранить
          </button>
          <button
            onClick={handleCancel}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition active:scale-95"
            style={{ background: t.surface2, color: t.textMute, border: `1px solid ${t.border}` }}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
