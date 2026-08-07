import Icon from "@/components/ui/icon";
import type { SectionDef, ProviderOption } from "./integrationsConfig";

interface Props {
  section: SectionDef;
  isDark: boolean;
  txt: string;
  txtSub: string;
  cardBg: string;
  cardBrd: string;
  inputBg: string;
  inputBrd: string;
  activeProvider: Record<string, string>;
  setActiveProvider: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  values: Record<string, string>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  revealed: Record<string, boolean>;
  setRevealed: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  sectionCheck: Record<string, "ok" | "err">;
  sectionChecking?: Record<string, boolean>;
  checkSection: (section: SectionDef, provider: ProviderOption) => void;
  avitoConnected?: boolean;
  avitoConnecting?: boolean;
  connectAvito?: () => void;
  tgLeadsBotUsername?: string | null;
  tgLeadsError?: string | null;
}

export default function ProviderSection({
  section, isDark, txt, txtSub, cardBg, cardBrd, inputBg, inputBrd,
  activeProvider, setActiveProvider, values, setValues,
  revealed, setRevealed, sectionCheck, sectionChecking, checkSection,
  avitoConnected, avitoConnecting, connectAvito, tgLeadsBotUsername, tgLeadsError,
}: Props) {
  const current = section.providers.find(p => p.id === activeProvider[section.id]) ?? section.providers[0];
  const multiProvider = section.providers.length > 1;
  return (
    <div className="rounded-2xl p-4"
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

      {/* Личный аккаунт: вход по QR/номеру через VPS-воркер (не поля-токены) */}
      {section.kind === "account" && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg w-fit"
            style={{ background: "rgba(148,163,184,0.12)", color: txtSub }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#94a3b8" }} /> Не подключено
          </div>
          <button
            onClick={() => checkSection(section, current)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition w-fit"
            style={{ background: "#7c3aed", color: "#fff" }}>
            <Icon name={section.authMethod === "qr" ? "QrCode" : "Smartphone"} size={13} />
            {section.authMethod === "qr" ? "Подключить по QR-коду" : "Подключить по номеру"}
          </button>
          <div className="text-[10px]" style={{ color: txtSub }}>
            {section.authMethod === "qr"
              ? "Появится QR-код — отсканируйте его приложением Telegram (Настройки → Устройства → Подключить устройство)."
              : "Введёте номер телефона, придёт код в приложение MAX — подтвердите вход."}
            {" "}Требуется подключённый сервер-воркер.
          </div>
        </div>
      )}

      {section.kind !== "account" && multiProvider && (
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

      {section.kind !== "account" && <div className="flex flex-col gap-2.5">
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
      </div>}

      {/* Avito: сначала ключи, потом ОБЯЗАТЕЛЬНЫЙ вход владельца аккаунта — без него
          Avito не выдаёт прав на чтение/отправку сообщений, даже если ключи верные. */}
      {section.id === "avito" && <div className="flex flex-col gap-2 mt-3">
        <button
          onClick={connectAvito}
          disabled={avitoConnecting}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition w-fit disabled:opacity-60"
          style={{ background: "#7c3aed", color: "#fff" }}>
          <Icon name={avitoConnecting ? "Loader2" : "LogIn"} size={13} className={avitoConnecting ? "animate-spin" : ""} />
          {avitoConnected ? "Переподключить Avito" : "Подключить Avito"}
        </button>
        {avitoConnected ? (
          <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: "#10b981" }}>
            <Icon name="CheckCircle2" size={12} /> Аккаунт подключён, сообщения принимаются
          </span>
        ) : (
          <span className="text-[10px]" style={{ color: txtSub }}>
            Сначала заполните Client ID и Client Secret выше, затем войдите в свой аккаунт Avito —
            без этого шага сообщения от клиентов не будут приходить.
          </span>
        )}
      </div>}

      {/* Заявки из Telegram-группы: подсказка + реальная проверка токена и вебхука */}
      {section.id === "tg_leads" && (
        <div className="mt-3 text-[10px]" style={{ color: txtSub }}>
          Заведите бота у @BotFather, добавьте его в группу с заявками и отключите Privacy Mode
          (@BotFather → /mybots → выбрать бота → Bot Settings → Group Privacy → Turn off) — иначе бот
          не увидит чужие сообщения в группе.
        </div>
      )}

      {/* Проверить — только для остальных секций с полями (не Avito, не личные аккаунты) */}
      {section.kind !== "account" && section.id !== "avito" && <div className="flex items-center gap-2 mt-3">
        <button
          onClick={() => checkSection(section, current)}
          disabled={!!sectionChecking?.[section.id]}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition disabled:opacity-60"
          style={{ background: "rgba(124,58,237,0.14)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.3)" }}>
          {sectionChecking?.[section.id]
            ? <div className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
            : <Icon name="Zap" size={11} />}
          {sectionChecking?.[section.id] ? "Проверка..." : (section.id === "tg_leads" ? "Подключить" : "Проверить")}
        </button>
        {!sectionChecking?.[section.id] && sectionCheck[section.id] === "ok" && (
          <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: "#10b981" }}>
            <Icon name="CheckCircle2" size={12} />
            {section.id === "tg_leads"
              ? `Подключено${tgLeadsBotUsername ? `: @${tgLeadsBotUsername}` : ""}`
              : "Поля заполнены"}
          </span>
        )}
        {!sectionChecking?.[section.id] && sectionCheck[section.id] === "err" && (
          <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: "#ef4444" }}>
            <Icon name="AlertTriangle" size={12} />
            {section.id === "tg_leads"
              ? `Не удалось подключить${tgLeadsError ? `: ${tgLeadsError}` : ""}`
              : "Заполните обязательные поля"}
          </span>
        )}
      </div>}
    </div>
  );
}