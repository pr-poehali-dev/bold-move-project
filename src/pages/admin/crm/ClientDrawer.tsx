import { useState, useRef } from "react";
import { crmFetch, uploadFile, STATUS_LABELS, STATUS_COLORS, LEAD_STATUSES, ORDER_STATUSES, DEFAULT_TAGS, Client } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import EstimateEditor from "./EstimateEditor";

interface Props {
  client: Client;
  allClientOrders: Client[];
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

// ── InlineField ──────────────────────────────────────────────────────────────
function InlineField({ label, value, onSave, type = "text", placeholder = "—" }: {
  label: string;
  value: string | number | null | undefined;
  onSave: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const t = useTheme();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value ?? ""));
  const ref = useRef<HTMLInputElement>(null);

  const commit = () => {
    setEditing(false);
    if (val !== String(value ?? "")) onSave(val);
  };

  const displayVal = () => {
    if (!value) return null;
    if (type === "datetime-local")
      return new Date(String(value)).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
    if (type === "number") return Number(value).toLocaleString("ru-RU");
    return String(value);
  };

  return (
    <div className="flex items-center justify-between py-2 group" style={{ borderBottom: `1px solid ${t.border2}` }}>
      <span className="text-xs flex-shrink-0 w-36" style={{ color: t.textMute }}>{label}</span>
      {editing ? (
        <input ref={ref} type={type} value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          autoFocus
          className="flex-1 rounded-lg px-2 py-1 text-sm text-right focus:outline-none"
          style={{ background: t.surface2, color: "#fff", border: "1px solid #7c3aed50" }}
        />
      ) : (
        <button onClick={() => { setEditing(true); setVal(String(value ?? "")); }}
          className="flex-1 text-right text-sm transition hover:opacity-70 truncate">
          {displayVal()
            ? <span style={{ color: "#fff" }}>{displayVal()}</span>
            : <span className="text-xs text-violet-400/60 underline underline-offset-2 decoration-dashed">{placeholder}</span>}
        </button>
      )}
    </div>
  );
}

// ── Section ──────────────────────────────────────────────────────────────────
function Section({ icon, title, color = "#8b5cf6", children }: {
  icon: string; title: string; color?: string; children: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${t.border}` }}>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + "20" }}>
          <Icon name={icon} size={12} style={{ color }} />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{title}</span>
      </div>
      <div className="px-4 pb-1">{children}</div>
    </div>
  );
}

// ── FileField ─────────────────────────────────────────────────────────────────
function FileField({ label, url, onUploaded, accept = "*" }: {
  label: string; url: string | null | undefined;
  onUploaded: (url: string) => void; accept?: string;
}) {
  const t = useTheme();
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const u = await uploadFile(file);
    onUploaded(u);
    setUploading(false);
  };

  const isImage = url && /\.(jpg|jpeg|png|webp|gif)$/i.test(url);

  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${t.border2}` }}>
      <span className="text-xs w-36 flex-shrink-0" style={{ color: t.textMute }}>{label}</span>
      <div className="flex items-center gap-2">
        {isImage && url && (
          <a href={url} target="_blank" rel="noreferrer">
            <img src={url} alt={label} className="w-12 h-8 object-cover rounded-md" style={{ border: `1px solid ${t.border}` }} />
          </a>
        )}
        {!isImage && url && (
          <a href={url} target="_blank" rel="noreferrer" className="text-xs text-violet-400 underline flex items-center gap-1">
            <Icon name="FileText" size={11} /> Открыть
          </a>
        )}
        <button onClick={() => ref.current?.click()}
          className="text-xs text-violet-400/70 underline decoration-dashed hover:text-violet-300 transition flex items-center gap-1">
          {uploading ? <><Icon name="Loader2" size={11} className="animate-spin" /> Загрузка...</> : <><Icon name="Upload" size={11} /> {url ? "Заменить" : "Загрузить"}</>}
        </button>
        <input ref={ref} type="file" accept={accept} className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}

// ── TagsField ─────────────────────────────────────────────────────────────────
function TagsField({ tags, onSave }: { tags: string[] | null; onSave: (tags: string[]) => void }) {
  const t = useTheme();
  const current = tags || [];
  const [custom, setCustom] = useState("");

  const toggle = (label: string) => {
    onSave(current.includes(label) ? current.filter(tg => tg !== label) : [...current, label]);
  };
  const addCustom = () => {
    if (!custom.trim() || current.includes(custom.trim())) return;
    onSave([...current, custom.trim()]);
    setCustom("");
  };

  return (
    <div className="pt-2 pb-1">
      <div className="flex flex-wrap gap-1.5 mb-2">
        {DEFAULT_TAGS.map(tg => (
          <button key={tg.label} onClick={() => toggle(tg.label)}
            className="px-2 py-0.5 rounded-lg text-xs font-medium transition border"
            style={current.includes(tg.label)
              ? { background: tg.color + "25", color: tg.color, borderColor: tg.color + "50" }
              : { borderColor: "transparent", background: t.surface, color: t.textMute }}>
            {tg.label}
          </button>
        ))}
        {current.filter(tg => !DEFAULT_TAGS.find(d => d.label === tg)).map(tg => (
          <span key={tg} className="px-2 py-0.5 rounded-lg text-xs font-medium flex items-center gap-1"
            style={{ background: t.surface, color: t.textSub }}>
            {tg}
            <button onClick={() => toggle(tg)} className="hover:text-red-400 transition" style={{ color: t.textMute }}>
              <Icon name="X" size={9} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={custom} onChange={e => setCustom(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addCustom()}
          placeholder="Новая метка..."
          className="flex-1 rounded-lg px-3 py-1 text-xs focus:outline-none"
          style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#fff" }} />
        <button onClick={addCustom} className="px-2.5 py-1 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 text-xs rounded-lg transition">+</button>
      </div>
    </div>
  );
}

// ── StatusSelector ────────────────────────────────────────────────────────────
function StatusSelector({ status, onSave }: { status: string; onSave: (s: string) => void }) {
  const t = useTheme();
  const ALL = [...LEAD_STATUSES, ...ORDER_STATUSES];
  return (
    <div className="pt-2 pb-1 flex flex-wrap gap-1.5">
      {ALL.map(s => (
        <button key={s} onClick={() => onSave(s)}
          className="px-2.5 py-1 rounded-lg text-xs font-medium transition border"
          style={status === s
            ? { background: STATUS_COLORS[s] + "25", color: STATUS_COLORS[s], borderColor: STATUS_COLORS[s] + "50" }
            : { borderColor: "transparent", background: t.surface, color: t.textMute }}>
          {STATUS_LABELS[s]}
        </button>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ClientDrawer({ client, allClientOrders, onClose, onUpdated, onDeleted }: Props) {
  const t = useTheme();
  const [data, setData]             = useState<Client>(client);
  const [saving, setSaving]         = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [drawerTab, setDrawerTab]   = useState<"info" | "orders" | "estimate">("info");

  const save = async (patch: Partial<Client>) => {
    const next = { ...data, ...patch };
    setData(next);
    setSaving(true);
    await crmFetch("clients", { method: "PUT", body: JSON.stringify(patch) }, { id: String(data.id) });
    setSaving(false);
    onUpdated();
  };

  const handleDelete = async () => {
    await crmFetch("clients", { method: "DELETE" }, { id: String(data.id) });
    onDeleted();
  };

  const profit = (data.contract_sum||0) - (data.material_cost||0) - (data.measure_cost||0) - (data.install_cost||0);
  const received = (data.prepayment||0) + (data.extra_payment||0);
  const remaining = (data.contract_sum||0) - received;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(5px)" }}>

      <div className="w-full flex flex-col overflow-hidden shadow-2xl"
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 20,
          maxWidth: drawerTab === "estimate" ? 1100 : 860,
          maxHeight: "92vh",
        }}
        onClick={e => e.stopPropagation()}>

        {/* ── Шапка ── */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white"
              style={{ background: STATUS_COLORS[data.status] + "35", border: `2px solid ${STATUS_COLORS[data.status]}50` }}>
              {(data.client_name || "?").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-base font-bold text-white">{data.client_name || "Без имени"}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold"
                  style={{ background: STATUS_COLORS[data.status] + "25", color: STATUS_COLORS[data.status] }}>
                  {STATUS_LABELS[data.status] || data.status}
                </span>
                {data.phone && <span className="text-xs" style={{ color: t.textMute }}>{data.phone}</span>}
                {data.contract_sum ? (
                  <span className="text-xs font-bold text-emerald-400">{data.contract_sum.toLocaleString("ru-RU")} ₽</span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saving && <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />}
            <button onClick={() => setConfirmDelete(true)} className="p-2 rounded-lg hover:bg-red-500/10 transition" style={{ color: t.textMute }}>
              <Icon name="Trash2" size={15} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition" style={{ color: t.textMute }}>
              <Icon name="X" size={16} />
            </button>
          </div>
        </div>

        {/* ── Табы ── */}
        <div className="flex px-6 gap-1 pt-3 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
          {([
            { id: "info",     label: "Заявка",   icon: "User" },
            { id: "orders",   label: `История (${allClientOrders.length})`, icon: "ClipboardList" },
            { id: "estimate", label: "Смета",    icon: "FileSpreadsheet" },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setDrawerTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition"
              style={drawerTab === tab.id
                ? { color: "#7c3aed", borderBottom: "2px solid #7c3aed", marginBottom: -1 }
                : { color: t.textMute }}>
              <Icon name={tab.icon} size={13} /> {tab.label}
            </button>
          ))}
        </div>

        {/* ── Контент ── */}
        <div className="flex-1 overflow-y-auto">

          {/* СМЕТА */}
          {drawerTab === "estimate" && (
            <div className="px-6 py-4">
              <EstimateEditor chatId={data.id} clientName={data.client_name} clientPhone={data.phone} />
            </div>
          )}

          {/* ИСТОРИЯ */}
          {drawerTab === "orders" && (
            <div className="px-6 py-4 space-y-2">
              {allClientOrders.length === 0 && (
                <div className="py-12 text-center text-sm" style={{ color: t.textMute }}>Нет заявок</div>
              )}
              {[...allClientOrders]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map(order => (
                  <button key={order.id} onClick={() => { setData(order); setDrawerTab("info"); }}
                    className="w-full text-left rounded-xl p-3.5 transition"
                    style={{
                      background: data.id === order.id ? "#7c3aed18" : t.surface2,
                      border: `1px solid ${data.id === order.id ? "#7c3aed50" : t.border}`,
                    }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs px-2 py-0.5 rounded-md font-semibold"
                        style={{ background: STATUS_COLORS[order.status] + "20", color: STATUS_COLORS[order.status] }}>
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                      <span className="text-[11px]" style={{ color: t.textMute }}>
                        {new Date(order.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs truncate" style={{ color: t.textSub }}>{order.address || "Адрес не указан"}</span>
                      {order.contract_sum ? (
                        <span className="text-sm font-bold text-emerald-400 whitespace-nowrap">
                          {Number(order.contract_sum).toLocaleString("ru-RU")} ₽
                        </span>
                      ) : null}
                    </div>
                    {data.id === order.id && (
                      <div className="text-[10px] mt-1 font-semibold" style={{ color: "#7c3aed" }}>● Открыта сейчас</div>
                    )}
                  </button>
                ))}
            </div>
          )}

          {/* ЗАЯВКА — два столбца */}
          {drawerTab === "info" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-6 py-4">

              {/* ── Левый столбец ── */}
              <div className="space-y-3">

                {/* Статус воронки */}
                <Section icon="GitBranch" title="Статус воронки" color="#8b5cf6">
                  <StatusSelector status={data.status} onSave={s => save({ status: s })} />
                </Section>

                {/* Метки */}
                <Section icon="Tag" title="Метки" color="#06b6d4">
                  <TagsField tags={data.tags} onSave={tags => save({ tags })} />
                </Section>

                {/* Контакты */}
                <Section icon="Phone" title="Контакты" color="#10b981">
                  <InlineField label="Имя клиента" value={data.client_name} onSave={v => save({ client_name: v })} placeholder="Добавить имя" />
                  <InlineField label="Телефон" value={data.phone} onSave={v => save({ phone: v })} placeholder="Добавить телефон" />
                  <InlineField label="Ответственный" value={data.responsible_phone} onSave={v => save({ responsible_phone: v })} placeholder="Прораб / дизайнер" />
                </Section>

                {/* Объект */}
                <Section icon="MapPin" title="Объект" color="#f59e0b">
                  <InlineField label="Адрес" value={data.address} onSave={v => save({ address: v })} placeholder="Добавить адрес" />
                  <InlineField label="Ссылка на карту" value={data.map_link} onSave={v => save({ map_link: v })} placeholder="Добавить ссылку" />
                  <InlineField label="Площадь (м²)" value={data.area} onSave={v => save({ area: +v || null } as Partial<Client>)} type="number" placeholder="—" />
                </Section>

                {/* Даты */}
                <Section icon="Calendar" title="Даты" color="#f97316">
                  <InlineField label="Дата замера" value={data.measure_date ? data.measure_date.slice(0, 16) : ""} onSave={v => save({ measure_date: v || null })} type="datetime-local" placeholder="Добавить дату" />
                  <InlineField label="Дата монтажа" value={data.install_date ? data.install_date.slice(0, 16) : ""} onSave={v => save({ install_date: v || null })} type="datetime-local" placeholder="Добавить дату" />
                </Section>

                {/* Заметки */}
                <Section icon="StickyNote" title="Заметки" color="#8b5cf6">
                  <textarea
                    value={data.notes || ""}
                    onChange={e => setData({ ...data, notes: e.target.value })}
                    onBlur={e => { if (e.target.value !== (client.notes || "")) save({ notes: e.target.value }); }}
                    placeholder="Добавить заметку..."
                    rows={3}
                    className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none transition mt-2 mb-1"
                    style={{ background: t.surface, border: `1px solid ${t.border}`, color: "#fff" }}
                  />
                </Section>
              </div>

              {/* ── Правый столбец ── */}
              <div className="space-y-3">

                {/* P&L мини-сводка */}
                {(data.contract_sum || data.material_cost || data.install_cost) ? (
                  <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, #7c3aed15, #10b98112)", border: `1px solid #7c3aed30` }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon name="TrendingUp" size={14} style={{ color: "#10b981" }} />
                      <span className="text-xs font-bold uppercase tracking-wider text-white">P&L по заказу</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      {data.contract_sum ? (
                        <div className="flex justify-between items-center">
                          <span style={{ color: t.textMute }}>Договор</span>
                          <span className="font-bold text-white">{data.contract_sum.toLocaleString("ru-RU")} ₽</span>
                        </div>
                      ) : null}
                      {received > 0 && (
                        <div className="flex justify-between items-center">
                          <span style={{ color: t.textMute }}>Получено</span>
                          <span className="font-semibold text-emerald-400">+{received.toLocaleString("ru-RU")} ₽</span>
                        </div>
                      )}
                      {remaining > 0 && data.contract_sum ? (
                        <div className="flex justify-between items-center">
                          <span style={{ color: t.textMute }}>Остаток</span>
                          <span className="font-semibold text-amber-400">{remaining.toLocaleString("ru-RU")} ₽</span>
                        </div>
                      ) : null}
                      {(data.material_cost || data.measure_cost || data.install_cost) ? (
                        <div className="flex justify-between items-center">
                          <span style={{ color: t.textMute }}>Затраты</span>
                          <span className="font-semibold text-red-400">−{((data.material_cost||0)+(data.measure_cost||0)+(data.install_cost||0)).toLocaleString("ru-RU")} ₽</span>
                        </div>
                      ) : null}
                      <div className="flex justify-between items-center pt-2 mt-1" style={{ borderTop: `1px solid ${t.border}` }}>
                        <span className="font-bold text-white">Прибыль</span>
                        <span className={`text-lg font-black ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {profit >= 0 ? "+" : ""}{profit.toLocaleString("ru-RU")} ₽
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Доходы */}
                <Section icon="Banknote" title="Доходы" color="#10b981">
                  <InlineField label="Сумма договора" value={data.contract_sum} onSave={v => save({ contract_sum: +v || null } as Partial<Client>)} type="number" placeholder="—" />
                  <InlineField label="Предоплата" value={data.prepayment} onSave={v => save({ prepayment: +v || null } as Partial<Client>)} type="number" placeholder="—" />
                  <InlineField label="Доплата" value={data.extra_payment} onSave={v => save({ extra_payment: +v || null } as Partial<Client>)} type="number" placeholder="—" />
                  <InlineField label="Доп. соглашение" value={data.extra_agreement_sum} onSave={v => save({ extra_agreement_sum: +v || null } as Partial<Client>)} type="number" placeholder="—" />
                </Section>

                {/* Затраты */}
                <Section icon="Receipt" title="Затраты" color="#ef4444">
                  <InlineField label="Материалы" value={data.material_cost} onSave={v => save({ material_cost: +v || null } as Partial<Client>)} type="number" placeholder="—" />
                  <InlineField label="Замер" value={data.measure_cost} onSave={v => save({ measure_cost: +v || null } as Partial<Client>)} type="number" placeholder="—" />
                  <InlineField label="Монтаж" value={data.install_cost} onSave={v => save({ install_cost: +v || null } as Partial<Client>)} type="number" placeholder="—" />
                </Section>

                {/* Файлы */}
                <Section icon="Paperclip" title="Файлы" color="#06b6d4">
                  <FileField label="Фото до" url={data.photo_before_url} accept="image/*" onUploaded={url => save({ photo_before_url: url })} />
                  <FileField label="Фото после" url={data.photo_after_url} accept="image/*" onUploaded={url => save({ photo_after_url: url })} />
                  <FileField label="Договор / Смета" url={data.document_url} accept=".pdf,.doc,.docx,.xls,.xlsx" onUploaded={url => save({ document_url: url })} />
                </Section>

                {/* Причина отказа */}
                {data.status === "cancelled" && (
                  <Section icon="XCircle" title="Причина отказа" color="#ef4444">
                    <InlineField label="Причина" value={data.cancel_reason} onSave={v => save({ cancel_reason: v })} placeholder="Укажите причину" />
                  </Section>
                )}

                {/* Метаданные */}
                <div className="px-1 text-xs space-y-1" style={{ color: t.textMute }}>
                  <div>Источник: <span className="text-white/60">{data.source || "chat"}</span></div>
                  <div>Добавлен: <span className="text-white/60">{new Date(data.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</span></div>
                  <div>ID: <span className="text-white/60">#{data.id}</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Подтверждение удаления */}
      {confirmDelete && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] bg-black/60" onClick={() => setConfirmDelete(false)}>
          <div className="rounded-2xl p-6 w-80 shadow-2xl" style={{ background: t.surface, border: "1px solid rgba(239,68,68,0.25)" }} onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
              <Icon name="Trash2" size={22} className="text-red-400" />
            </div>
            <h3 className="text-base font-bold text-center mb-2 text-white">Удалить клиента?</h3>
            <p className="text-sm text-center mb-5" style={{ color: t.textMute }}>«{data.client_name || "Клиент"}» будет удалён</p>
            <div className="flex gap-2">
              <button onClick={handleDelete} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-xl font-semibold transition">Удалить</button>
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 text-sm rounded-xl transition"
                style={{ background: t.surface2, color: t.textSub }}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
