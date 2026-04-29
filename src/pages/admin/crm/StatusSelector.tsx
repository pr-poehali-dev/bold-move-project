import { useTheme } from "./themeContext";
import { STATUS_LABELS, STATUS_COLORS } from "./crmApi";
import DrumPicker, { DrumItem } from "./DrumPicker";

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
  const currentItem = DRUM_ITEMS.find(i => i.value === status) ?? DRUM_ITEMS[0];

  return (
    <div className="py-2">
      {/* Заголовок + текущий статус */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: t.textMute }}>
          Статус заявки
        </span>
        <span
          className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg"
          style={{ background: currentItem.color + "20", color: currentItem.color }}
        >
          {currentItem.label}
        </span>
      </div>

      {/* Барабан */}
      <div
        style={{
          borderRadius: 16,
          overflow: "hidden",
          background: t.surface2,
          border: `1px solid ${t.border}`,
          ["--drum-bg" as string]: t.surface2,
        }}
      >
        <DrumPicker
          items={DRUM_ITEMS}
          value={status}
          onChange={onSave}
          itemHeight={44}
          visibleCount={5}
        />
      </div>
    </div>
  );
}
