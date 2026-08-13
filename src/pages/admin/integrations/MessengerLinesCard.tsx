import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { crmFetch } from "../crm/crmApi";
import EnabledToggle from "./EnabledToggle";
import LineAuthModal from "./LineAuthModal";

interface Account {
  id: number;
  channel: "telegram" | "max";
  title: string;
  external_id: string;
  phone: string | null;
  is_active: boolean;
  auth_status: string;
  account_name: string | null;
  created_at: string;
}

interface Props {
  cardBg: string; cardBrd: string; inputBg: string; inputBrd: string;
  txt: string; txtSub: string; isDark: boolean;
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  none:               { text: "Не подключено",  color: "#94a3b8" },
  requested:          { text: "Подключение...",  color: "#f59e0b" },
  connecting:         { text: "Подключение...",  color: "#f59e0b" },
  qr_ready:           { text: "Ждём сканирование", color: "#f59e0b" },
  code_requested:     { text: "Ждём код",        color: "#f59e0b" },
  code_submitted:     { text: "Проверка кода...", color: "#f59e0b" },
  password_requested: { text: "Ждём пароль",     color: "#f59e0b" },
  password_submitted: { text: "Проверка...",     color: "#f59e0b" },
  authorized:         { text: "Подключено",      color: "#10b981" },
  error:              { text: "Ошибка",          color: "#ef4444" },
};

export default function MessengerLinesCard({ cardBg, cardBrd, inputBg, inputBrd, txt, txtSub, isDark }: Props) {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [webhookKey, setWebhookKey] = useState("");
  const [copiedField, setCopiedField] = useState<"url" | "key" | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [newChannel, setNewChannel] = useState<"telegram" | "max">("telegram");
  const [newTitle, setNewTitle] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [authModal, setAuthModal] = useState<{ id: number; channel: string; title: string } | null>(null);

  const loadConfig = async () => {
    try {
      const d = await crmFetch("messenger-config") as { webhook_key?: string; base_url?: string; enabled?: boolean };
      setWebhookKey(d?.webhook_key || "");
      setBaseUrl(d?.base_url || "");
      setEnabled(!!d?.enabled);
    } catch { /* тихо */ }
  };

  const loadAccounts = async () => {
    try {
      const d = await crmFetch("messenger-accounts-list") as { accounts?: Account[] };
      setAccounts(d?.accounts || []);
    } catch { /* тихо */ }
  };

  useEffect(() => {
    Promise.all([loadConfig(), loadAccounts()]).finally(() => setLoading(false));
  }, []);

  const toggleEnabled = async (next: boolean) => {
    setToggling(true);
    setEnabled(next);
    try {
      const d = await crmFetch("messenger-config", { method: "POST", body: JSON.stringify({ enabled: next }) }) as
        { webhook_key?: string; base_url?: string };
      if (d?.webhook_key) setWebhookKey(d.webhook_key);
      if (d?.base_url) setBaseUrl(d.base_url);
    } catch { /* тихо */ }
    setToggling(false);
  };

  const regenerateKey = async () => {
    if (!confirm("Пересоздать ключ? Старый ключ перестанет работать — воркер на VPS нужно будет обновить.")) return;
    setRegenerating(true);
    try {
      const d = await crmFetch("messenger-config", { method: "POST", body: JSON.stringify({ regenerate: true }) }) as
        { webhook_key?: string };
      if (d?.webhook_key) setWebhookKey(d.webhook_key);
    } catch { /* тихо */ }
    setRegenerating(false);
  };

  const copy = (value: string, field: "url" | "key") => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const addLine = async () => {
    if (!newTitle.trim()) return;
    if (newChannel === "max" && !newPhone.trim()) return;
    setAdding(true);
    try {
      await crmFetch("messenger-account-save", {
        method: "POST",
        body: JSON.stringify({ channel: newChannel, title: newTitle.trim(), phone: newPhone.trim() || undefined }),
      });
      setNewTitle("");
      setNewPhone("");
      await loadAccounts();
    } catch { /* тихо */ }
    setAdding(false);
  };

  const deleteLine = async (id: number) => {
    if (!confirm("Удалить линию? История переписки сохранится.")) return;
    setDeletingId(id);
    try {
      await crmFetch("messenger-account-delete", { method: "POST", body: JSON.stringify({ id }) });
      await loadAccounts();
    } catch { /* тихо */ }
    setDeletingId(null);
  };

  const cancelAuth = async (id: number) => {
    try {
      await crmFetch("messenger-account-auth-cancel", { method: "POST", body: JSON.stringify({ id }) });
      await loadAccounts();
    } catch { /* тихо */ }
  };

  if (loading) {
    return (
      <div className="rounded-2xl p-6 flex items-center justify-center" style={{ background: cardBg, border: `1px solid ${cardBrd}` }}>
        <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const maskedKey = webhookKey ? webhookKey.slice(0, 8) + "•".repeat(Math.max(webhookKey.length - 8, 0)) : "";

  return (
    <>
      <div className="rounded-2xl p-4" style={{ background: cardBg, border: `1px solid ${cardBrd}`, opacity: enabled ? 1 : 0.65 }}>
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(124,58,237,0.12)" }}>
            <Icon name="MessageCircle" size={17} style={{ color: "#a78bfa" }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-sm font-bold" style={{ color: txt }}>Мессенджеры (Telegram / MAX)</div>
              {enabled && (
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md"
                  style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#10b981" }} /> Подключено
                </span>
              )}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: txtSub }}>
              Переписка с клиентов с личных аккаунтов. Воркер на вашем VPS сам забирает очередь — порт открывать не нужно.
            </div>
          </div>
          <EnabledToggle enabled={enabled} onChange={toggleEnabled} disabled={toggling} />
        </div>

        {enabled && (
          <>
            <div className="rounded-xl p-3 mt-1" style={{ background: inputBg, border: `1px solid ${inputBrd}` }}>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: txtSub }}>
                <Icon name="Server" size={12} /> Данные для воркера на VPS
              </div>

              <div className="text-[10px] font-semibold mb-1" style={{ color: txtSub }}>Адрес CRM (base URL)</div>
              <div className="flex items-center gap-1.5 mb-3">
                <div className="flex-1 min-w-0 text-[11px] px-3 py-2 rounded-xl truncate font-mono"
                  style={{ background: isDark ? "#0e0e1c" : "#fff", border: `1px solid ${inputBrd}`, color: txt }}>
                  {baseUrl}
                </div>
                <button onClick={() => copy(baseUrl, "url")}
                  className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-[11px] font-bold transition flex-shrink-0"
                  style={{ background: copiedField === "url" ? "rgba(16,185,129,0.15)" : "rgba(124,58,237,0.14)", color: copiedField === "url" ? "#10b981" : "#a78bfa" }}>
                  <Icon name={copiedField === "url" ? "Check" : "Copy"} size={12} />
                </button>
              </div>

              <div className="text-[10px] font-semibold mb-1" style={{ color: txtSub }}>
                Ключ компании (X-Webhook-Key)
              </div>
              <div className="text-[10px] mb-1.5" style={{ color: txtSub }}>
                Воркер шлёт его в заголовке каждого запроса. Скопируйте в настройки воркера.
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 min-w-0 text-[11px] px-3 py-2 rounded-xl truncate font-mono"
                  style={{ background: isDark ? "#0e0e1c" : "#fff", border: `1px solid ${inputBrd}`, color: txt }}>
                  {maskedKey || "—"}
                </div>
                <button onClick={() => copy(webhookKey, "key")}
                  className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-[11px] font-bold transition flex-shrink-0"
                  style={{ background: copiedField === "key" ? "rgba(16,185,129,0.15)" : "rgba(124,58,237,0.14)", color: copiedField === "key" ? "#10b981" : "#a78bfa" }}>
                  <Icon name={copiedField === "key" ? "Check" : "Copy"} size={12} />
                </button>
                <button onClick={regenerateKey} disabled={regenerating}
                  className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-[11px] font-bold transition flex-shrink-0 disabled:opacity-50"
                  style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6", color: txtSub }}>
                  <Icon name="RotateCw" size={12} className={regenerating ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${cardBrd}` }}>
              <div className="text-[11px] font-bold mb-0.5" style={{ color: txt }}>Линии (общие аккаунты)</div>
              <div className="text-[10px] mb-2.5" style={{ color: txtSub }}>
                {accounts.length === 0
                  ? "Пока нет ни одной линии. Добавьте аккаунты, с которых будут писать менеджеры."
                  : "Аккаунты, с которых менеджеры пишут клиентам."}
              </div>

              {accounts.length > 0 && (
                <div className="flex flex-col gap-1.5 mb-3">
                  {accounts.map(a => {
                    const st = STATUS_LABEL[a.auth_status] || STATUS_LABEL.none;
                    const isBusy = !["none", "authorized", "error"].includes(a.auth_status);
                    return (
                      <div key={a.id} className="flex items-center gap-2 rounded-xl px-3 py-2"
                        style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#f9fafb", border: `1px solid ${cardBrd}` }}>
                        <Icon name={a.channel === "telegram" ? "Send" : "MessageCircle"} size={14} style={{ color: txtSub, flexShrink: 0 }} />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold truncate" style={{ color: txt }}>{a.title}</div>
                          <div className="text-[10px] truncate" style={{ color: txtSub }}>
                            {a.phone || (a.account_name ? a.account_name : a.channel === "telegram" ? "Telegram" : "MAX")}
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0"
                          style={{ background: `${st.color}22`, color: st.color }}>
                          {st.text}
                        </span>
                        {a.auth_status === "authorized" ? (
                          <button onClick={() => setAuthModal({ id: a.id, channel: a.channel, title: a.title })}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg flex-shrink-0 transition"
                            style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#eef2ff", color: txtSub }}>
                            Переавторизовать
                          </button>
                        ) : isBusy ? (
                          <button onClick={() => cancelAuth(a.id)}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg flex-shrink-0 transition"
                            style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                            Отменить
                          </button>
                        ) : (
                          <button onClick={() => setAuthModal({ id: a.id, channel: a.channel, title: a.title })}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg flex-shrink-0 transition"
                            style={{ background: "rgba(124,58,237,0.14)", color: "#a78bfa" }}>
                            Авторизовать
                          </button>
                        )}
                        <button onClick={() => deleteLine(a.id)} disabled={deletingId === a.id}
                          className="p-1.5 rounded-lg flex-shrink-0 transition disabled:opacity-50"
                          style={{ color: "#ef4444" }}>
                          <Icon name="Trash2" size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex items-end gap-1.5 flex-wrap">
                <div>
                  <div className="text-[10px] font-semibold mb-1" style={{ color: txtSub }}>Канал</div>
                  <select value={newChannel} onChange={e => setNewChannel(e.target.value as "telegram" | "max")}
                    className="text-xs rounded-xl px-3 py-2 focus:outline-none font-semibold"
                    style={{ background: inputBg, border: `1px solid ${inputBrd}`, color: txt }}>
                    <option value="telegram">Telegram</option>
                    <option value="max">MAX</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[140px]">
                  <div className="text-[10px] font-semibold mb-1" style={{ color: txtSub }}>Название линии</div>
                  <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                    placeholder="Например: Линия 1"
                    className="w-full text-xs rounded-xl px-3 py-2 focus:outline-none"
                    style={{ background: inputBg, border: `1px solid ${inputBrd}`, color: txt }} />
                </div>
                {newChannel === "max" && (
                  <div className="flex-1 min-w-[140px]">
                    <div className="text-[10px] font-semibold mb-1" style={{ color: txtSub }}>Номер телефона</div>
                    <input value={newPhone} onChange={e => setNewPhone(e.target.value)}
                      placeholder="+7..."
                      className="w-full text-xs rounded-xl px-3 py-2 focus:outline-none"
                      style={{ background: inputBg, border: `1px solid ${inputBrd}`, color: txt }} />
                  </div>
                )}
                <button onClick={addLine} disabled={adding || !newTitle.trim() || (newChannel === "max" && !newPhone.trim())}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50"
                  style={{ background: "#7c3aed", color: "#fff" }}>
                  {adding
                    ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Icon name="Plus" size={13} />}
                  Добавить
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {authModal && (
        <LineAuthModal
          accountId={authModal.id}
          channel={authModal.channel}
          title={authModal.title}
          onClose={() => { setAuthModal(null); loadAccounts(); }}
          onAuthorized={() => { setAuthModal(null); loadAccounts(); }}
        />
      )}
    </>
  );
}
