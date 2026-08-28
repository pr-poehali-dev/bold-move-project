import { useTheme } from "./themeContext";
import { Client } from "./crmApi";
import { Section } from "./drawerComponents";
import { BlockId } from "./drawerTypes";
import Icon from "@/components/ui/icon";

// Единое текстовое поле комментария — textarea с сохранением по onBlur (тот же
// паттерн, что и у старого DrawerNotesBlock), просто с явной подписью сверху.
function CommentTextarea({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const t = useTheme();
  return (
    <div className="mb-2.5">
      <label className="text-xs mb-1 block" style={{ color: "#d4d4d4" }}>{label}</label>
      <textarea
        defaultValue={value}
        onBlur={e => { if (e.target.value !== value) onSave(e.target.value); }}
        placeholder="Добавить комментарий..." rows={2}
        className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none resize-none transition"
        style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#fff" }}
      />
    </div>
  );
}

// Summary — заполняется автоматически ИИ-анализом переписки (analyze-client), поэтому
// read-only: показываем текст и время последнего обновления, руками не редактируется.
function SummaryRow({ label, value, updatedAt }: { label: string; value: string | null | undefined; updatedAt?: string | null }) {
  const t = useTheme();
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs" style={{ color: "#d4d4d4" }}>{label}</span>
        {updatedAt && (
          <span className="text-[10px]" style={{ color: t.textMute }}>
            {new Date(updatedAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
      <div className="w-full rounded-xl px-3 py-2 text-sm"
        style={{ background: t.surface, border: `1px solid ${t.border}`, color: value ? "#fff" : t.textMute, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {value || "Пока нет данных — появятся автоматически при первом ИИ-анализе переписки"}
      </div>
    </div>
  );
}

interface Props {
  data: Client;
  saveWithLog: (patch: Partial<Client>, logText: string, icon?: string, color?: string) => void;
  hiddenBlocks: Set<BlockId>;
  toggleHidden: (id: BlockId) => void;
}

export function DrawerCommentsBlock({ data, saveWithLog, hiddenBlocks, toggleHidden }: Props) {
  const id: BlockId = "comments";
  const isHidden = hiddenBlocks.has(id);

  return (
    <Section icon="MessageSquare" title="Комментарий" color="#ec4899" hidden={isHidden}
      onToggleHidden={() => toggleHidden(id)}>
      <CommentTextarea label="Комментарий к заявке" value={data.comment_order || ""}
        onSave={v => saveWithLog({ comment_order: v }, "Комментарий к заявке обновлён", "MessageSquare", "#ec4899")} />
      <CommentTextarea label="Комментарий к замеру" value={data.comment_measure || ""}
        onSave={v => saveWithLog({ comment_measure: v }, "Комментарий к замеру обновлён", "Ruler", "#ec4899")} />
      <CommentTextarea label="Комментарий к монтажу" value={data.comment_install || ""}
        onSave={v => saveWithLog({ comment_install: v }, "Комментарий к монтажу обновлён", "Wrench", "#ec4899")} />
      <CommentTextarea label="Комментарий к клиенту" value={data.comment_client || ""}
        onSave={v => saveWithLog({ comment_client: v }, "Комментарий к клиенту обновлён", "User", "#ec4899")} />

      {/* Summary — подраздел с автосводками от ИИ. Показываем реальный ИИ-анализ
          (считается в crm-ai по истории звонков/переписки) — с фолбэком на старые
          ручные поля summary_comm/summary_status, если их когда-то заполнили руками. */}
      <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-1.5 mb-2">
          <Icon name="Sparkles" size={12} style={{ color: "#ec4899" }} />
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#ec4899" }}>Summary</span>
        </div>
        <SummaryRow label="Состояние по коммуникациям" value={data.ai_state_summary || data.summary_comm} updatedAt={data.ai_analysis_updated_at} />
        <SummaryRow label="Следующее действие" value={data.ai_next_action || data.summary_status} />
      </div>
    </Section>
  );
}