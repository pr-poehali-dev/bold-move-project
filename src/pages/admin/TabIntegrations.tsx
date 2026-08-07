import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useAuth, type Brand } from "@/context/AuthContext";
import { updateBrand } from "./own-agent/brandApi";
import { crmFetch } from "./crm/crmApi";
import { GROUPS, SECTIONS, type SectionDef, type ProviderOption } from "./integrations/integrationsConfig";
import NotifyIntegrationCard from "./integrations/NotifyIntegrationCard";
import ProviderSection from "./integrations/ProviderSection";
import TelephonyUisCard from "./integrations/TelephonyUisCard";

interface Props {
  isDark: boolean;
}

export default function TabIntegrations({ isDark }: Props) {
  const { user, token, updateUser } = useAuth();

  const cardBg   = isDark ? "#13131f" : "#ffffff";
  const cardBrd  = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const inputBg  = isDark ? "#0e0e1c" : "#f9fafb";
  const inputBrd = isDark ? "rgba(255,255,255,0.12)" : "#e5e7eb";
  const txt      = isDark ? "rgba(255,255,255,0.9)" : "#111827";
  const txtSub   = isDark ? "rgba(255,255,255,0.45)" : "#6b7280";
  const text     = txt;
  const muted    = txtSub;

  const [activeProvider, setActiveProvider] = useState<Record<string, string>>(
    Object.fromEntries(SECTIONS.map(s => [s.id, s.providers[0].id]))
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [sectionCheck, setSectionCheck] = useState<Record<string, "ok" | "err">>({});
  // Отдельно от sectionCheck: подключён ли реально владелец Avito-аккаунта
  // (через OAuth-вход) — только это даёт права на получение/отправку сообщений.
  const [avitoConnected, setAvitoConnected] = useState(false);
  const [avitoConnecting, setAvitoConnecting] = useState(false);
  // Бот-«слушатель» заявок из Telegram-группы — статус после реальной проверки токена
  const [tgLeadsBotUsername, setTgLeadsBotUsername] = useState<string | null>(null);

  // Сохраняет config интеграций (merge с текущим на сервере, чтобы не затереть
  // другие поля, если сейчас правим только одну секцию, напр. UIS).
  const saveIntegrationsConfig = async (patch: Record<string, string | boolean>) => {
    let prevCfg: Record<string, unknown> = {};
    try {
      const cur = await crmFetch("integrations") as { config?: Record<string, unknown> };
      if (cur?.config && typeof cur.config === "object") prevCfg = cur.config;
    } catch { /* тихо */ }
    await crmFetch("integrations", {
      method: "POST",
      body: JSON.stringify({ config: { ...prevCfg, ...patch, _providers: JSON.stringify(activeProvider) } }),
    });
    return true;
  };

  // Подключить Avito: сначала сохраняем Client ID/Secret, затем ведём владельца
  // на страницу входа Avito — только так выдаются права messenger:read/write.
  const connectAvito = async () => {
    setAvitoConnecting(true);
    try {
      await saveIntegrationsConfig(values);
      const res = await crmFetch("avito-auth-url") as { auth_url?: string; error?: string };
      if (!res?.auth_url) { setSectionCheck(s => ({ ...s, avito: "err" })); return; }
      window.location.href = res.auth_url;
    } catch {
      setSectionCheck(s => ({ ...s, avito: "err" }));
    } finally {
      setAvitoConnecting(false);
    }
  };

  // Проверка секции. Для Avito — реальная (сохраняем ключи и дёргаем Avito API),
  // для остальных — формальная (заполнены ли обязательные поля).
  const checkSection = async (section: SectionDef, provider: ProviderOption) => {
    const required = provider.fields.filter(f => !f.options);
    const filled = required.length > 0 && required.every(f => (values[f.key] ?? "").trim());

    if (section.id === "avito") {
      if (!filled) { setSectionCheck(s => ({ ...s, [section.id]: "err" })); return; }
      try {
        // Сначала сохраняем введённые ключи в БД компании
        await saveIntegrationsConfig(values);
        // Затем реальная проверка связи с Avito
        const res = await crmFetch("avito-check", { method: "POST" }) as { ok?: boolean; error?: string };
        setSectionCheck(s => ({ ...s, [section.id]: res?.ok ? "ok" : "err" }));
      } catch {
        setSectionCheck(s => ({ ...s, [section.id]: "err" }));
      }
      return;
    }

    if (section.id === "tg_leads") {
      if (!filled) { setSectionCheck(s => ({ ...s, [section.id]: "err" })); return; }
      try {
        // Сначала сохраняем токен, затем проверяем его через Telegram API
        // и регистрируем вебхук — тот же паттерн, что и у Avito.
        await saveIntegrationsConfig(values);
        const res = await crmFetch("tg-leads-check", { method: "POST" }) as
          { ok?: boolean; bot_username?: string; webhook_registered?: boolean; error?: string };
        if (res?.ok && res.webhook_registered) {
          setTgLeadsBotUsername(res.bot_username || null);
          setSectionCheck(s => ({ ...s, [section.id]: "ok" }));
        } else {
          setSectionCheck(s => ({ ...s, [section.id]: "err" }));
        }
      } catch {
        setSectionCheck(s => ({ ...s, [section.id]: "err" }));
      }
      return;
    }

    setSectionCheck(s => ({ ...s, [section.id]: filled ? "ok" : "err" }));
  };

  // ── Telegram интеграция (перенос из «Своего агента», 1:1) ──
  const [tgToken,  setTgToken]  = useState(user?.tg_bot_token      ?? "");
  const [tgChat,   setTgChat]   = useState(user?.tg_notify_chat_id ?? "");
  const [tgTesting, setTgTesting] = useState(false);
  const [tgTestResult, setTgTestResult] = useState<"ok" | "err" | null>(null);

  // ── MAX интеграция (перенос из «Своего агента», 1:1) ──
  // MAX-токены хранятся в brand (в AuthUser напрямую их нет)
  const [maxToken,      setMaxToken]      = useState(user?.brand?.max_bot_token      ?? "");
  const [maxChat,       setMaxChat]       = useState(user?.brand?.max_notify_chat_id ?? "");
  const [maxTesting,    setMaxTesting]    = useState(false);
  const [maxTestResult, setMaxTestResult] = useState<"ok" | "err" | null>(null);

  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  // Загрузка сохранённого config новых сервисов из БД (таблица integrations)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await crmFetch("integrations") as { config?: Record<string, string> };
        if (alive && d?.config && typeof d.config === "object") {
          const { _providers, avito_connected, ...vals } = d.config;
          setValues(v => ({ ...vals, ...v }));
          if (avito_connected) setAvitoConnected(true);
          const cfgAny = d.config as Record<string, unknown>;
          if (cfgAny._tg_leads_webhook_registered && cfgAny._tg_leads_bot_username) {
            setTgLeadsBotUsername(String(cfgAny._tg_leads_bot_username));
            setSectionCheck(s => ({ ...s, tg_leads: "ok" }));
          }
          if (_providers) {
            try { setActiveProvider(p => ({ ...JSON.parse(_providers), ...p })); } catch { /* игнор */ }
          }
        }
      } catch { /* тихо */ }
    })();
    return () => { alive = false; };
  }, []);

  const testTelegram = async () => {
    if (!tgToken || !tgChat) return;
    setTgTesting(true); setTgTestResult(null);
    try {
      const res = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: tgChat, text: "✅ Интеграция работает! Уведомления о заявках будут приходить сюда.", parse_mode: "HTML" }),
      });
      const d = await res.json();
      setTgTestResult(d.ok ? "ok" : "err");
    } catch {
      setTgTestResult("err");
    } finally {
      setTgTesting(false);
    }
  };

  const testMax = async () => {
    if (!maxToken || !maxChat) return;
    setMaxTesting(true); setMaxTestResult(null);
    try {
      const res = await fetch(`https://botapi.max.ru/messages?access_token=${maxToken}&chat_id=${maxChat}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "✅ Интеграция MAX работает! Уведомления о заявках будут приходить сюда." }),
      });
      const d = await res.json();
      setMaxTestResult((d.message_id || d.id || d.ok) ? "ok" : "err");
    } catch {
      setMaxTestResult("err");
    } finally {
      setMaxTesting(false);
    }
  };

  const save = async () => {
    setSaved(false); setSaving(true);
    try {
      await saveIntegrationsConfig(values);
      // Telegram / MAX → бренд (как раньше)
      await updateBrand(token, {
        ...user?.brand,
        tg_bot_token:       tgToken   || null,
        tg_notify_chat_id:  tgChat    || null,
        max_bot_token:      maxToken  || null,
        max_notify_chat_id: maxChat   || null,
      } as Brand);
      updateUser({
        tg_bot_token: tgToken || null,
        tg_notify_chat_id: tgChat || null,
        brand: {
          ...user?.brand,
          tg_bot_token:       tgToken   || null,
          tg_notify_chat_id:  tgChat    || null,
          max_bot_token:      maxToken  || null,
          max_notify_chat_id: maxChat   || null,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      /* тихо */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 max-w-4xl mx-auto w-full">
      <div className="mb-5">
        <h2 className="text-base font-bold" style={{ color: txt }}>Интеграции</h2>
        <p className="text-xs mt-1" style={{ color: txtSub }}>
          Подключите свои сервисы: транскрибацию, ИИ и каналы связи. Ключи вводятся один раз.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* ═══ ГРУППА: Уведомления о заявках ═══ */}
        <div className="flex items-center gap-2 mt-1">
          <Icon name="BellRing" size={15} style={{ color: "#a78bfa" }} />
          <div>
            <div className="text-sm font-black" style={{ color: txt }}>Уведомления о заявках</div>
            <div className="text-[11px]" style={{ color: txtSub }}>Куда система присылает новые заявки (в один чат).</div>
          </div>
        </div>

        {/* Интеграция с Telegram */}
        <NotifyIntegrationCard
          cardBg={cardBg} cardBrd={cardBrd} inputBg={inputBg} inputBrd={inputBrd} text={text} muted={muted}
          iconName="Send"
          title="Интеграция с Telegram"
          subtitle="Новые заявки будут приходить в ваш бот"
          tokenValue={tgToken} onTokenChange={setTgToken}
          tokenPlaceholder="Токен бота (получить у @BotFather)"
          chatValue={tgChat} onChatChange={setTgChat}
          chatPlaceholder="ID чата или группы (узнать у @userinfobot)"
          onTest={testTelegram} testing={tgTesting} testResult={tgTestResult}
        />

        {/* Интеграция с MAX */}
        <NotifyIntegrationCard
          cardBg={cardBg} cardBrd={cardBrd} inputBg={inputBg} inputBrd={inputBrd} text={text} muted={muted}
          iconNode={<span style={{ fontSize: 15, lineHeight: 1, color: "#a78bfa", fontWeight: 900 }}>М</span>}
          title="Интеграция с MAX"
          subtitle="Новые заявки будут приходить в ваш бот MAX"
          tokenValue={maxToken} onTokenChange={setMaxToken}
          tokenPlaceholder="Токен бота (получить у @MasterBot в MAX)"
          chatValue={maxChat} onChatChange={setMaxChat}
          chatPlaceholder="ID чата (числовой ID получателя)"
          onTest={testMax} testing={maxTesting} testResult={maxTestResult}
        />

        {/* ═══ ГРУППЫ: Каналы общения · ИИ · Телефония ═══ */}
        {GROUPS.map(group => {
          const groupSections = SECTIONS.filter(s => s.group === group.id);
          if (groupSections.length === 0) return null;
          return (
            <div key={group.id} className="flex flex-col gap-4">
              <div className="flex items-center gap-2 mt-3">
                <Icon name="Layers" size={15} style={{ color: "#a78bfa" }} />
                <div>
                  <div className="text-sm font-black" style={{ color: txt }}>{group.title}</div>
                  <div className="text-[11px]" style={{ color: txtSub }}>{group.desc}</div>
                </div>
              </div>

              {groupSections.map(section => (
                section.id === "telephony" ? (
                  <TelephonyUisCard
                    key={section.id}
                    isDark={isDark}
                    cardBg={cardBg} cardBrd={cardBrd} inputBg={inputBg} inputBrd={inputBrd}
                    txt={txt} txtSub={txtSub}
                    values={values} setValues={setValues}
                    saveConfig={saveIntegrationsConfig}
                  />
                ) : (
                  <ProviderSection
                    key={section.id}
                    section={section}
                    isDark={isDark}
                    txt={txt} txtSub={txtSub}
                    cardBg={cardBg} cardBrd={cardBrd} inputBg={inputBg} inputBrd={inputBrd}
                    activeProvider={activeProvider} setActiveProvider={setActiveProvider}
                    values={values} setValues={setValues}
                    revealed={revealed} setRevealed={setRevealed}
                    sectionCheck={sectionCheck} checkSection={checkSection}
                    avitoConnected={avitoConnected} avitoConnecting={avitoConnecting} connectAvito={connectAvito}
                    tgLeadsBotUsername={tgLeadsBotUsername}
                  />
                )
              ))}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition hover:opacity-90 disabled:opacity-50"
          style={{ background: saved ? "#10b981" : "#7c3aed", color: "#fff" }}>
          {saving
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Сохранение...</>
            : saved
            ? <><Icon name="CheckCircle2" size={15} /> Сохранено</>
            : <><Icon name="Save" size={15} /> Сохранить</>}
        </button>
        <span className="text-[11px]" style={{ color: txtSub }}>
          Telegram и MAX сохраняются. Остальные сервисы — пока внешний вид.
        </span>
      </div>
    </div>
  );
}