import { useState } from "react";
import Icon from "@/components/ui/icon";
import { Section, fieldStyles } from "./OwnAgentFields";
import type { NavButton, NavButtonContent } from "@/context/AuthContext";

const ICONS = [
  "CalendarCheck","Factory","Image","LayoutGrid","Phone","MessageCircle",
  "Star","Heart","MapPin","Clock","Info","HelpCircle","Sparkles","Home",
  "Briefcase","Camera","Globe","Mail","ShoppingCart","Wrench","Users","Tag",
];

const ACTION_LABELS: Record<NavButton["action"], string> = {
  chat:      "Открыть чат",
  panel:     "Своя страница",
  other:     "Меню «Другое»",
  url:       "Ссылка",
  phone:     "Позвонить",
  whatsapp:  "WhatsApp",
  telegram:  "Telegram",
};


const DEFAULT_BUTTONS: NavButton[] = [
  { id: "booking",    label: "Заказать",     icon: "CalendarCheck", action: "chat" },
  { id: "production", label: "Производство", icon: "Factory",       action: "other" },
  { id: "portfolio",  label: "Портфолио",    icon: "Image",         action: "other" },
  { id: "other",      label: "Другое",       icon: "LayoutGrid",    action: "other" },
];

function genId() { return Math.random().toString(36).slice(2, 8); }

interface Props {
  value:    NavButton[] | null | undefined;
  onChange: (v: NavButton[]) => void;
  token:    string | null;
  isDark:   boolean;
}

export function SectionNav({ value, onChange, token, isDark }: Props) {
  const buttons = value && value.length > 0 ? value : DEFAULT_BUTTONS;
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const { muted, border, bg, text } = fieldStyles(isDark);

  const update = (idx: number, patch: Partial<NavButton>) => {
    onChange(buttons.map((b, i) => i === idx ? { ...b, ...patch } : b));
  };

  const updateContent = (idx: number, patch: Partial<NavButtonContent>) => {
    const prev = buttons[idx].content || {};
    onChange(buttons.map((b, i) => i === idx ? { ...b, content: { ...prev, ...patch } } : b));
  };

  const remove = (idx: number) => {
    onChange(buttons.filter((_, i) => i !== idx));
    setEditIdx(null);
  };

  const add = () => {
    if (buttons.length >= 5) return;
    const next = [...buttons, { id: genId(), label: "Новая", icon: "Star", action: "panel" as const, content: {} }];
    onChange(next);
    setEditIdx(next.length - 1);
  };


  const editing = editIdx !== null ? buttons[editIdx] : null;
  const content = editing?.content || {};

  return (
    <Section title="Нижняя навигация" icon="LayoutGrid" isDark={isDark}>
      {/* Preview бар */}
      <div className="flex gap-1.5 p-2 rounded-xl mb-1" style={{ background: isDark ? "rgba(0,0,0,0.3)" : "#f3f4f6" }}>
        {buttons.map((b, i) => (
          <button key={b.id} onClick={() => setEditIdx(i === editIdx ? null : i)}
            className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg transition"
            style={{
              background: editIdx === i ? (isDark ? "rgba(167,139,250,0.15)" : "#ede9fe") : "transparent",
              border: editIdx === i ? "1px solid rgba(167,139,250,0.4)" : "1px solid transparent",
            }}>
            <Icon name={b.icon} size={15} style={{ color: editIdx === i ? "#a78bfa" : (isDark ? "rgba(255,255,255,0.4)" : "#9ca3af") }} />
            <span className="text-[9px] leading-none text-center" style={{ color: editIdx === i ? "#a78bfa" : (isDark ? "rgba(255,255,255,0.3)" : "#9ca3af") }}>
              {b.label}
            </span>
          </button>
        ))}
        {buttons.length < 5 && (
          <button onClick={add} className="flex-none flex flex-col items-center justify-center w-12 py-2 rounded-lg transition"
            style={{ border: `1px dashed ${isDark ? "rgba(255,255,255,0.15)" : "#d1d5db"}` }}>
            <Icon name="Plus" size={14} style={{ color: isDark ? "rgba(255,255,255,0.25)" : "#9ca3af" }} />
          </button>
        )}
      </div>

      {/* Редактор выбранной кнопки */}
      {editing && editIdx !== null && (
        <div className="rounded-xl p-3 space-y-3" style={{ background: isDark ? "rgba(167,139,250,0.06)" : "#faf5ff", border: "1px solid rgba(167,139,250,0.2)" }}>

          {/* Название */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: muted }}>Название</div>
            <input value={editing.label} onChange={e => update(editIdx, { label: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
              style={{ background: bg, border: `1px solid ${border}`, color: text }} />
          </div>

          {/* Название страницы — только для «Своя страница» */}
          {editing.action === "panel" && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: muted }}>Название страницы</div>
              <input value={content.title || ""} onChange={e => updateContent(editIdx, { title: e.target.value })}
                placeholder="Наше производство"
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={{ background: bg, border: `1px solid ${border}`, color: text }} />
            </div>
          )}

          {/* Кнопка Редактировать — заглушка */}
          <button
            disabled
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold opacity-40 cursor-not-allowed"
            style={{ background: isDark ? "rgba(167,139,250,0.1)" : "#ede9fe", border: "1px dashed rgba(167,139,250,0.4)", color: "#a78bfa" }}>
            <Icon name="Pencil" size={13} />
            Редактировать страницу
          </button>

          {/* Иконка */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: muted }}>Иконка</div>
            <div className="flex flex-wrap gap-1.5">
              {ICONS.map(ic => (
                <button key={ic} onClick={() => update(editIdx, { icon: ic })}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition"
                  style={{
                    background: editing.icon === ic ? "rgba(167,139,250,0.2)" : (isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6"),
                    border: editing.icon === ic ? "1px solid rgba(167,139,250,0.5)" : `1px solid ${border}`,
                  }}>
                  <Icon name={ic} size={14} style={{ color: editing.icon === ic ? "#a78bfa" : (isDark ? "rgba(255,255,255,0.4)" : "#9ca3af") }} />
                </button>
              ))}
            </div>
          </div>

          {buttons.length > 1 && (
            <button onClick={() => remove(editIdx)}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition">
              <Icon name="Trash2" size={12} />
              Удалить кнопку
            </button>
          )}
        </div>
      )}

      <p className="text-[10px]" style={{ color: isDark ? "rgba(255,255,255,0.25)" : "#9ca3af" }}>
        Нажмите на кнопку в превью чтобы редактировать. Максимум 5 кнопок.
      </p>
    </Section>
  );
}