import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useAuth, type Brand } from "@/context/AuthContext";
import { updateBrand } from "./own-agent/brandApi";
import { crmFetch } from "./crm/crmApi";

interface Props {
  isDark: boolean;
}

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "password";
  options?: string[];   // если задано — рендерим выпадающий список
}

interface ProviderOption {
  id: string;
  label: string;
  fields: FieldDef[];
}

interface SectionDef {
  id: string;
  group: string;   // ключ группы
  title: string;
  desc: string;
  icon: string;
  providers: ProviderOption[];
}

// Смысловые группы вкладки «Интеграции»
const GROUPS: { id: string; title: string; desc: string }[] = [
  { id: "channels", title: "Каналы общения с клиентом",
    desc: "Двусторонняя переписка: клиент пишет — сообщение попадает в ленту «Касания», отвечаете из CRM." },
  { id: "ai", title: "ИИ и обработка",
    desc: "Распознавание звонков и модель, которая анализирует историю клиента." },
  { id: "telephony", title: "Телефония (АТС)",
    desc: "Входящие звонки для транскрибации и анализа." },
];

const SECTIONS: SectionDef[] = [
  // ── Каналы общения с клиентом ──
  {
    id: "tg_bot", group: "channels",
    title: "Telegram-бот",
    desc: "Двусторонняя переписка с клиентом через вашего Telegram-бота.",
    icon: "Send",
    providers: [
      { id: "tg_bot", label: "Telegram", fields: [
        { key: "tg_channel_token", label: "Токен бота (для переписки)", placeholder: "123456:AA...", type: "password" },
      ]},
    ],
  },
  {
    id: "max_bot", group: "channels",
    title: "MAX-бот",
    desc: "Двусторонняя переписка с клиентом через MAX-бота.",
    icon: "MessageCircle",
    providers: [
      { id: "max_bot", label: "MAX", fields: [
        { key: "max_channel_token", label: "Токен бота MAX (для переписки)", placeholder: "...", type: "password" },
      ]},
    ],
  },
  {
    id: "avito", group: "channels",
    title: "Avito",
    desc: "Приём и отправка сообщений через Avito Messenger API.",
    icon: "MessagesSquare",
    providers: [
      { id: "avito", label: "Avito", fields: [
        { key: "avito_client_id", label: "Client ID", placeholder: "..." },
        { key: "avito_client_secret", label: "Client Secret", placeholder: "...", type: "password" },
      ]},
    ],
  },
  {
    id: "webchat", group: "channels",
    title: "Веб-чат на сайте",
    desc: "Виджет чата на вашем сайте — клиент пишет прямо там, без мессенджеров.",
    icon: "MessageSquareText",
    providers: [
      { id: "webchat", label: "Веб-чат", fields: [
        { key: "webchat_site_url", label: "Адрес сайта", placeholder: "https://..." },
      ]},
    ],
  },
  {
    id: "whatsapp", group: "channels",
    title: "WhatsApp",
    desc: "Приём и отправка через официальный WhatsApp Cloud API.",
    icon: "Phone",
    providers: [
      { id: "whatsapp", label: "WhatsApp", fields: [
        { key: "whatsapp_phone_id", label: "Phone Number ID", placeholder: "..." },
        { key: "whatsapp_token", label: "Access Token", placeholder: "...", type: "password" },
      ]},
    ],
  },
  // ── ИИ и обработка ──
  {
    id: "transcription", group: "ai",
    title: "Транскрибация звонков",
    desc: "Сервис, который превращает записи звонков в текст.",
    icon: "AudioLines",
    providers: [
      { id: "assemblyai", label: "AssemblyAI", fields: [
        { key: "assemblyai_key", label: "API-ключ", placeholder: "sk-...", type: "password" },
      ]},
      { id: "whisper", label: "Whisper (OpenAI)", fields: [
        { key: "whisper_key", label: "API-ключ OpenAI", placeholder: "sk-...", type: "password" },
        { key: "whisper_model", label: "Модель", placeholder: "whisper-1" },
      ]},
    ],
  },
  {
    id: "llm", group: "ai",
    title: "Думающая LLM",
    desc: "Модель, которая анализирует историю клиента и даёт рекомендации.",
    icon: "BrainCircuit",
    providers: [
      { id: "mistral", label: "Mistral AI", fields: [
        { key: "mistral_key", label: "API-ключ", placeholder: "...", type: "password" },
        { key: "mistral_model", label: "Модель", placeholder: "Модель",
          options: ["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest"] },
      ]},
      { id: "openai", label: "OpenAI", fields: [
        { key: "openai_key", label: "API-ключ", placeholder: "sk-...", type: "password" },
        { key: "openai_model", label: "Модель", placeholder: "Модель",
          options: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"] },
      ]},
      { id: "other", label: "Другая", fields: [
        { key: "other_base_url", label: "Base URL", placeholder: "https://api.example.com/v1" },
        { key: "other_key", label: "API-ключ", placeholder: "...", type: "password" },
        { key: "other_model", label: "Модель", placeholder: "название-модели" },
      ]},
    ],
  },
  // ── Телефония ──
  {
    id: "telephony", group: "telephony",
    title: "Телефония (АТС)",
    desc: "Входящие звонки приходят на этот вебхук.",
    icon: "PhoneCall",
    providers: [
      { id: "webhook", label: "Вебхук АТС", fields: [
        { key: "telephony_webhook", label: "URL вебхука", placeholder: "https://..." },
      ]},
    ],
  },
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

  const [activeProvider, setActiveProvider] = useState<Record<string, string>>(
    Object.fromEntries(SECTIONS.map(s => [s.id, s.providers[0].id]))
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [sectionCheck, setSectionCheck] = useState<Record<string, "ok" | "err">>({});

  // Формальная проверка секции: заполнены ли обязательные поля (select-поля необязательны).
  // Реальная проверка каждого API будет подключена на этапе модуля «Касания».
  const checkSection = (section: SectionDef, provider: ProviderOption) => {
    const required = provider.fields.filter(f => !f.options);
    const ok = required.length > 0 && required.every(f => (values[f.key] ?? "").trim());
    setSectionCheck(s => ({ ...s, [section.id]: ok ? "ok" : "err" }));
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
          const { _providers, ...vals } = d.config;
          setValues(v => ({ ...vals, ...v }));
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
      // Новые сервисы (ключи + выбранные провайдеры) → таблица integrations.
      // Мержим с текущим config, чтобы не затереть флаги notify_* из «Своего агента».
      let prevCfg: Record<string, unknown> = {};
      try {
        const cur = await crmFetch("integrations") as { config?: Record<string, unknown> };
        if (cur?.config && typeof cur.config === "object") prevCfg = cur.config;
      } catch { /* тихо */ }
      await crmFetch("integrations", {
        method: "POST",
        body: JSON.stringify({ config: { ...prevCfg, ...values, _providers: JSON.stringify(activeProvider) } }),
      });
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
        <div className="rounded-2xl p-4"
          style={{ background: cardBg, border: `1px solid ${cardBrd}` }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(124,58,237,0.15)" }}>
              <Icon name="Send" size={14} style={{ color: "#a78bfa" }} />
            </div>
            <div>
              <div className="text-sm font-black" style={{ color: text }}>Интеграция с Telegram</div>
              <div className="text-[11px]" style={{ color: muted }}>Новые заявки будут приходить в ваш бот</div>
            </div>
          </div>
          <div className="space-y-2.5">
            <div>
              <input
                value={tgToken}
                onChange={e => setTgToken(e.target.value)}
                placeholder="Токен бота (получить у @BotFather)"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition placeholder:text-white placeholder:font-semibold"
                style={{ background: inputBg, border: `1px solid ${inputBrd}`, color: text }}
              />
            </div>
            <div>
              <input
                value={tgChat}
                onChange={e => setTgChat(e.target.value)}
                placeholder="ID чата или группы (узнать у @userinfobot)"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition placeholder:text-white placeholder:font-semibold"
                style={{ background: inputBg, border: `1px solid ${inputBrd}`, color: text }}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={testTelegram}
                disabled={!tgToken || !tgChat || tgTesting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition disabled:opacity-40"
                style={{ background: "rgba(124,58,237,0.14)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.3)" }}>
                {tgTesting
                  ? <><div className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" /> Проверка...</>
                  : <><Icon name="Zap" size={11} /> Проверить</>}
              </button>
              {tgTestResult === "ok" && (
                <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: "#10b981" }}>
                  <Icon name="CheckCircle2" size={12} /> Сообщение отправлено!
                </span>
              )}
              {tgTestResult === "err" && (
                <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: "#ef4444" }}>
                  <Icon name="AlertTriangle" size={12} /> Ошибка — проверьте токен и ID чата
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Интеграция с MAX */}
        <div className="rounded-2xl p-4"
          style={{ background: cardBg, border: `1px solid ${cardBrd}` }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(124,58,237,0.15)" }}>
              <span style={{ fontSize: 15, lineHeight: 1, color: "#a78bfa", fontWeight: 900 }}>М</span>
            </div>
            <div>
              <div className="text-sm font-black" style={{ color: text }}>Интеграция с MAX</div>
              <div className="text-[11px]" style={{ color: muted }}>Новые заявки будут приходить в ваш бот MAX</div>
            </div>
          </div>
          <div className="space-y-2.5">
            <div>
              <input
                value={maxToken}
                onChange={e => setMaxToken(e.target.value)}
                placeholder="Токен бота (получить у @MasterBot в MAX)"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition placeholder:text-white placeholder:font-semibold"
                style={{ background: inputBg, border: `1px solid ${inputBrd}`, color: text }}
              />
            </div>
            <div>
              <input
                value={maxChat}
                onChange={e => setMaxChat(e.target.value)}
                placeholder="ID чата (числовой ID получателя)"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition placeholder:text-white placeholder:font-semibold"
                style={{ background: inputBg, border: `1px solid ${inputBrd}`, color: text }}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={testMax}
                disabled={!maxToken || !maxChat || maxTesting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition disabled:opacity-40"
                style={{ background: "rgba(124,58,237,0.14)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.3)" }}>
                {maxTesting
                  ? <><div className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" /> Проверка...</>
                  : <><Icon name="Zap" size={11} /> Проверить</>}
              </button>
              {maxTestResult === "ok" && (
                <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: "#10b981" }}>
                  <Icon name="CheckCircle2" size={12} /> Сообщение отправлено!
                </span>
              )}
              {maxTestResult === "err" && (
                <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: "#ef4444" }}>
                  <Icon name="AlertTriangle" size={12} /> Ошибка — проверьте токен и ID чата
                </span>
              )}
            </div>
          </div>
        </div>

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

              {groupSections.map(section => {
                const current = section.providers.find(p => p.id === activeProvider[section.id]) ?? section.providers[0];
                const multiProvider = section.providers.length > 1;
                return (
            <div key={section.id} className="rounded-2xl p-4"
              style={{ background: cardBg, border: `1px solid ${cardBrd}` }}>

              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(124,58,237,0.12)" }}>
                  <Icon name={section.icon} size={17} style={{ color: "#a78bfa" }} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold" style={{ color: txt }}>{section.title}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: txtSub }}>{section.desc}</div>
                </div>
              </div>

              {multiProvider && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {section.providers.map(p => {
                    const active = p.id === current.id;
                    return (
                      <button key={p.id}
                        onClick={() => setActiveProvider(s => ({ ...s, [section.id]: p.id }))}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                        style={{
                          background: active ? "rgba(124,58,237,0.18)" : (isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6"),
                          color: active ? "#a78bfa" : txtSub,
                          border: `1px solid ${active ? "rgba(124,58,237,0.4)" : "transparent"}`,
                        }}>
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                {current.fields.map(f => {
                  const isSecret = f.type === "password";
                  const show = revealed[f.key];
                  return (
                    <div key={f.key}>
                      {f.options ? (
                        <select
                          value={values[f.key] ?? ""}
                          onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                          className="w-full text-sm rounded-xl px-3 py-2.5 focus:outline-none transition font-semibold"
                          style={{ background: inputBg, border: `1px solid ${inputBrd}`, color: values[f.key] ? txt : "#fff" }}>
                          <option value="">{f.label} (по умолчанию)</option>
                          {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <div className="relative">
                          <input
                            type={isSecret && !show ? "password" : "text"}
                            value={values[f.key] ?? ""}
                            onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                            placeholder={f.label}
                            className="w-full text-sm rounded-xl px-3 py-2.5 focus:outline-none transition placeholder:text-white placeholder:font-semibold"
                            style={{ background: inputBg, border: `1px solid ${inputBrd}`, color: txt, paddingRight: isSecret ? 40 : undefined }}
                          />
                          {isSecret && (
                            <button type="button"
                              onClick={() => setRevealed(r => ({ ...r, [f.key]: !r[f.key] }))}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md transition"
                              style={{ color: txtSub }}>
                              <Icon name={show ? "EyeOff" : "Eye"} size={15} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Проверить — формальная проверка (заполнены ли поля) */}
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => checkSection(section, current)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition"
                  style={{ background: "rgba(124,58,237,0.14)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.3)" }}>
                  <Icon name="Zap" size={11} /> Проверить
                </button>
                {sectionCheck[section.id] === "ok" && (
                  <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: "#10b981" }}>
                    <Icon name="CheckCircle2" size={12} /> Поля заполнены
                  </span>
                )}
                {sectionCheck[section.id] === "err" && (
                  <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: "#ef4444" }}>
                    <Icon name="AlertTriangle" size={12} /> Заполните обязательные поля
                  </span>
                )}
              </div>
            </div>
                );
              })}
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