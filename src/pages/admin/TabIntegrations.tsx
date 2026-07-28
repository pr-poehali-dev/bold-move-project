import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useAuth, type Brand } from "@/context/AuthContext";
import { updateBrand } from "./own-agent/brandApi";

interface Props {
  isDark: boolean;
}

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "password";
}

interface ProviderOption {
  id: string;
  label: string;
  fields: FieldDef[];
}

interface SectionDef {
  id: string;
  title: string;
  desc: string;
  icon: string;
  providers: ProviderOption[];
}

const SECTIONS: SectionDef[] = [
  {
    id: "transcription",
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
    id: "llm",
    title: "Думающая LLM",
    desc: "Модель, которая анализирует историю клиента и даёт рекомендации.",
    icon: "BrainCircuit",
    providers: [
      { id: "mistral", label: "Mistral AI", fields: [
        { key: "mistral_key", label: "API-ключ", placeholder: "...", type: "password" },
        { key: "mistral_model", label: "Модель", placeholder: "mistral-small-latest" },
      ]},
      { id: "openai", label: "OpenAI", fields: [
        { key: "openai_key", label: "API-ключ", placeholder: "sk-...", type: "password" },
        { key: "openai_model", label: "Модель", placeholder: "gpt-4o-mini" },
      ]},
      { id: "other", label: "Другая", fields: [
        { key: "other_base_url", label: "Base URL", placeholder: "https://api.example.com/v1" },
        { key: "other_key", label: "API-ключ", placeholder: "...", type: "password" },
        { key: "other_model", label: "Модель", placeholder: "название-модели" },
      ]},
    ],
  },
  {
    id: "avito",
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
    id: "telephony",
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
        {/* ── Каналы (мессенджеры) — реальные интеграции ── */}

        {/* Интеграция с Telegram */}
        <div className="rounded-2xl p-4"
          style={{ background: cardBg, border: `1px solid ${cardBrd}` }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(96,165,250,0.15)" }}>
              <Icon name="Send" size={14} style={{ color: "#60a5fa" }} />
            </div>
            <div>
              <div className="text-sm font-black" style={{ color: text }}>Интеграция с Telegram</div>
              <div className="text-[11px]" style={{ color: muted }}>Новые заявки будут приходить в ваш бот</div>
            </div>
          </div>
          <div className="space-y-2.5">
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: muted }}>
                Токен бота <span className="font-normal opacity-60">(получить у @BotFather)</span>
              </label>
              <input
                value={tgToken}
                onChange={e => setTgToken(e.target.value)}
                placeholder="7123456789:AAF..."
                className="w-full rounded-xl px-3 py-2 text-xs font-mono outline-none transition"
                style={{ background: inputBg, border: `1px solid ${inputBrd}`, color: text }}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: muted }}>
                ID чата или группы <span className="font-normal opacity-60">(узнать у @userinfobot)</span>
              </label>
              <input
                value={tgChat}
                onChange={e => setTgChat(e.target.value)}
                placeholder="-1001234567890 или @username"
                className="w-full rounded-xl px-3 py-2 text-xs font-mono outline-none transition"
                style={{ background: inputBg, border: `1px solid ${inputBrd}`, color: text }}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={testTelegram}
                disabled={!tgToken || !tgChat || tgTesting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition disabled:opacity-40"
                style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.25)" }}>
                {tgTesting
                  ? <><div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> Проверка...</>
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
              style={{ background: "rgba(99,179,237,0.15)" }}>
              <span style={{ fontSize: 15, lineHeight: 1 }}>М</span>
            </div>
            <div>
              <div className="text-sm font-black" style={{ color: text }}>Интеграция с MAX</div>
              <div className="text-[11px]" style={{ color: muted }}>Новые заявки будут приходить в ваш бот MAX</div>
            </div>
          </div>
          <div className="space-y-2.5">
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: muted }}>
                Токен бота <span className="font-normal opacity-60">(получить у @MasterBot в MAX)</span>
              </label>
              <input
                value={maxToken}
                onChange={e => setMaxToken(e.target.value)}
                placeholder="ваш_токен_бота_MAX"
                className="w-full rounded-xl px-3 py-2 text-xs font-mono outline-none transition"
                style={{ background: inputBg, border: `1px solid ${inputBrd}`, color: text }}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: muted }}>
                ID чата <span className="font-normal opacity-60">(числовой ID получателя)</span>
              </label>
              <input
                value={maxChat}
                onChange={e => setMaxChat(e.target.value)}
                placeholder="123456789"
                className="w-full rounded-xl px-3 py-2 text-xs font-mono outline-none transition"
                style={{ background: inputBg, border: `1px solid ${inputBrd}`, color: text }}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={testMax}
                disabled={!maxToken || !maxChat || maxTesting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition disabled:opacity-40"
                style={{ background: "rgba(99,179,237,0.12)", color: "#63b3ed", border: "1px solid rgba(99,179,237,0.25)" }}>
                {maxTesting
                  ? <><div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#63b3ed", borderTopColor: "transparent" }} /> Проверка...</>
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

        {/* ── Прочие сервисы (макет, сохранение подключим позже) ── */}
        {SECTIONS.map(section => {
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
                      <label className="block text-[11px] font-semibold mb-1" style={{ color: txtSub }}>{f.label}</label>
                      <div className="relative">
                        <input
                          type={isSecret && !show ? "password" : "text"}
                          value={values[f.key] ?? ""}
                          onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          className="w-full text-sm rounded-xl px-3 py-2.5 focus:outline-none transition"
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
                    </div>
                  );
                })}
              </div>
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