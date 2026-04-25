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

function InlineField({
  label, value, onSave, type = "text", placeholder = "Пустое значение"
}: {
  label: string;
  value: string | number | null | undefined;
  onSave: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const t = useTheme();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value ?? ""));
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    setEditing(false);
    if (val !== String(value ?? "")) onSave(val);
  };

  return (
    <div className="flex items-center justify-between py-2.5 group" style={{ borderBottom: `1px solid ${t.border2}` }}>
      <span className="text-sm w-48 flex-shrink-0" style={{ color: t.textMute }}>{label}</span>
      {editing ? (
        <input
          ref={inputRef} type={type} value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          autoFocus
          className="flex-1 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
          style={{ background: t.surface2, color: t.text, border: "1px solid #7c3aed40" }}
        />
      ) : (
        <button onClick={() => { setEditing(true); setVal(String(value ?? "")); }}
          className="flex-1 text-right text-sm hover:text-violet-300 transition truncate"
          style={{ color: t.textSub }}>
          {value ? (
            <span style={{ color: t.text }}>
              {type === "datetime-local" && value
                ? new Date(String(value)).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
                : type === "number" && value
                ? Number(value).toLocaleString("ru-RU")
                : String(value)}
            </span>
          ) : (
            <span className="text-violet-400/70 underline underline-offset-2 decoration-dashed text-xs">{placeholder}</span>
          )}
        </button>
      )}
    </div>
  );
}

function FileField({
  label, url, onUploaded, accept = "*"
}: {
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
    <div className="flex items-start justify-between py-2.5" style={{ borderBottom: `1px solid ${t.border2}` }}>
      <span className="text-sm w-48 flex-shrink-0 pt-1" style={{ color: t.textMute }}>{label}</span>
      <div className="flex-1 flex flex-col items-end gap-2">
        {isImage && url && (
          <a href={url} target="_blank" rel="noreferrer">
            <img src={url} alt={label} className="w-32 h-20 object-cover rounded-lg" style={{ border: `1px solid ${t.border}` }} />
          </a>
        )}
        {!isImage && url && (
          <a href={url} target="_blank" rel="noreferrer"
            className="text-xs text-violet-400 underline underline-offset-2 flex items-center gap-1">
            <Icon name="FileText" size={12} /> Открыть файл
          </a>
        )}
        <button onClick={() => ref.current?.click()}
          className="text-xs text-violet-400/70 underline underline-offset-2 decoration-dashed hover:text-violet-300 transition flex items-center gap-1">
          {uploading ? <><Icon name="Loader2" size={11} className="animate-spin" /> Загрузка...</> : <><Icon name="Upload" size={11} /> {url ? "Заменить" : "Добавить файл"}</>}
        </button>
        <input ref={ref} type="file" accept={accept} className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}

function TagsField({ tags, onSave }: { tags: string[] | null; onSave: (tags: string[]) => void }) {
  const t = useTheme();
  const current = tags || [];
  const [custom, setCustom] = useState("");

  const toggle = (label: string) => {
    const next = current.includes(label) ? current.filter(tg => tg !== label) : [...current, label];
    onSave(next);
  };

  const addCustom = () => {
    if (!custom.trim()) return;
    if (!current.includes(custom.trim())) onSave([...current, custom.trim()]);
    setCustom("");
  };

  return (
    <div className="py-2.5" style={{ borderBottom: `1px solid ${t.border2}` }}>
      <div className="text-sm mb-2" style={{ color: t.textMute }}>Метки</div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {DEFAULT_TAGS.map(tg => (
          <button key={tg.label} onClick={() => toggle(tg.label)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium transition border"
            style={current.includes(tg.label)
              ? { background: tg.color + "25", color: tg.color, borderColor: tg.color + "50" }
              : { borderColor: "transparent", background: t.surface2, color: t.textMute }}>
            {tg.label}
          </button>
        ))}
        {current.filter(tg => !DEFAULT_TAGS.find(d => d.label === tg)).map(tg => (
          <span key={tg} className="px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1"
            style={{ background: t.surface2, color: t.textSub }}>
            {tg}
            <button onClick={() => toggle(tg)} className="hover:text-red-400 transition ml-0.5" style={{ color: t.textMute }}>
              <Icon name="X" size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addCustom()}
          placeholder="Добавить метку..."
          className="flex-1 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-violet-500/50"
          style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}
        />
        <button onClick={addCustom} className="px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 text-xs rounded-lg transition">+</button>
      </div>
    </div>
  );
}

function StatusSelector({ status, onSave }: { status: string; onSave: (s: string) => void }) {
  const t = useTheme();
  const ALL = [...LEAD_STATUSES, ...ORDER_STATUSES];
  return (
    <div className="py-2.5" style={{ borderBottom: `1px solid ${t.border2}` }}>
      <div className="text-sm mb-2" style={{ color: t.textMute }}>Статус воронки</div>
      <div className="flex flex-wrap gap-1.5">
        {ALL.map(s => (
          <button key={s} onClick={() => onSave(s)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium transition border"
            style={status === s
              ? { background: STATUS_COLORS[s] + "25", color: STATUS_COLORS[s], borderColor: STATUS_COLORS[s] + "50" }
              : { borderColor: "transparent", background: t.surface2, color: t.textMute }}>
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ClientDrawer({ client, allClientOrders, onClose, onUpdated, onDeleted }: Props) {
  const t = useTheme();
  const [data, setData] = useState<Client>(client);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"info" | "orders" | "estimate">("info");

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

  const isOrder = ORDER_STATUSES.includes(data.status);

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Затемнение */}
      <div className="flex-1 bg-black/50" />

      {/* Панель */}
      <div
        className="w-full max-w-lg flex flex-col h-full overflow-hidden shadow-2xl"
        style={{ background: t.surface, borderLeft: `1px solid ${t.border}` }}
        onClick={e => e.stopPropagation()}>

        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
              style={{ background: STATUS_COLORS[data.status] + "30", border: `1.5px solid ${STATUS_COLORS[data.status]}50` }}>
              {(data.client_name || "?").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: t.text }}>{data.client_name || "Без имени"}</div>
              <span className="text-[11px] px-2 py-0.5 rounded-md font-medium"
                style={{ background: STATUS_COLORS[data.status] + "20", color: STATUS_COLORS[data.status] }}>
                {STATUS_LABELS[data.status] || data.status}
              </span>
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

        {/* Табы вкладок */}
        <div className="flex px-5 gap-1 pt-3" style={{ borderBottom: `1px solid ${t.border}` }}>
          {([
            { id: "info",     label: "Заявка",  icon: "User" },
            { id: "orders",   label: `История (${allClientOrders.length})`, icon: "ClipboardList" },
            { id: "estimate", label: "Смета",   icon: "FileSpreadsheet" },
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

        {/* Контент */}
        <div className="flex-1 overflow-y-auto px-5 py-3">

          {drawerTab === "estimate" && <EstimateEditor chatId={data.id} />}

          {drawerTab === "orders" && (
            <div className="space-y-2 py-2">
              {allClientOrders.length === 0 && (
                <div className="text-sm text-center py-10" style={{ color: t.textMute }}>Нет заявок</div>
              )}
              {[...allClientOrders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(order => (
                <button
                  key={order.id}
                  onClick={() => { setData(order); setDrawerTab("info"); }}
                  className="w-full text-left rounded-xl p-3 transition"
                  style={{
                    background: data.id === order.id ? "#7c3aed18" : t.surface2,
                    border: `1px solid ${data.id === order.id ? "#7c3aed50" : t.border}`,
                  }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-md font-medium"
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
                      <span className="text-xs font-semibold whitespace-nowrap" style={{ color: t.text }}>
                        {Number(order.contract_sum).toLocaleString("ru-RU")} ₽
                      </span>
                    ) : null}
                  </div>
                  {data.id === order.id && (
                    <div className="text-[10px] mt-1 font-medium" style={{ color: "#7c3aed" }}>Открыта сейчас</div>
                  )}
                </button>
              ))}
            </div>
          )}

          {drawerTab === "info" && <>
          {/* Статус */}
          <StatusSelector status={data.status} onSave={s => save({ status: s })} />

          {/* Метки */}
          <TagsField tags={data.tags} onSave={tags => save({ tags })} />

          {/* Основная инфо */}
          <div className="mt-1">
            <div className="text-xs font-semibold uppercase tracking-wider py-2" style={{ color: t.textMute }}>Контакты</div>
            <InlineField label="Имя клиента" value={data.client_name} onSave={v => save({ client_name: v })} />
            <InlineField label="Телефон заказчика" value={data.phone} onSave={v => save({ phone: v })} placeholder="Добавить телефон" />
            <InlineField label="Телефон ответственного" value={data.responsible_phone} onSave={v => save({ responsible_phone: v })} placeholder="Прораб / дизайнер" />
          </div>

          {/* Объект */}
          <div className="mt-1">
            <div className="text-xs font-semibold uppercase tracking-wider py-2" style={{ color: t.textMute }}>Объект</div>
            <InlineField label="Адрес" value={data.address} onSave={v => save({ address: v })} placeholder="Пустое значение" />
            <InlineField label="Точка на карте" value={data.map_link} onSave={v => save({ map_link: v })} placeholder="Добавить ссылку" />
            <InlineField label="Площадь (м²)" value={data.area} onSave={v => save({ area: +v || null } as Partial<Client>)} type="number" placeholder="Пустое значение" />
          </div>

          {/* Даты */}
          <div className="mt-1">
            <div className="text-xs font-semibold uppercase tracking-wider py-2" style={{ color: t.textMute }}>Даты</div>
            <InlineField label="Дата замера" value={data.measure_date ? data.measure_date.slice(0, 16) : ""} onSave={v => save({ measure_date: v || null })} type="datetime-local" placeholder="Добавить дату" />
            <InlineField label="Дата монтажа" value={data.install_date ? data.install_date.slice(0, 16) : ""} onSave={v => save({ install_date: v || null })} type="datetime-local" placeholder="Добавить дату" />
          </div>

          {/* Финансы (доходы) */}
          <div className="mt-1">
            <div className="text-xs font-semibold uppercase tracking-wider py-2" style={{ color: t.textMute }}>Финансы — Доходы</div>
            <InlineField label="Сумма договора" value={data.contract_sum} onSave={v => save({ contract_sum: +v || null } as Partial<Client>)} type="number" placeholder="Пустое значение" />
            <InlineField label="Предоплата" value={data.prepayment} onSave={v => save({ prepayment: +v || null } as Partial<Client>)} type="number" placeholder="Пустое значение" />
            <InlineField label="Доплата" value={data.extra_payment} onSave={v => save({ extra_payment: +v || null } as Partial<Client>)} type="number" placeholder="Пустое значение" />
            <InlineField label="Сумма доп. соглашения" value={data.extra_agreement_sum} onSave={v => save({ extra_agreement_sum: +v || null } as Partial<Client>)} type="number" placeholder="Пустое значение" />
          </div>

          {/* Затраты (себестоимость) */}
          <div className="mt-1">
            <div className="text-xs font-semibold uppercase tracking-wider py-2" style={{ color: t.textMute }}>Затраты — Себестоимость</div>
            <InlineField label="Стоимость материалов" value={data.material_cost} onSave={v => save({ material_cost: +v || null } as Partial<Client>)} type="number" placeholder="Пустое значение" />
            <InlineField label="Стоимость замера" value={data.measure_cost} onSave={v => save({ measure_cost: +v || null } as Partial<Client>)} type="number" placeholder="Пустое значение" />
            <InlineField label="Стоимость монтажа" value={data.install_cost} onSave={v => save({ install_cost: +v || null } as Partial<Client>)} type="number" placeholder="Пустое значение" />
          </div>

          {/* Файлы */}
          <div className="mt-1">
            <div className="text-xs font-semibold uppercase tracking-wider py-2" style={{ color: t.textMute }}>Файлы</div>
            <FileField label="Фото до монтажа" url={data.photo_before_url} accept="image/*" onUploaded={url => save({ photo_before_url: url })} />
            <FileField label="Фото после монтажа" url={data.photo_after_url} accept="image/*" onUploaded={url => save({ photo_after_url: url })} />
            <FileField label="Договор / Смета / Замер" url={data.document_url} accept=".pdf,.doc,.docx,.xls,.xlsx" onUploaded={url => save({ document_url: url })} />
          </div>

          {/* Причина отказа — только если отменён */}
          {data.status === "cancelled" && (
            <div className="mt-1">
              <div className="text-xs text-red-400/60 font-semibold uppercase tracking-wider py-2">Причина отказа</div>
              <InlineField label="Почему отказал?" value={data.cancel_reason} onSave={v => save({ cancel_reason: v })} placeholder="Укажите причину отказа" />
            </div>
          )}

          {/* Заметки */}
          <div className="mt-1">
            <div className="text-xs font-semibold uppercase tracking-wider py-2" style={{ color: t.textMute }}>Заметки</div>
            <textarea
              value={data.notes || ""}
              onChange={e => setData({ ...data, notes: e.target.value })}
              onBlur={e => { if (e.target.value !== (client.notes || "")) save({ notes: e.target.value }); }}
              placeholder="Добавить заметку..."
              rows={3}
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500/40 resize-none transition"
              style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}
            />
          </div>

          {/* Финансовая мини-сводка */}
          {(data.contract_sum || data.material_cost || data.install_cost) && (
            <div className="mt-3 rounded-xl p-4" style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
              <div className="text-xs mb-3 font-semibold uppercase tracking-wider" style={{ color: t.textMute }}>Мини P&L по заказу</div>
              <div className="space-y-1.5 text-sm">
                {data.contract_sum && (
                  <div className="flex justify-between">
                    <span style={{ color: t.textMute }}>Договор</span>
                    <span className="font-semibold" style={{ color: t.text }}>{data.contract_sum.toLocaleString("ru-RU")} ₽</span>
                  </div>
                )}
                {data.prepayment && (
                  <div className="flex justify-between">
                    <span style={{ color: t.textMute }}>Предоплата</span>
                    <span className="text-emerald-400">+{data.prepayment.toLocaleString("ru-RU")} ₽</span>
                  </div>
                )}
                {data.extra_payment && (
                  <div className="flex justify-between">
                    <span style={{ color: t.textMute }}>Доплата</span>
                    <span className="text-emerald-400">+{data.extra_payment.toLocaleString("ru-RU")} ₽</span>
                  </div>
                )}
                {data.material_cost && (
                  <div className="flex justify-between">
                    <span style={{ color: t.textMute }}>Материалы</span>
                    <span className="text-red-400">−{data.material_cost.toLocaleString("ru-RU")} ₽</span>
                  </div>
                )}
                {data.measure_cost && (
                  <div className="flex justify-between">
                    <span style={{ color: t.textMute }}>Замер</span>
                    <span className="text-red-400/70">−{data.measure_cost.toLocaleString("ru-RU")} ₽</span>
                  </div>
                )}
                {data.install_cost && (
                  <div className="flex justify-between">
                    <span style={{ color: t.textMute }}>Монтаж</span>
                    <span className="text-red-400/70">−{data.install_cost.toLocaleString("ru-RU")} ₽</span>
                  </div>
                )}
                <div className="pt-2 mt-1 flex justify-between" style={{ borderTop: `1px solid ${t.border}` }}>
                  <span className="font-semibold" style={{ color: t.textMute }}>Прибыль</span>
                  <span className={`font-bold ${(() => {
                    const profit = (data.contract_sum||0) - (data.material_cost||0) - (data.measure_cost||0) - (data.install_cost||0);
                    return profit >= 0 ? "text-emerald-400" : "text-red-400";
                  })()}`}>
                    {(() => {
                      const profit = (data.contract_sum||0) - (data.material_cost||0) - (data.measure_cost||0) - (data.install_cost||0);
                      return (profit >= 0 ? "+" : "") + profit.toLocaleString("ru-RU") + " ₽";
                    })()}
                  </span>
                </div>
                {data.contract_sum && (
                  <div className="flex justify-between text-xs">
                    <span style={{ color: t.textMute }}>Остаток к оплате</span>
                    <span className="text-amber-400 font-semibold">
                      {((data.contract_sum||0) - (data.prepayment||0) - (data.extra_payment||0)).toLocaleString("ru-RU")} ₽
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Метаданные */}
          <div className="mt-4 mb-6 text-xs space-y-1" style={{ color: t.textMute }}>
            <div>Источник: {data.source || "chat"}</div>
            <div>Добавлен: {new Date(data.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</div>
            <div>ID: #{data.id}</div>
          </div>
          </>}
        </div>
      </div>

      {/* Подтверждение удаления */}
      {confirmDelete && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/60" onClick={() => setConfirmDelete(false)}>
          <div className="rounded-2xl p-6 w-80 shadow-2xl" style={{ background: t.surface, border: "1px solid rgba(239,68,68,0.2)" }} onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
              <Icon name="Trash2" size={22} className="text-red-400" />
            </div>
            <h3 className="text-base font-bold text-center mb-2" style={{ color: t.text }}>Удалить клиента?</h3>
            <p className="text-sm text-center mb-5" style={{ color: t.textMute }}>«{data.client_name || "Клиент"}» будет удалён</p>
            <div className="flex gap-2">
              <button onClick={handleDelete} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-xl font-medium transition">Удалить</button>
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 text-sm rounded-xl transition hover:bg-white/10"
                style={{ background: t.surface2, color: t.textSub }}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}