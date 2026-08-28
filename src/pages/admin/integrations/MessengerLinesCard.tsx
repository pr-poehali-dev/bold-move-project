import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { crmFetch } from "../crm/crmApi";
import { copyText } from "@/lib/clipboard";
import EnabledToggle from "./EnabledToggle";
import LineAuthModal, { type AuthStatus } from "./LineAuthModal";

interface Account {
  id: number;
  channel: "telegram" | "max";
  title: string;
  external_id: string;
  phone: string | null;
  is_active: boolean;
  auth_status: AuthStatus;
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

  const [authModal, setAuthModal] = useState<{ id: number; channel: string; title: string; status: AuthStatus } | null>(null);
  // Статус линий (подключена/отвалилась) не обновляется в фоне сам по себе —
  // только по явному нажатию пользователем кнопки "Проверить статус" (см. ниже).
  const [checkingStatus, setCheckingStatus] = useState(false);

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

  const copy = async (value: string, field: "url" | "key") => {
    const okCopy = await copyText(value);
    if (okCopy) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    }
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

  const checkStatus = async () => {
    setCheckingStatus(true);
    try { await loadAccounts(); } finally { setCheckingStatus(false); }
  };

  // ── Живая проверка каналов ────────────────────────────────────────────────
  // Отправляет РЕАЛЬНОЕ сообщение в Telegram и MAX на указанный номер и ждёт,
  // чем закончилась доставка. В отличие от «Проверить статус» (который лишь
  // показывает, авторизована ли линия) — это сквозная проверка всей цепочки:
  // CRM → очередь → воркер на VPS → сам мессенджер.
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, { state: string; error?: string }> | null>(null);

  const runSelfTest = async () => {
    if (!testPhone.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const d = await crmFetch("channels-selftest", {
        method: "POST",
        body: JSON.stringify({ phone: testPhone.trim() }),
      }) as { results?: Record<string, { ok: boolean; touch_id?: number; error?: string }>; error?: string };

      if (d?.error) {
        setTestResult({ telegram: { state: "error", error: d.error }, max: { state: "error", error: d.error } });
        return;
      }
      const res = d?.results || {};
      // Сообщения, которые реально ушли в очередь — за ними и следим
      const idToChannel: Record<number, string> = {};
      const initial: Record<string, { state: string; error?: string }> = {};
      Object.entries(res).forEach(([ch, r]) => {
        if (r.ok && r.touch_id) { idToChannel[r.touch_id] = ch; initial[ch] = { state: "sending" }; }
        else initial[ch] = { state: "error", error: r.error };
      });
      setTestResult({ ...initial });

      const ids = Object.keys(idToChannel);
      if (!ids.length) return;

      // Опрашиваем статус до 30 секунд — воркеру нужно время забрать и отправить
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const st = await crmFetch("channels-selftest-status", undefined, { ids: ids.join(",") }) as
          { items?: { touch_id: number; channel: string; status: string }[] };
        const items = st?.items || [];
        const next = { ...initial };
        items.forEach(it => {
          next[it.channel] = it.status === "sent" || it.status === "received"
            ? { state: "ok" }
            : it.status === "error"
            ? { state: "error", error: "Сообщение не доставлено" }
            : { state: "sending" };
        });
        setTestResult({ ...next });
        if (items.every(it => it.status !== "pending" && it.status !== "sending")) break;
      }
    } catch {
      setTestResult({ telegram: { state: "error", error: "Ошибка связи" }, max: { state: "error", error: "Ошибка связи" } });
    } finally {
      setTesting(false);
    }
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

            {/* Живая проверка каналов — реальное сообщение в Telegram и MAX */}
            <div className="rounded-xl p-3 mt-3" style={{ background: inputBg, border: `1px solid ${inputBrd}` }}>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: txtSub }}>
                <Icon name="Activity" size={12} /> Проверка каналов
              </div>
              <div className="text-[10px] mb-2" style={{ color: txtSub }}>
                Отправим реальное сообщение в Telegram и MAX на указанный номер и покажем, дошло ли оно.
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <input value={testPhone} onChange={e => setTestPhone(e.target.value)}
                  placeholder="+7 977 606 09 01"
                  className="flex-1 min-w-[150px] text-xs rounded-xl px-3 py-2 focus:outline-none"
                  style={{ background: isDark ? "#0e0e1c" : "#fff", border: `1px solid ${inputBrd}`, color: txt }} />
                <button onClick={runSelfTest} disabled={testing || !testPhone.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition disabled:opacity-50 flex-shrink-0"
                  style={{ background: "rgba(124,58,237,0.14)", color: "#a78bfa" }}>
                  <Icon name={testing ? "Loader2" : "Send"} size={12} className={testing ? "animate-spin" : ""} />
                  {testing ? "Проверяем…" : "Проверить"}
                </button>
              </div>

              {testResult && (
                <div className="flex flex-col gap-1 mt-2">
                  {(["telegram", "max"] as const).map(ch => {
                    const r = testResult[ch];
                    if (!r) return null;
                    const label = ch === "telegram" ? "Telegram" : "MAX";
                    const view = r.state === "ok"
                      ? { text: "Работает", color: "#10b981", icon: "CheckCircle2" }
                      : r.state === "sending"
                      ? { text: "Отправляем…", color: "#f59e0b", icon: "Loader2" }
                      : { text: r.error || "Не работает", color: "#ef4444", icon: "AlertTriangle" };
                    return (
                      <div key={ch} className="flex items-center gap-2 text-[11px] px-2.5 py-1.5 rounded-lg"
                        style={{ background: `${view.color}12`, border: `1px solid ${view.color}30` }}>
                        <Icon name={view.icon} size={13} style={{ color: view.color }}
                          className={r.state === "sending" ? "animate-spin" : ""} />
                        <span className="font-bold" style={{ color: txt }}>{label}</span>
                        <span style={{ color: view.color }}>{view.text}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${cardBrd}` }}>
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <div className="text-[11px] font-bold" style={{ color: txt }}>Линии (общие аккаунты)</div>
                <button onClick={checkStatus} disabled={checkingStatus}
                  className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition disabled:opacity-50 flex-shrink-0"
                  style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6", color: txtSub }}>
                  <Icon name="RotateCw" size={11} className={checkingStatus ? "animate-spin" : ""} />
                  Проверить статус
                </button>
              </div>
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
                      <div key={a.id}
                        onClick={() => { if (isBusy) setAuthModal({ id: a.id, channel: a.channel, title: a.title, status: a.auth_status }); }}
                        className="flex items-center gap-2 rounded-xl px-3 py-2"
                        style={{
                          background: isDark ? "rgba(255,255,255,0.03)" : "#f9fafb",
                          border: `1px solid ${cardBrd}`,
                          cursor: isBusy ? "pointer" : "default",
                        }}>
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
                          <button onClick={e => { e.stopPropagation(); setAuthModal({ id: a.id, channel: a.channel, title: a.title, status: a.auth_status }); }}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg flex-shrink-0 transition"
                            style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#eef2ff", color: txtSub }}>
                            Переавторизовать
                          </button>
                        ) : isBusy ? (
                          <button onClick={e => { e.stopPropagation(); cancelAuth(a.id); }}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg flex-shrink-0 transition"
                            style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                            Отменить
                          </button>
                        ) : (
                          <button onClick={e => { e.stopPropagation(); setAuthModal({ id: a.id, channel: a.channel, title: a.title, status: a.auth_status }); }}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg flex-shrink-0 transition"
                            style={{ background: "rgba(124,58,237,0.14)", color: "#a78bfa" }}>
                            Авторизовать
                          </button>
                        )}
                        <button onClick={e => { e.stopPropagation(); deleteLine(a.id); }} disabled={deletingId === a.id}
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
          initialStatus={authModal.status}
          onClose={() => { setAuthModal(null); loadAccounts(); }}
          onAuthorized={() => { setAuthModal(null); loadAccounts(); }}
        />
      )}
    </>
  );
}