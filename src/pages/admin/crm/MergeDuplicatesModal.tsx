import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { Client, crmFetch, STATUS_LABELS } from "./crmApi";
import { MERGE_FIELD_GROUPS, isEmptyValue, displayValue } from "./mergeFields";

interface Props {
  /** Все заявки одной группы дублей (с одинаковым телефоном), включая оригинал */
  group: Client[];
  onClose: () => void;
  onMerged: () => void;
  /** Пометить группу как «не дубль» (клиент реально заказал несколько раз) */
  onNotDuplicate: (ids: number[]) => Promise<void>;
}

// Полноценное сравнение дублей: поля всех заявок группы показаны рядом,
// по каждому полю менеджер выбирает, какое значение останется в итоговой заявке.
// Отличающиеся значения подсвечены — сразу видно, где заявки расходятся.
export default function MergeDuplicatesModal({ group, onClose, onMerged, onNotDuplicate }: Props) {
  const t = useTheme();
  const sorted = [...group].sort((a, b) => a.id - b.id);

  // Главная — та, что останется. По умолчанию самая ранняя: в ней обычно
  // накоплена история общения с клиентом.
  const [primaryId, setPrimaryId] = useState<number>(sorted[0].id);

  // Из какой заявки берём каждое поле. Изначально — первое непустое значение,
  // начиная с главной: так поля-пустышки не перетирают заполненные.
  const initialSources = () => {
    const map: Record<string, number> = {};
    for (const f of MERGE_FIELD_GROUPS) {
      const withPrimaryFirst = [
        ...sorted.filter(c => c.id === primaryId),
        ...sorted.filter(c => c.id !== primaryId),
      ];
      const found = withPrimaryFirst.find(c => !isEmptyValue(c[f.key]));
      map[String(f.key)] = (found ?? sorted[0]).id;
    }
    return map;
  };
  const [sources, setSources] = useState<Record<string, number>>(initialSources);

  const [busy, setBusy] = useState(false);
  const [notDupBusy, setNotDupBusy] = useState(false);
  const [err, setErr] = useState("");

  // Смена главной пересобирает выбор полей — иначе в новой главной остались бы
  // подставленные значения от прежней, и результат был бы неочевиден.
  const changePrimary = (id: number) => {
    setPrimaryId(id);
    const map: Record<string, number> = {};
    for (const f of MERGE_FIELD_GROUPS) {
      const order = [...sorted.filter(c => c.id === id), ...sorted.filter(c => c.id !== id)];
      const found = order.find(c => !isEmptyValue(c[f.key]));
      map[String(f.key)] = (found ?? sorted[0]).id;
    }
    setSources(map);
  };

  const merge = async () => {
    setErr(""); setBusy(true);
    const res = await crmFetch("merge-clients", {
      method: "POST",
      body: JSON.stringify({
        primary_id: primaryId,
        merge_ids: sorted.filter(c => c.id !== primaryId).map(c => c.id),
        field_sources: sources,
      }),
    }) as { error?: string };
    setBusy(false);
    if (res?.error) { setErr(res.error); return; }
    onMerged();
    onClose();
  };

  const markNotDuplicate = async () => {
    setErr(""); setNotDupBusy(true);
    try {
      await onNotDuplicate(sorted.map(c => c.id));
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось сохранить пометку");
    } finally {
      setNotDupBusy(false);
    }
  };

  const fmtDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

  // Показываем только поля, где хоть у кого-то есть значение — пустые строки
  // сравнивать бессмысленно, они лишь удлиняют таблицу.
  const visibleFields = MERGE_FIELD_GROUPS.filter(f => sorted.some(c => !isEmptyValue(c[f.key])));
  const groupNames = Array.from(new Set(visibleFields.map(f => f.group)));
  const colWidth = `${Math.max(160, Math.floor(560 / sorted.length))}px`;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3"
      style={{ background: "rgba(0,0,0,0.8)" }} onClick={onClose}>
      <div className="w-full max-w-4xl rounded-2xl overflow-hidden flex flex-col max-h-[94vh]"
        style={{ background: t.surface, border: `1px solid ${t.border}` }}
        onClick={e => e.stopPropagation()}>

        {/* Шапка */}
        <div className="px-5 py-4 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#ef444422" }}>
              <Icon name="Copy" size={17} style={{ color: "#ef4444" }} />
            </div>
            <div>
              <div className="text-base font-bold" style={{ color: t.text }}>Сравнение дублей</div>
              <div className="text-[11px]" style={{ color: t.textMute }}>
                {sorted.length} заявки · выберите, какие значения оставить
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ color: t.textMute }}><Icon name="X" size={16} /></button>
        </div>

        {/* Выбор главной заявки */}
        <div className="px-5 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}`, background: t.surface2 + "60" }}>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: t.textMute }}>
            Главная заявка — останется в работе, остальные уйдут в корзину
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {sorted.map(c => {
              const sel = c.id === primaryId;
              return (
                <button key={c.id} onClick={() => changePrimary(c.id)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl transition text-left"
                  style={{
                    background: sel ? "#10b98115" : t.surface,
                    border: `1.5px solid ${sel ? "#10b981" : t.border}`,
                  }}>
                  <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: sel ? "#10b981" : "transparent", border: `1.5px solid ${sel ? "#10b981" : t.border2}` }}>
                    {sel && <Icon name="Check" size={10} style={{ color: "#fff" }} />}
                  </span>
                  <span>
                    <span className="block text-xs font-bold" style={{ color: sel ? "#10b981" : t.text }}>
                      №{c.id}
                    </span>
                    <span className="block text-[10px]" style={{ color: t.textMute }}>
                      {fmtDate(c.created_at)} · {STATUS_LABELS[c.status] || c.status}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Таблица сравнения полей */}
        <div className="flex-1 overflow-auto px-5 py-3">
          <div className="min-w-max">
            {/* Заголовок колонок */}
            <div className="flex items-center gap-2 pb-2 sticky top-0 z-10" style={{ background: t.surface }}>
              <div className="w-40 flex-shrink-0 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: t.textMute }}>Поле</div>
              {sorted.map(c => (
                <div key={c.id} className="flex-shrink-0 text-[11px] font-bold text-center"
                  style={{ width: colWidth, color: c.id === primaryId ? "#10b981" : t.textSub }}>
                  №{c.id}{c.id === primaryId && " · главная"}
                </div>
              ))}
            </div>

            {groupNames.map(gname => (
              <div key={gname} className="mb-1">
                <div className="text-[9px] font-bold uppercase tracking-wider py-1.5" style={{ color: t.textMute }}>
                  {gname}
                </div>
                {visibleFields.filter(f => f.group === gname).map(f => {
                  const values = sorted.map(c => displayValue(c, f));
                  const nonEmpty = values.filter(v => v !== "");
                  // Расхождение = есть минимум два РАЗНЫХ непустых значения.
                  // Только такие строки требуют внимания — их подсвечиваем.
                  const conflict = new Set(nonEmpty).size > 1;
                  return (
                    <div key={String(f.key)} className="flex items-stretch gap-2 mb-1 rounded-lg"
                      style={{ background: conflict ? "#f59e0b0e" : "transparent" }}>
                      <div className="w-40 flex-shrink-0 flex items-center gap-1 text-[11px] py-2 px-1"
                        style={{ color: t.textSub }}>
                        {conflict && <Icon name="AlertTriangle" size={10} style={{ color: "#f59e0b", flexShrink: 0 }} />}
                        <span className="truncate">{f.label}</span>
                      </div>
                      {sorted.map(c => {
                        const val = displayValue(c, f);
                        const chosen = sources[String(f.key)] === c.id;
                        const empty = val === "";
                        return (
                          <button key={c.id}
                            disabled={empty}
                            onClick={() => setSources(p => ({ ...p, [String(f.key)]: c.id }))}
                            className="flex-shrink-0 flex items-start gap-1.5 px-2 py-2 rounded-lg text-left transition disabled:cursor-default"
                            style={{
                              width: colWidth,
                              background: chosen && !empty ? "#10b98118" : t.surface2 + "70",
                              border: `1.5px solid ${chosen && !empty ? "#10b981" : "transparent"}`,
                              opacity: empty ? 0.35 : 1,
                            }}>
                            <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                              style={{
                                background: chosen && !empty ? "#10b981" : "transparent",
                                border: `1.5px solid ${chosen && !empty ? "#10b981" : t.border2}`,
                              }}>
                              {chosen && !empty && <Icon name="Check" size={8} style={{ color: "#fff" }} />}
                            </span>
                            <span className="text-[11px] break-words" style={{ color: empty ? t.textMute : t.text }}>
                              {empty ? "—" : val}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {err && (
            <div className="mt-3 rounded-xl px-3.5 py-2.5 text-xs"
              style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
              {err}
            </div>
          )}
        </div>

        {/* Кнопки */}
        <div className="flex gap-2 px-5 py-4 flex-wrap flex-shrink-0" style={{ borderTop: `1px solid ${t.border}` }}>
          <button onClick={merge} disabled={busy || notDupBusy}
            className="flex-1 min-w-[200px] py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "#10b981" }}>
            {busy
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Объединение...</>
              : <><Icon name="Merge" size={14} /> Объединить в №{primaryId}</>}
          </button>
          <button onClick={markNotDuplicate} disabled={busy || notDupBusy}
            title="Клиент реально заказал несколько раз — вернуть заявки в воронку"
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50 flex items-center gap-2"
            style={{ background: "#38bdf818", color: "#38bdf8", border: "1px solid #38bdf840" }}>
            {notDupBusy
              ? <><div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" /> Сохранение...</>
              : <><Icon name="CircleSlash" size={14} /> Это не дубль</>}
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