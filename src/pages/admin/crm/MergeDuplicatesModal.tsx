import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { Client, crmFetch, STATUS_LABELS } from "./crmApi";

interface Props {
  /** Все заявки одной группы дублей (с одинаковым телефоном), включая оригинал */
  group: Client[];
  onClose: () => void;
  onMerged: () => void;
}

// Объединение группы дублей: одна заявка становится главной, остальные уходят
// в корзину. Пустые поля главной сервер дозаполнит данными из объединяемых —
// так не теряются адрес/сумма/комментарий, введённые в копии.
export default function MergeDuplicatesModal({ group, onClose, onMerged }: Props) {
  const t = useTheme();
  // По умолчанию главной предлагаем самую раннюю заявку — обычно именно в ней
  // накоплена история общения с клиентом.
  const [primaryId, setPrimaryId] = useState<number>(() => Math.min(...group.map(c => c.id)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const fmtDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

  const merge = async () => {
    setErr(""); setBusy(true);
    const mergeIds = group.filter(c => c.id !== primaryId).map(c => c.id);
    const res = await crmFetch("merge-clients", {
      method: "POST",
      body: JSON.stringify({ primary_id: primaryId, merge_ids: mergeIds }),
    }) as { error?: string };
    setBusy(false);
    if (res?.error) { setErr(res.error); return; }
    onMerged();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.78)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col max-h-[92vh]"
        style={{ background: t.surface, border: `1px solid ${t.border}` }}
        onClick={e => e.stopPropagation()}>

        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#ef444422" }}>
              <Icon name="Copy" size={17} style={{ color: "#ef4444" }} />
            </div>
            <div>
              <div className="text-base font-bold" style={{ color: t.text }}>Объединить дубли</div>
              <div className="text-[11px]" style={{ color: t.textMute }}>
                {group.length} заявки с одним телефоном
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ color: t.textMute }}><Icon name="X" size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: t.textMute }}>
            Выберите главную заявку
          </div>
          <div className="flex flex-col gap-1.5">
            {[...group].sort((a, b) => a.id - b.id).map(c => {
              const sel = c.id === primaryId;
              return (
                <button key={c.id} onClick={() => setPrimaryId(c.id)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition"
                  style={{
                    background: sel ? "#10b98112" : t.surface2,
                    border: `1.5px solid ${sel ? "#10b981" : t.border}`,
                  }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: sel ? "#10b981" : "transparent", border: `1.5px solid ${sel ? "#10b981" : t.border2}` }}>
                    {sel && <Icon name="Check" size={11} style={{ color: "#fff" }} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate" style={{ color: t.text }}>
                      Заявка №{c.id}
                      <span className="ml-2 text-[10px] font-semibold" style={{ color: t.textMute }}>
                        от {fmtDate(c.created_at)}
                      </span>
                    </div>
                    <div className="text-[11px] truncate" style={{ color: t.textSub }}>
                      {STATUS_LABELS[c.status] || c.status}
                      {c.client_name && ` · ${c.client_name}`}
                      {c.address && ` · ${c.address}`}
                      {Number(c.contract_sum) > 0 && ` · ${Number(c.contract_sum).toLocaleString("ru-RU")} ₽`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl px-3.5 py-2.5 text-[11px] flex items-start gap-2"
            style={{ background: "#f59e0b12", border: "1px solid #f59e0b35", color: t.textSub }}>
            <Icon name="Info" size={13} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
            <span>
              Незаполненные поля главной заявки дополнятся данными из остальных.
              Остальные заявки уйдут в корзину — их можно восстановить.
            </span>
          </div>

          {err && (
            <div className="mt-3 rounded-xl px-3.5 py-2.5 text-xs"
              style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
              {err}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4" style={{ borderTop: `1px solid ${t.border}` }}>
          <button onClick={merge} disabled={busy}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "#10b981" }}>
            {busy
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Объединение...</>
              : <><Icon name="Merge" size={14} /> Объединить в №{primaryId}</>}
          </button>
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium transition"
            style={{ background: t.surface2, color: t.textMute, border: `1px solid ${t.border}` }}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
