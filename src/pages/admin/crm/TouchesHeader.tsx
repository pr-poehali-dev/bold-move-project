import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { TouchClient } from "./touchesShared";

interface Props {
  phone: string;
  client: TouchClient | null;
  callingUis: boolean;
  onFocusDraft: () => void;
  onCall: (phone: string, clientId?: number) => void;
  /** Скрыть строку контакта (телефон + Написать/Позвонить) — когда те же кнопки уже есть в шапке экрана */
  hideContactBar?: boolean;
}

const interestMeta: Record<string, { label: string; color: string }> = {
  high:   { label: "Высокий интерес", color: "#22c55e" },
  medium: { label: "Средний интерес", color: "#eab308" },
  low:    { label: "Низкий интерес",  color: "#ef4444" },
};

// Шапка вкладки «Касания»: номер телефона + кнопки «Написать»/«Позвонить»,
// а под ней — мини-статус клиента (интерес, стадия, следующий шаг) от ИИ-анализа.
export default function TouchesHeader({ phone, client, callingUis, onFocusDraft, onCall, hideContactBar }: Props) {
  const t = useTheme();

  return (
    <>
      {/* Шапка: номер телефона + звонок — только если телефон указан */}
      {hideContactBar ? null : phone ? (
        <div className="flex-shrink-0 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2"
          style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: t.textSub }}>
            <Icon name="Phone" size={12} style={{ color: t.textMute }} />
            {phone}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={onFocusDraft}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition active:scale-[0.97]"
              style={{ background: t.accent + "22", color: t.accentLight }}>
              <Icon name="MessageCircle" size={13} /> Написать
            </button>
            <button onClick={() => onCall(phone, client?.id)}
              disabled={callingUis}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition active:scale-[0.97] disabled:opacity-60"
              style={{ background: "#22c55e22", color: "#22c55e" }}>
              <Icon name={callingUis ? "Loader2" : "PhoneCall"} size={13} className={callingUis ? "animate-spin" : ""} /> Позвонить
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-shrink-0 px-3 sm:px-6 py-2.5 flex items-center gap-1.5 text-xs font-medium"
          style={{ borderBottom: `1px solid ${t.border}`, color: t.textSub }}>
          <Icon name="MessagesSquare" size={12} style={{ color: "#f97316" }} />
          Переписка Avito
        </div>
      )}

      {/* Мини-шапка состояния клиента (быстрый контекст) */}
      {client && (client.next_action || client.interest || client.stage) && (
        <div className="flex-shrink-0 px-3 sm:px-6 py-2.5" style={{ borderBottom: `1px solid ${t.border}`, background: t.surface2 }}>
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {client.interest && interestMeta[client.interest] && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                style={{ background: interestMeta[client.interest].color + "22", color: interestMeta[client.interest].color }}>
                {interestMeta[client.interest].label}
              </span>
            )}
            {client.stage && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                style={{ background: t.accent + "22", color: t.accentLight }}>
                {client.stage}
              </span>
            )}
          </div>
          {client.next_action && (
            <div className="text-[11px] flex items-start gap-1.5" style={{ color: t.textSub }}>
              <Icon name="Lightbulb" size={12} style={{ color: "#eab308", marginTop: 1 }} />
              <span><b style={{ color: t.text }}>Следующий шаг:</b> {client.next_action}</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}