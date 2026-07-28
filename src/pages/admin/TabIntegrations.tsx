import { useState } from "react";
import Icon from "@/components/ui/icon";

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
    id: "channels",
    title: "Каналы (мессенджеры)",
    desc: "Токены для приёма и отправки сообщений.",
    icon: "MessagesSquare",
    providers: [
      { id: "telegram", label: "Telegram", fields: [
        { key: "telegram_token", label: "Bot Token", placeholder: "123456:AA...", type: "password" },
      ]},
      { id: "max", label: "MAX (max.ru)", fields: [
        { key: "max_token", label: "API Token", placeholder: "...", type: "password" },
      ]},
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
  const [activeProvider, setActiveProvider] = useState<Record<string, string>>(
    Object.fromEntries(SECTIONS.map(s => [s.id, s.providers[0].id]))
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const cardBg   = isDark ? "#13131f" : "#ffffff";
  const cardBrd  = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const inputBg  = isDark ? "#0e0e1c" : "#f9fafb";
  const inputBrd = isDark ? "rgba(255,255,255,0.12)" : "#e5e7eb";
  const txt      = isDark ? "rgba(255,255,255,0.9)" : "#111827";
  const txtSub   = isDark ? "rgba(255,255,255,0.45)" : "#6b7280";

  return (
    <div className="flex-1 overflow-y-auto p-4 max-w-4xl mx-auto w-full">
      <div className="mb-5">
        <h2 className="text-base font-bold" style={{ color: txt }}>Интеграции</h2>
        <p className="text-xs mt-1" style={{ color: txtSub }}>
          Подключите свои сервисы: транскрибацию, ИИ и каналы связи. Ключи вводятся один раз.
        </p>
      </div>

      <div className="flex flex-col gap-4">
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
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition hover:opacity-90"
          style={{ background: "#7c3aed", color: "#fff" }}>
          <Icon name="Save" size={15} />
          Сохранить
        </button>
        <span className="text-[11px]" style={{ color: txtSub }}>
          Пока это только внешний вид — сохранение подключим следующим шагом.
        </span>
      </div>
    </div>
  );
}
