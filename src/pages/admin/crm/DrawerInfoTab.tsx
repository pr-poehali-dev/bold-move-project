import { Client } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { InlineField, Section, FileField, TagsField } from "./drawerComponents";
import { StatusSelector, ActivityFeed } from "./DrawerStatusActivity";

interface Props {
  data: Client;
  client: Client;
  setData: (c: Client) => void;
  save: (patch: Partial<Client>) => void;
  setComments: React.Dispatch<React.SetStateAction<{ text: string; date: string }[]>>;
}

export default function DrawerInfoTab({ data, client, setData, save, setComments }: Props) {
  const t = useTheme();

  const profit   = (data.contract_sum||0) - (data.material_cost||0) - (data.measure_cost||0) - (data.install_cost||0);
  const received = (data.prepayment||0) + (data.extra_payment||0);
  const remaining = (data.contract_sum||0) - received;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-6 py-4">

      {/* ── Левый столбец ── */}
      <div className="space-y-3">

        <Section icon="GitBranch" title="Статус воронки" color="#8b5cf6">
          <StatusSelector status={data.status} onSave={s => save({ status: s })} />
        </Section>

        <Section icon="Tag" title="Метки" color="#06b6d4">
          <TagsField tags={data.tags} onSave={tags => save({ tags })} />
        </Section>

        <Section icon="Phone" title="Контакты" color="#10b981">
          <InlineField label="Имя клиента"   value={data.client_name}      onSave={v => save({ client_name: v })}      placeholder="Добавить имя" />
          <InlineField label="Телефон"        value={data.phone}            onSave={v => save({ phone: v })}            placeholder="Добавить телефон" />
          <InlineField label="Ответственный"  value={data.responsible_phone} onSave={v => save({ responsible_phone: v })} placeholder="Прораб / дизайнер" />
        </Section>

        <Section icon="MapPin" title="Объект" color="#f59e0b">
          <InlineField label="Адрес"         value={data.address}  onSave={v => save({ address: v })}  placeholder="Добавить адрес" />
          <InlineField label="Ссылка на карту" value={data.map_link} onSave={v => save({ map_link: v })} placeholder="Добавить ссылку" />
          <InlineField label="Площадь (м²)"  value={data.area}     onSave={v => save({ area: +v || null } as Partial<Client>)} type="number" placeholder="—" />
        </Section>

        <Section icon="Calendar" title="Даты" color="#f97316">
          <InlineField label="Дата замера"  value={data.measure_date ? data.measure_date.slice(0, 16) : ""}   onSave={v => save({ measure_date: v || null })}  type="datetime-local" placeholder="Добавить дату" />
          <InlineField label="Дата монтажа" value={data.install_date ? data.install_date.slice(0, 16) : ""}   onSave={v => save({ install_date: v || null })}  type="datetime-local" placeholder="Добавить дату" />
        </Section>

        <Section icon="StickyNote" title="Заметки" color="#8b5cf6">
          <textarea
            value={(() => {
              const notes = data.notes || "";
              const lines = notes.split("\n").filter(l =>
                !l.includes("Смета сохранена") &&
                !l.includes("Email:") &&
                !l.includes("Estimate ID:")
              );
              return lines.join("\n").trim();
            })()}
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

        <Section icon="Banknote" title="Доходы" color="#10b981">
          <InlineField label="Сумма договора" value={data.contract_sum}       onSave={v => save({ contract_sum: +v || null } as Partial<Client>)}       type="number" placeholder="—" />
          <InlineField label="Предоплата"      value={data.prepayment}         onSave={v => save({ prepayment: +v || null } as Partial<Client>)}         type="number" placeholder="—" />
          <InlineField label="Доплата"         value={data.extra_payment}      onSave={v => save({ extra_payment: +v || null } as Partial<Client>)}      type="number" placeholder="—" />
          <InlineField label="Доп. соглашение" value={data.extra_agreement_sum} onSave={v => save({ extra_agreement_sum: +v || null } as Partial<Client>)} type="number" placeholder="—" />
        </Section>

        <Section icon="Receipt" title="Затраты" color="#ef4444">
          <InlineField label="Материалы" value={data.material_cost}  onSave={v => save({ material_cost: +v || null } as Partial<Client>)}  type="number" placeholder="—" />
          <InlineField label="Замер"      value={data.measure_cost}   onSave={v => save({ measure_cost: +v || null } as Partial<Client>)}   type="number" placeholder="—" />
          <InlineField label="Монтаж"     value={data.install_cost}   onSave={v => save({ install_cost: +v || null } as Partial<Client>)}   type="number" placeholder="—" />
        </Section>

        <Section icon="Paperclip" title="Файлы" color="#06b6d4">
          <FileField label="Фото до"         url={data.photo_before_url} accept="image/*"                      onUploaded={url => save({ photo_before_url: url })} />
          <FileField label="Фото после"      url={data.photo_after_url}  accept="image/*"                      onUploaded={url => save({ photo_after_url: url })} />
          <FileField label="Договор / Смета" url={data.document_url}     accept=".pdf,.doc,.docx,.xls,.xlsx"   onUploaded={url => save({ document_url: url })} />
        </Section>

        {data.status === "cancelled" && (
          <Section icon="XCircle" title="Причина отказа" color="#ef4444">
            <InlineField label="Причина" value={data.cancel_reason} onSave={v => save({ cancel_reason: v })} placeholder="Укажите причину" />
          </Section>
        )}

        <ActivityFeed client={data} onAddComment={text => {
          const entry = { text, date: new Date().toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) };
          setComments(prev => [...prev, entry]);
          const newNotes = (data.notes ? data.notes + "\n" : "") + `[${entry.date}] ${text}`;
          save({ notes: newNotes });
        }} />

        <div className="text-[10px] opacity-30 px-1" style={{ color: t.textMute }}>
          ID #{data.id} · {data.source || "chat"}
        </div>
      </div>
    </div>
  );
}
