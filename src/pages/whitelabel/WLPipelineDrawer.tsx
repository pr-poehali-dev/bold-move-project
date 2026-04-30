import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { AUTH_URL, DEMO_STATUSES } from "./wlTypes";
import type { DemoPipelineCompany, DemoStatus, PanelView } from "./wlTypes";

interface Props {
  company: DemoPipelineCompany;
  onClose: () => void;
  onUpdate: (patch: Partial<DemoPipelineCompany>) => void;
  onDelete: () => void;
  onOpenPanel: (p: PanelView, token?: string) => void;
  onRunApiTests: (cid: number) => void;
}

const masterToken = () => localStorage.getItem("mp_user_token") || "";

async function loginAs(companyId: number): Promise<string | null> {
  const r = await fetch(`${AUTH_URL}?action=admin-login-as`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Authorization": masterToken() },
    body: JSON.stringify({ user_id: companyId }),
  });
  const d = await r.json();
  return d.token || null;
}

function Field({ label, value, onChange, type = "text", placeholder = "" }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">{label}</div>
      {type === "textarea" ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded-xl px-3 py-2 text-xs bg-white/[0.04] border border-white/[0.08] text-white/80 placeholder-white/20 outline-none focus:border-violet-500/50 resize-none transition"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl px-3 py-2 text-xs bg-white/[0.04] border border-white/[0.08] text-white/80 placeholder-white/20 outline-none focus:border-violet-500/50 transition"
        />
      )}
    </div>
  );
}

export function WLPipelineDrawer({ company, onClose, onUpdate, onDelete, onOpenPanel, onRunApiTests }: Props) {
  const [form, setForm] = useState({
    status:           company.status,
    contact_name:     company.contact_name,
    contact_phone:    company.contact_phone,
    contact_position: company.contact_position,
    notes:            company.notes,
    next_action:      company.next_action,
    next_action_date: company.next_action_date,
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    setForm({
      status:           company.status,
      contact_name:     company.contact_name,
      contact_phone:    company.contact_phone,
      contact_position: company.contact_position,
      notes:            company.notes,
      next_action:      company.next_action,
      next_action_date: company.next_action_date,
    });
  }, [company.demo_id]);

  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    await fetch(`${AUTH_URL}?action=admin-update-demo`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Authorization": masterToken() },
      body: JSON.stringify({ demo_id: company.demo_id, ...form }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onUpdate({ ...form, status: form.status as DemoStatus });
  };

  const handleDelete = async () => {
    if (!window.confirm(`Удалить «${company.company_name}»?`)) return;
    await fetch(`${AUTH_URL}?action=admin-delete-demo-company`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Authorization": masterToken() },
      body: JSON.stringify({ demo_id: company.demo_id }),
    });
    onDelete();
    onClose();
  };

  const color   = company.brand_color || "#8b5cf6";
  const domain  = company.site_url.replace(/https?:\/\//, "").split("/")[0];
  const statusInfo = DEMO_STATUSES.find(s => s.id === form.status) || DEMO_STATUSES[0];

  const btn = "flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition hover:opacity-80";

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" />

      {/* Drawer */}
      <div
        className="w-full max-w-md flex flex-col h-full overflow-hidden"
        style={{ background: "#0e0e1a", borderLeft: "1px solid rgba(255,255,255,0.07)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black overflow-hidden flex-shrink-0"
            style={{ background: color + "25", color, border: `1px solid ${color}40` }}>
            {company.brand_logo_url
              ? <img src={company.brand_logo_url} className="w-full h-full object-contain" alt="" />
              : company.company_name[0]?.toUpperCase()
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white/90 truncate">{company.company_name}</div>
            <div className="text-[11px] text-white/35">{domain} · ID #{company.company_id}</div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition p-1">
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Скроллируемый контент */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* Статус */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Статус</div>
            <div className="flex flex-wrap gap-1.5">
              {DEMO_STATUSES.map(s => (
                <button key={s.id} onClick={() => set("status")(s.id)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition"
                  style={{
                    background: form.status === s.id ? s.bg : "rgba(255,255,255,0.04)",
                    color:      form.status === s.id ? s.color : "rgba(255,255,255,0.3)",
                    border:     `1px solid ${form.status === s.id ? s.color + "50" : "transparent"}`,
                  }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Контакт / ЛПР */}
          <div className="space-y-3">
            <div className="text-[11px] font-bold text-white/50 flex items-center gap-1.5">
              <Icon name="User" size={12} /> Контакт / ЛПР
            </div>
            <Field label="ФИО" value={form.contact_name} onChange={set("contact_name")} placeholder="Иванов Иван Иванович" />
            <Field label="Телефон" value={form.contact_phone} onChange={set("contact_phone")} placeholder="+7 (900) 000-00-00" />
            <Field label="Должность" value={form.contact_position} onChange={set("contact_position")} placeholder="Директор, менеджер..." />
          </div>

          {/* Следующий шаг */}
          <div className="space-y-3">
            <div className="text-[11px] font-bold text-white/50 flex items-center gap-1.5">
              <Icon name="Target" size={12} /> Следующий шаг
            </div>
            <Field label="Действие" value={form.next_action} onChange={set("next_action")} placeholder="Позвонить, отправить КП..." />
            <Field label="Дата" value={form.next_action_date} onChange={set("next_action_date")} type="date" />
          </div>

          {/* Заметки */}
          <div className="space-y-3">
            <div className="text-[11px] font-bold text-white/50 flex items-center gap-1.5">
              <Icon name="FileText" size={12} /> Заметки
            </div>
            <Field label="" value={form.notes} onChange={set("notes")} type="textarea"
              placeholder="Договорились о демо, интересует белый лейбл для 3 городов..." />
          </div>

          {/* Инфо о компании */}
          <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-[10px] uppercase tracking-wider text-white/25 mb-1">Данные аккаунта</div>
            {[
              { label: "Сайт",    value: domain },
              { label: "Email",   value: company.email },
              { label: "Телефон", value: company.support_phone },
              { label: "Баланс",  value: `${company.estimates_balance} смет` },
            ].filter(r => r.value).map(r => (
              <div key={r.label} className="flex items-center justify-between text-[11px]">
                <span className="text-white/30">{r.label}</span>
                <span className="text-white/60 font-medium">{r.value}</span>
              </div>
            ))}
            {company.has_own_agent && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold mt-1" style={{ color: "#10b981" }}>
                <Icon name="CheckCircle2" size={10} /> White Label активен
              </div>
            )}
          </div>

          {/* Кнопки действий */}
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-white/25 mb-1">Действия</div>
            <div className="flex flex-wrap gap-2">
              <button onClick={async () => {
                  const tok = await loginAs(company.company_id);
                  if (tok) onOpenPanel({ type: "site-authed", url: `/?c=${company.company_id}`, token: tok });
                  else onOpenPanel({ type: "site", url: `/?c=${company.company_id}` });
                }} className={btn} style={{ background: "rgba(6,182,212,0.12)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.25)" }}>
                <Icon name="Globe" size={12} /> Открыть сайт
              </button>
              <button onClick={async () => {
                  const tok = await loginAs(company.company_id);
                  if (tok) onOpenPanel({ type: "admin", companyId: company.company_id }, tok);
                }} className={btn} style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}>
                <Icon name="LayoutDashboard" size={12} /> Панель
              </button>
              <button onClick={async () => {
                  const tok = await loginAs(company.company_id);
                  if (tok) onOpenPanel({ type: "agent", companyId: company.company_id }, tok);
                }} className={btn} style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}>
                <Icon name="Pencil" size={12} /> Бренд
              </button>
              <button onClick={() => onRunApiTests(company.company_id)}
                className={btn} style={{ background: "rgba(16,185,129,0.10)", color: "#10b981", border: "1px solid rgba(16,185,129,0.22)" }}>
                <Icon name="Zap" size={12} /> Живые API
              </button>
              {!company.has_own_agent && (
                <button onClick={async () => {
                    await fetch(`${AUTH_URL}?action=admin-activate-agent`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", "X-Authorization": masterToken() },
                      body: JSON.stringify({ company_id: company.company_id }),
                    });
                    onUpdate({ has_own_agent: true });
                  }} className={btn} style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}>
                  <Icon name="Sparkles" size={12} /> Купили агента
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Футер — сохранить / удалить */}
        <div className="px-5 py-4 border-t border-white/[0.06] flex items-center gap-3 flex-shrink-0">
          <button onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition hover:opacity-80"
            style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.20)" }}>
            <Icon name="Trash2" size={12} /> Удалить
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-bold transition disabled:opacity-50"
            style={{ background: saved ? "rgba(16,185,129,0.2)" : statusInfo.bg, color: saved ? "#10b981" : statusInfo.color, border: `1px solid ${saved ? "rgba(16,185,129,0.4)" : statusInfo.color + "50"}` }}>
            {saving ? <><div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Сохранение...</>
              : saved ? <><Icon name="Check" size={13} /> Сохранено</>
              : <><Icon name="Save" size={13} /> Сохранить</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
