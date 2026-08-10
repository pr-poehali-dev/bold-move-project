import Icon from "@/components/ui/icon";
import EnabledToggle from "./EnabledToggle";

interface Props {
  cardBg: string;
  cardBrd: string;
  inputBg: string;
  inputBrd: string;
  text: string;
  muted: string;
  /** Иконка слева: либо lucide-имя, либо готовый ReactNode (буква «М» для MAX) */
  iconName?: string;
  iconNode?: React.ReactNode;
  title: string;
  subtitle: string;
  tokenValue: string;
  onTokenChange: (v: string) => void;
  tokenPlaceholder: string;
  chatValue: string;
  onChatChange: (v: string) => void;
  chatPlaceholder: string;
  onTest: () => void;
  testing: boolean;
  testResult: "ok" | "err" | null;
  /** Визуальный тумблер вкл/выкл (пока без реального эффекта на бэкенде — уведомления
      отправляются только вручную кнопкой «Проверить», автоприёма пока нет) */
  enabled?: boolean;
  onToggleEnabled?: (next: boolean) => void;
}

export default function NotifyIntegrationCard({
  cardBg, cardBrd, inputBg, inputBrd, text, muted,
  iconName, iconNode, title, subtitle,
  tokenValue, onTokenChange, tokenPlaceholder,
  chatValue, onChatChange, chatPlaceholder,
  onTest, testing, testResult,
  enabled = true, onToggleEnabled,
}: Props) {
  return (
    <div className="rounded-2xl p-4"
      style={{ background: cardBg, border: `1px solid ${cardBrd}`, opacity: enabled ? 1 : 0.65 }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(124,58,237,0.15)" }}>
          {iconNode ?? <Icon name={iconName || "Send"} size={14} style={{ color: "#a78bfa" }} />}
        </div>
        <div className="flex-1">
          <div className="text-sm font-black" style={{ color: text }}>{title}</div>
          <div className="text-[11px]" style={{ color: muted }}>{subtitle}</div>
        </div>
        {onToggleEnabled && (
          <EnabledToggle enabled={enabled} onChange={onToggleEnabled} />
        )}
      </div>
      <div className="space-y-2.5">
        <div>
          <input
            value={tokenValue}
            onChange={e => onTokenChange(e.target.value)}
            placeholder={tokenPlaceholder}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition placeholder:text-white placeholder:font-semibold"
            style={{ background: inputBg, border: `1px solid ${inputBrd}`, color: text }}
          />
        </div>
        <div>
          <input
            value={chatValue}
            onChange={e => onChatChange(e.target.value)}
            placeholder={chatPlaceholder}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition placeholder:text-white placeholder:font-semibold"
            style={{ background: inputBg, border: `1px solid ${inputBrd}`, color: text }}
          />
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onTest}
            disabled={!tokenValue || !chatValue || testing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition disabled:opacity-40"
            style={{ background: "rgba(124,58,237,0.14)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.3)" }}>
            {testing
              ? <><div className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" /> Проверка...</>
              : <><Icon name="Zap" size={11} /> Проверить</>}
          </button>
          {testResult === "ok" && (
            <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: "#10b981" }}>
              <Icon name="CheckCircle2" size={12} /> Сообщение отправлено!
            </span>
          )}
          {testResult === "err" && (
            <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: "#ef4444" }}>
              <Icon name="AlertTriangle" size={12} /> Ошибка — проверьте токен и ID чата
            </span>
          )}
        </div>
      </div>
    </div>
  );
}