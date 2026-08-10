import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useAuth, type Brand } from "@/context/AuthContext";
import { updateBrand } from "./own-agent/brandApi";
import { crmFetch } from "./crm/crmApi";
import { SECTIONS, type SectionDef, type ProviderOption } from "./integrations/integrationsConfig";
import NotifyIntegrationCard from "./integrations/NotifyIntegrationCard";
import ProviderSection from "./integrations/ProviderSection";
import TelephonyUisCard from "./integrations/TelephonyUisCard";
import LeadSourcesCards from "./integrations/LeadSourcesCards";

interface Props {
  isDark: boolean;
}

// Горизонтальные табы вкладки «Интеграции». Каждый таб — свой тип подключения,
// чтобы страница не была одним длинным списком. sections — какие секции из
// integrationsConfig показывать внутри таба (порядок соблюдается).
const TABS: { id: string; label: string; icon: string; color: string; desc: string; sections: string[] }[] = [
  { id: "leads", label: "Источники заявок", icon: "Inbox", color: "#3b82f6",
    desc: "Откуда заявки автоматически попадают в CRM.",
    sections: ["tg_leads"] },
  { id: "notify", label: "Уведомления", icon: "BellRing", color: "#a78bfa",
    desc: "Куда система присылает сообщения о новых заявках.",
    sections: [] },
  { id: "channels", label: "Каналы общения", icon: "MessagesSquare", color: "#10b981",
    desc: "Переписка с клиентами — попадает в ленту «Касания».",
    sections: ["avito", "webchat", "tg_personal", "max_personal", "tg_bot", "max_bot"] },
  { id: "ai", label: "ИИ и обработка", icon: "BrainCircuit", color: "#f59e0b",
    desc: "Распознавание звонков и модель для анализа клиентов.",
    sections: ["transcription", "llm"] },
  { id: "telephony", label: "Телефония", icon: "PhoneCall", color: "#ef4444",
    desc: "Звонки, кнопка «Позвонить», расшифровка разговоров.",
    sections: ["telephony"] },
];

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

  const [activeTab, setActiveTab] = useState<string>("leads");
  const [activeProvider, setActiveProvider] = useState<Record<string, string>>(
    Object.fromEntries(SECTIONS.map(s => [s.id, s.providers[0].id]))
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [sectionCheck, setSectionCheck] = useState<Record<string, "ok" | "err">>({});
  const [sectionChecking, setSectionChecking] = useState<Record<string, boolean>>({});
  // Отдельно от sectionCheck: подключён ли реально владелец Avito-аккаунта
  // (через OAuth-вход) — только это даёт права на получение/отправку сообщений.
  const [avitoConnected, setAvitoConnected] = useState(false);
  const [avitoConnecting, setAvitoConnecting] = useState(false);
  // Бот-«слушатель» заявок из Telegram-группы — статус после реальной проверки токена
  const [tgLeadsBotUsername, setTgLeadsBotUsername] = useState<string | null>(null);
  const [tgLeadsError, setTgLeadsError] = useState<string | null>(null);
  const [togglingSection, setTogglingSection] = useState<string | null>(null);

  // section.id → source для эндпоинта source-toggle (только те, что реально
  // останавливают приём на бэкенде — realToggle: true в integrationsConfig.ts)
  const REAL_TOGGLE_SOURCE: Record<string, string> = {
    avito: "avito",
    tg_leads: "telegram_leads",
  };

  // Тумблер вкл/выкл карточки: для «реальных» источников дёргаем source-toggle
  // (бэкенд реально останавливает приём), для остальных — просто сохраняем
  // визуальный флаг в общий config (как договорились — без изменения логики бэкенда).
  const toggleSectionEnabled = async (section: SectionDef, next: boolean) => {
    if (!section.enabledKey) return;
    setTogglingSection(section.id);
    setValues(v => ({ ...v, [section.enabledKey!]: String(next) }));
    try {
      const realSource = REAL_TOGGLE_SOURCE[section.id];
      if (realSource) {
        await crmFetch("source-toggle", {
          method: "POST",
          body: JSON.stringify({ source: realSource, enabled: next }),
        });
      } else {
        await saveIntegrationsConfig({ [section.enabledKey]: String(next) });
      }
    } catch { /* тихо */ }
    setTogglingSection(null);
  };

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
      setSectionChecking(s => ({ ...s, [section.id]: true }));
      try {
        // Сначала сохраняем введённые ключи в БД компании
        await saveIntegrationsConfig(values);
        // Затем реальная проверка связи с Avito
        const res = await crmFetch("avito-check", { method: "POST" }) as { ok?: boolean; error?: string };
        setSectionCheck(s => ({ ...s, [section.id]: res?.ok ? "ok" : "err" }));
      } catch {
        setSectionCheck(s => ({ ...s, [section.id]: "err" }));
      } finally {
        setSectionChecking(s => ({ ...s, [section.id]: false }));
      }
      return;
    }

    if (section.id === "tg_leads") {
      if (!filled) { setSectionCheck(s => ({ ...s, [section.id]: "err" })); return; }
      setSectionChecking(s => ({ ...s, [section.id]: true }));
      setTgLeadsError(null);
      try {
        // Сначала сохраняем токен, затем проверяем его через Telegram API
        // и регистрируем вебхук — тот же паттерн, что и у Avito.
        await saveIntegrationsConfig(values);
        const res = await crmFetch("tg-leads-check", { method: "POST" }) as
          { ok?: boolean; bot_username?: string; webhook_registered?: boolean; webhook_error?: string; error?: string };
        if (res?.ok && res.webhook_registered) {
          setTgLeadsBotUsername(res.bot_username || null);
          setSectionCheck(s => ({ ...s, [section.id]: "ok" }));
        } else {
          // Показываем реальную причину: либо ошибка ответа (400/401), либо ошибка
          // конкретно регистрации вебхука (токен верный, но setWebhook не прошёл)
          setTgLeadsError(res?.error || res?.webhook_error || "неизвестная ошибка");
          setSectionCheck(s => ({ ...s, [section.id]: "err" }));
        }
      } catch {
        setTgLeadsError("не удалось связаться с сервером");
        setSectionCheck(s => ({ ...s, [section.id]: "err" }));
      } finally {
        setSectionChecking(s => ({ ...s, [section.id]: false }));
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

  const tab = TABS.find(t => t.id === activeTab) ?? TABS[0];

  const renderSection = (id: string) => {
    const section = SECTIONS.find(s => s.id === id);
    if (!section) return null;
    if (section.id === "telephony") {
      return (
        <TelephonyUisCard
          key={section.id}
          isDark={isDark}
          cardBg={cardBg} cardBrd={cardBrd} inputBg={inputBg} inputBrd={inputBrd}
          txt={txt} txtSub={txtSub}
          values={values} setValues={setValues}
          saveConfig={saveIntegrationsConfig}
        />
      );
    }
    return (
      <ProviderSection
        key={section.id}
        section={section}
        isDark={isDark}
        txt={txt} txtSub={txtSub}
        cardBg={cardBg} cardBrd={cardBrd} inputBg={inputBg} inputBrd={inputBrd}
        activeProvider={activeProvider} setActiveProvider={setActiveProvider}
        values={values} setValues={setValues}
        revealed={revealed} setRevealed={setRevealed}
        sectionCheck={sectionCheck} sectionChecking={sectionChecking} checkSection={checkSection}
        avitoConnected={avitoConnected} avitoConnecting={avitoConnecting} connectAvito={connectAvito}
        tgLeadsBotUsername={tgLeadsBotUsername}
        tgLeadsError={tgLeadsError}
        onToggleEnabled={toggleSectionEnabled}
        toggling={togglingSection === section.id}
      />
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 max-w-4xl mx-auto w-full">
      <div className="mb-4">
        <h2 className="text-base font-bold" style={{ color: txt }}>Интеграции</h2>
        <p className="text-xs mt-1" style={{ color: txtSub }}>
          Подключите свои сервисы. Ключи вводятся один раз и сохраняются.
        </p>
      </div>

      {/* ═══ Горизонтальные табы ═══ */}
      <div className="flex gap-2 items-center overflow-x-auto pb-1 mb-4" style={{ scrollbarWidth: "none" }}>
        {TABS.map(t => {
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className="flex-shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-xl transition"
              style={{
                background: active ? t.color + "18" : cardBg,
                border: `1px solid ${active ? t.color + "50" : cardBrd}`,
              }}>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: t.color + "20" }}>
                <Icon name={t.icon} size={13} style={{ color: t.color }} />
              </div>
              <span className="text-xs font-bold whitespace-nowrap"
                style={{ color: active ? t.color : txt }}>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ═══ Описание активного таба ═══ */}
      <div className="text-[11px] mb-3.5 px-1" style={{ color: txtSub }}>{tab.desc}</div>

      <div className="flex flex-col gap-4">
        {/* Источники заявок: вебхук + почта (новое) + Telegram-группа */}
        {activeTab === "leads" && (
          <LeadSourcesCards
            cardBg={cardBg} cardBrd={cardBrd} inputBg={inputBg} inputBrd={inputBrd}
            txt={txt} txtSub={txtSub} isDark={isDark}
          />
        )}

        {/* Уведомления: Telegram и MAX */}
        {activeTab === "notify" && (
          <>
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
              enabled={values.tg_notify_enabled !== "false"}
              onToggleEnabled={next => toggleSectionEnabled({ id: "tg_notify", enabledKey: "tg_notify_enabled" } as SectionDef, next)}
            />
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
              enabled={values.max_notify_enabled !== "false"}
              onToggleEnabled={next => toggleSectionEnabled({ id: "max_notify", enabledKey: "max_notify_enabled" } as SectionDef, next)}
            />
          </>
        )}

        {/* Остальные табы — секции из конфига */}
        {tab.sections.map(renderSection)}
      </div>

      <div className="mt-5 flex items-center gap-3 flex-wrap">
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
          Сохраняются все введённые ключи на этой странице.
        </span>
      </div>
    </div>
  );
}