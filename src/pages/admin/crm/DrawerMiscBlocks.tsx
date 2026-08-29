import { useTheme } from "./themeContext";
import { InlineField, Section } from "./drawerComponents";
import { BlockId } from "./drawerTypes";
import { InfoBlocksProps } from "./drawerInfoShared";

// ── Misc: небольшие самостоятельные блоки без общей логики useInfoBlock —
// Касания (даты звонков), Заметки, Причина отказа.

// ── Касания (даты звонков) ───────────────────────────────────────────────────
// Дефолтный блок, виден у всех по умолчанию. Два поля:
// - "Дата следующего звонка" — обычная дата, сотрудник выбирает вручную (напоминание).
// - "Дата последнего звонка" — только для чтения, подтягивается автоматически
//   из истории звонков телефонии (UIS), редактировать нельзя.
export function DrawerCallDatesBlock({ data, hiddenBlocks, toggleHidden, saveWithLog }: InfoBlocksProps) {
  const t = useTheme();
  const id: BlockId = "call_dates";
  const isHidden = hiddenBlocks.has(id);

  const nextCallVal = data.next_call_date ? data.next_call_date.slice(0, 16) : "";
  const lastCallVal = data.last_call_at
    ? new Date(data.last_call_at).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : null;

  const saveNextCall = (v: string) => saveWithLog(
    { next_call_date: v || null },
    v ? `Следующий звонок: ${new Date(v).toLocaleDateString("ru-RU")}` : "Дата следующего звонка удалена",
    "PhoneOutgoing", "#3b82f6"
  );

  return (
    <Section icon="PhoneCall" title="Касания" color="#3b82f6" hidden={isHidden}
      onToggleHidden={() => toggleHidden(id)}>
      <div style={{ borderBottom: `1px solid ${t.border2}`, minHeight: 36 }}>
        <div className="flex items-center justify-between group">
          <div className="flex items-center gap-1.5 flex-shrink-0 w-36 py-2">
            <span className="text-xs" style={{ color: "#d4d4d4" }}>Последний звонок</span>
          </div>
          <div className="flex-1 text-right text-sm py-2" title="Подтягивается автоматически из телефонии — не редактируется">
            {lastCallVal
              ? <span style={{ color: t.textSub }}>{lastCallVal}</span>
              : <span className="text-xs" style={{ color: t.textMute }}>Ещё не звонили</span>}
          </div>
        </div>
      </div>
      <InlineField label="Следующий звонок" value={nextCallVal} onSave={saveNextCall}
        type="datetime-local" placeholder="Выбрать дату" />
    </Section>
  );
}

// ── Notes ─────────────────────────────────────────────────────────────────────
export function DrawerNotesBlock({ data, client, setData, save, hiddenBlocks, toggleHidden, logAction }: InfoBlocksProps) {
  const t = useTheme();
  const isHidden = hiddenBlocks.has("notes");
  return (
    <Section icon="StickyNote" title="Заметки" color="#8b5cf6" hidden={isHidden}
      onToggleHidden={() => toggleHidden("notes")}>
      <textarea
        value={(() => {
          const notes = data.notes || "";
          return notes.split("\n").filter(l => !l.includes("Смета сохранена") && !l.includes("Email:") && !l.includes("Estimate ID:")).join("\n").trim();
        })()}
        onChange={e => setData({ ...data, notes: e.target.value })}
        onBlur={e => { if (e.target.value !== (client.notes || "")) { save({ notes: e.target.value }); logAction("StickyNote", "#8b5cf6", "Заметки обновлены"); } }}
        placeholder="Добавить заметку..." rows={3}
        className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none transition mt-2 mb-1"
        style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#fff" }}
      />
    </Section>
  );
}

export { DrawerFilesBlock } from "./DrawerFilesBlock";

// ── Cancel ────────────────────────────────────────────────────────────────────
export function DrawerCancelBlock({ data, hiddenBlocks, editingBlock, toggleHidden, setEditingBlock, saveWithLog }: InfoBlocksProps) {
  const id: BlockId = "cancel";
  const isHidden = hiddenBlocks.has(id);
  const editMode = editingBlock === id;
  if (data.status !== "cancelled") return null;
  return (
    <Section icon="XCircle" title="Причина отказа" color="#ef4444" hidden={isHidden}
      onToggleHidden={() => toggleHidden(id)}
      onEdit={!isHidden ? () => setEditingBlock(editMode ? null : id) : undefined}>
      <InlineField label="Причина" value={data.cancel_reason} onSave={v => saveWithLog({ cancel_reason: v }, `Причина отказа: ${v}`, "XCircle", "#ef4444")} placeholder="Укажите причину" />
    </Section>
  );
}
