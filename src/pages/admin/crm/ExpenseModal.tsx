import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { Expense, ExpenseCategory, ExpenseInput, ExpenseKind } from "@/hooks/useExpenses";
import { OrderSource } from "./crmApi";

interface Props {
  categories: ExpenseCategory[];
  sources: OrderSource[];
  /** Если передан — режим редактирования существующего расхода */
  initial?: Expense | null;
  onSave: (input: ExpenseInput) => Promise<void>;
  onAddCategory: (name: string, kind: ExpenseKind) => Promise<ExpenseCategory>;
  onClose: () => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const KIND_OPTIONS: { id: ExpenseKind; label: string }[] = [
  { id: "ad_service", label: "Реклама — услуга" },
  { id: "ad_budget",  label: "Реклама — бюджет" },
  { id: "salary",     label: "Зарплата" },
  { id: "general",    label: "Общий расход" },
];

/** Форма внесения вложения: реклама (с источником), зарплата (с сотрудником) или общий расход. */
export default function ExpenseModal({ categories, sources, initial, onSave, onAddCategory, onClose }: Props) {
  const t = useTheme();
  const [categoryId, setCategoryId] = useState<number | null>(initial?.category_id ?? categories[0]?.id ?? null);
  const [sourceId,   setSourceId]   = useState<number | null>(initial?.source_id ?? null);
  const [employee,   setEmployee]   = useState(initial?.employee ?? "");
  const [amount,     setAmount]     = useState(initial ? String(initial.amount) : "");
  const [spentOn,    setSpentOn]    = useState(initial?.spent_on ?? todayISO());
  const [comment,    setComment]    = useState(initial?.comment ?? "");
  const [saving,     setSaving]     = useState(false);

  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatKind, setNewCatKind] = useState<ExpenseKind>("general");

  const cat  = categories.find(c => c.id === categoryId) ?? null;
  const kind = cat?.kind ?? "general";
  const needSource   = kind === "ad_service" || kind === "ad_budget";
  const needEmployee = kind === "salary";

  const amountNum = Number(amount.replace(",", "."));
  const invalid = !categoryId || !amount || isNaN(amountNum) || amountNum <= 0 || !spentOn;

  const inputStyle = {
    background: t.surface2,
    color: t.text,
    border: `1px solid ${t.border}`,
    colorScheme: t.theme,
  } as React.CSSProperties;

  const save = async () => {
    if (invalid || saving) return;
    setSaving(true);
    try {
      await onSave({
        category_id: categoryId,
        source_id: needSource ? sourceId : null,
        employee: needEmployee ? employee.trim() || null : null,
        amount: amountNum,
        spent_on: spentOn,
        comment: comment.trim() || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const addCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    const created = await onAddCategory(name, newCatKind);
    setCategoryId(created.id);
    setNewCatName("");
    setNewCatOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}
        style={{ background: t.surface, border: `1px solid ${t.border}` }}>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon name="Receipt" size={16} style={{ color: t.accentLight }} />
            <span className="text-sm font-bold" style={{ color: t.text }}>
              {initial ? "Изменить вложение" : "Добавить вложение"}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg transition hover:opacity-70">
            <Icon name="X" size={16} style={{ color: t.textMute }} />
          </button>
        </div>

        <div className="space-y-3">
          {/* Статья расхода */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs" style={{ color: t.textMute }}>Статья расхода</label>
              <button onClick={() => setNewCatOpen(v => !v)}
                className="text-xs font-semibold transition hover:opacity-70"
                style={{ color: t.accentLight }}>
                {newCatOpen ? "Отмена" : "+ Новая статья"}
              </button>
            </div>
            {newCatOpen ? (
              <div className="rounded-xl p-3 space-y-2" style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
                <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                  placeholder="Например: Инструмент"
                  className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none" style={inputStyle} />
                <select value={newCatKind} onChange={e => setNewCatKind(e.target.value as ExpenseKind)}
                  className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none appearance-none" style={inputStyle}>
                  {KIND_OPTIONS.map(k => (
                    <option key={k.id} value={k.id} style={{ background: t.surface, color: t.text }}>{k.label}</option>
                  ))}
                </select>
                <button onClick={addCategory} disabled={!newCatName.trim()}
                  className="w-full py-2 rounded-xl text-xs font-semibold transition hover:opacity-90 disabled:opacity-40"
                  style={{ background: t.accent, color: "#fff" }}>
                  Создать статью
                </button>
              </div>
            ) : (
              <select value={categoryId ?? ""} onChange={e => setCategoryId(Number(e.target.value) || null)}
                className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none appearance-none" style={inputStyle}>
                <option value="" style={{ background: t.surface, color: t.text }}>Выберите статью</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id} style={{ background: t.surface, color: t.text }}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Рекламный источник — только для рекламных статей */}
          {needSource && (
            <div>
              <label className="block text-xs mb-1.5" style={{ color: t.textMute }}>Рекламный источник</label>
              <select value={sourceId ?? ""} onChange={e => setSourceId(Number(e.target.value) || null)}
                className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none appearance-none" style={inputStyle}>
                <option value="" style={{ background: t.surface, color: t.text }}>Без источника</option>
                {sources.map(s => (
                  <option key={s.id} value={s.id} style={{ background: t.surface, color: t.text }}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Сотрудник — только для зарплат */}
          {needEmployee && (
            <div>
              <label className="block text-xs mb-1.5" style={{ color: t.textMute }}>
                Сотрудник <span style={{ opacity: 0.6 }}>(можно не указывать)</span>
              </label>
              <input value={employee} onChange={e => setEmployee(e.target.value)}
                placeholder="Например: Иван — монтажник"
                className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none" style={inputStyle} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: t.textMute }}>Сумма, ₽</label>
              <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal"
                placeholder="0"
                className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: t.textMute }}>Дата</label>
              <input type="date" value={spentOn} onChange={e => setSpentOn(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none" style={inputStyle} />
            </div>
          </div>

          <div>
            <label className="block text-xs mb-1.5" style={{ color: t.textMute }}>Комментарий</label>
            <input value={comment} onChange={e => setComment(e.target.value)}
              placeholder="Например: оплата за март"
              className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none" style={inputStyle} />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition hover:opacity-80"
            style={{ background: t.surface2, color: t.textSub, border: `1px solid ${t.border}` }}>
            Отмена
          </button>
          <button disabled={invalid || saving} onClick={save}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition hover:opacity-90 disabled:opacity-40"
            style={{ background: t.accent, color: "#fff" }}>
            {saving ? "Сохраняю…" : initial ? "Сохранить" : "Добавить"}
          </button>
        </div>
      </div>
    </div>
  );
}
