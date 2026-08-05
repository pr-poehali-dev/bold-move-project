import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { crmFetch } from "../crm/crmApi";

interface Props {
  isDark: boolean;
  cardBg: string; cardBrd: string; inputBg: string; inputBrd: string;
  txt: string; txtSub: string;
  values: Record<string, string>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  /** Сохраняет текущий config (включая uis_enabled) в БД. Возвращает true при успехе. */
  saveConfig: (patch: Record<string, string | boolean>) => Promise<boolean>;
}

interface Employee {
  id: number;
  name: string | null;
  phone: string | null;
  uis_phone: string | null;
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!enabled)}
      className="relative flex-shrink-0 w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none"
      style={{ background: enabled ? "#7c3aed" : "rgba(255,255,255,0.12)" }}>
      <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: enabled ? "translateX(16px)" : "translateX(0)" }} />
    </button>
  );
}

export default function TelephonyUisCard({
  isDark, cardBg, cardBrd, inputBg, inputBrd, txt, txtSub, values, setValues, saveConfig,
}: Props) {
  const [enabled, setEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [callsCount, setCallsCount] = useState(0);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [savingPhone, setSavingPhone] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setEnabled(values.uis_enabled === "true");
  }, [values.uis_enabled]);

  const loadWebhook = async () => {
    try {
      const d = await crmFetch("uis-webhook-config") as
        { webhook_url?: string | null; calls_count?: number; last_event_at?: string | null };
      setWebhookUrl(d?.webhook_url ?? null);
      setCallsCount(d?.calls_count ?? 0);
      setLastEventAt(d?.last_event_at ?? null);
    } catch { /* тихо */ }
  };

  const loadEmployees = async () => {
    try {
      const d = await crmFetch("uis-employees") as { employees?: Employee[] };
      setEmployees(d?.employees ?? []);
    } catch { /* тихо */ }
  };

  useEffect(() => { loadWebhook(); loadEmployees(); }, []);

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const d = await crmFetch("uis-webhook-config", {
        method: "POST", body: JSON.stringify({ regenerate: true }),
      }) as { webhook_url?: string };
      if (d?.webhook_url) setWebhookUrl(d.webhook_url);
    } catch { /* тихо */ }
    setRegenerating(false);
  };

  const copyWebhook = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toggleEnabled = async (next: boolean) => {
    setEnabled(next);
    setValues(v => ({ ...v, uis_enabled: String(next) }));
    setSaving(true);
    const ok = await saveConfig({ ...values, uis_enabled: next });
    setSaving(false);
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 1500); }
    // Если включаем впервые — сразу создаём вебхук-ключ, чтобы адрес был готов
    if (next && !webhookUrl) regenerate();
  };

  const saveEmployeePhone = async (userId: number, phone: string) => {
    setSavingPhone(userId);
    try {
      await crmFetch("uis-employees", {
        method: "POST", body: JSON.stringify({ user_id: userId, uis_phone: phone }),
      });
      setEmployees(list => list.map(e => e.id === userId ? { ...e, uis_phone: phone } : e));
    } catch { /* тихо */ }
    setSavingPhone(null);
  };

  return (
    <div className="rounded-2xl p-4" style={{ background: cardBg, border: `1px solid ${cardBrd}` }}>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(124,58,237,0.12)" }}>
          <Icon name="PhoneCall" size={17} style={{ color: "#a78bfa" }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-bold" style={{ color: txt }}>Телефония (UIS)</div>
              <div className="text-[11px] mt-0.5" style={{ color: txtSub }}>
                Приём и запуск звонков через UIS, расшифровка и ИИ-анализ разговоров.
              </div>
            </div>
            <Toggle enabled={enabled} onChange={toggleEnabled} />
          </div>
        </div>
      </div>

      {/* Ключи UIS */}
      <div className="flex flex-col gap-2.5">
        <input
          type="password"
          value={values.uis_api_key ?? ""}
          onChange={e => setValues(v => ({ ...v, uis_api_key: e.target.value }))}
          placeholder="API-ключ (Data/Call API)"
          className="w-full text-sm rounded-xl px-3 py-2.5 focus:outline-none transition placeholder:text-white placeholder:font-semibold"
          style={{ background: inputBg, border: `1px solid ${inputBrd}`, color: txt }}
        />
        <input
          value={values.uis_virtual_phone_number ?? ""}
          onChange={e => setValues(v => ({ ...v, uis_virtual_phone_number: e.target.value }))}
          placeholder="Виртуальный номер UIS, например +7..."
          className="w-full text-sm rounded-xl px-3 py-2.5 focus:outline-none transition placeholder:text-white placeholder:font-semibold"
          style={{ background: inputBg, border: `1px solid ${inputBrd}`, color: txt }}
        />
        <button
          onClick={() => toggleEnabled(enabled)}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition w-fit disabled:opacity-50"
          style={{ background: "rgba(124,58,237,0.14)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.3)" }}>
          <Icon name={saving ? "Loader2" : "Save"} size={11} className={saving ? "animate-spin" : ""} />
          {saved ? "Сохранено" : "Сохранить ключи"}
        </button>
      </div>

      {/* Адрес вебхука */}
      <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${cardBrd}` }}>
        <div className="text-[11px] font-semibold mb-1.5" style={{ color: txtSub }}>
          Адрес вебхука — вставьте в UIS: Интеграции → HTTP-уведомления
        </div>
        {webhookUrl ? (
          <div className="flex items-center gap-1.5">
            <div className="flex-1 min-w-0 text-xs px-3 py-2 rounded-xl truncate font-mono"
              style={{ background: inputBg, border: `1px solid ${inputBrd}`, color: txt }}>
              {webhookUrl}
            </div>
            <button onClick={copyWebhook}
              className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-[11px] font-bold transition flex-shrink-0"
              style={{ background: copied ? "rgba(16,185,129,0.15)" : "rgba(124,58,237,0.14)", color: copied ? "#10b981" : "#a78bfa" }}>
              <Icon name={copied ? "Check" : "Copy"} size={12} /> {copied ? "Скопировано" : "Копировать"}
            </button>
            <button onClick={regenerate} disabled={regenerating}
              className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-[11px] font-bold transition flex-shrink-0 disabled:opacity-50"
              style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6", color: txtSub }}>
              <Icon name="RefreshCw" size={12} className={regenerating ? "animate-spin" : ""} /> Пересоздать
            </button>
          </div>
        ) : (
          <button onClick={regenerate} disabled={regenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition w-fit disabled:opacity-50"
            style={{ background: "#7c3aed", color: "#fff" }}>
            <Icon name={regenerating ? "Loader2" : "Link"} size={11} className={regenerating ? "animate-spin" : ""} />
            Получить адрес вебхука
          </button>
        )}
        <div className="text-[10px] mt-1.5" style={{ color: txtSub }}>
          Принято звонков: {callsCount}
          {lastEventAt && ` · Последнее событие: ${new Date(lastEventAt).toLocaleString("ru-RU")}`}
        </div>
      </div>

      {/* Сотрудники — номера в АТС */}
      <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${cardBrd}` }}>
        <div className="text-[11px] font-semibold mb-2" style={{ color: txtSub }}>
          Номера сотрудников в UIS (нужны для кнопки «Позвонить»)
        </div>
        {employees.length === 0 ? (
          <div className="text-[11px]" style={{ color: txtSub }}>Сотрудников пока нет.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {employees.map(emp => (
              <div key={emp.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0 text-xs truncate" style={{ color: txt }}>
                  {emp.name || emp.phone || `Сотрудник #${emp.id}`}
                </div>
                <input
                  defaultValue={emp.uis_phone ?? ""}
                  onBlur={e => {
                    const v = e.target.value.trim();
                    if (v !== (emp.uis_phone ?? "")) saveEmployeePhone(emp.id, v);
                  }}
                  placeholder="Номер в UIS"
                  className="w-36 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none transition placeholder:text-white"
                  style={{ background: inputBg, border: `1px solid ${inputBrd}`, color: txt }}
                />
                {savingPhone === emp.id && (
                  <div className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
