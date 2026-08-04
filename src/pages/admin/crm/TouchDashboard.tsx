import { useState, useEffect } from "react";
import { crmFetch, Client } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";

interface ChannelCount { channel: string; count: number }
interface AttentionItem {
  id: number; name: string | null; phone: string | null;
  interest: string | null; stage: string | null; next_action: string | null; unread: boolean;
}
interface TouchDashboardData {
  days: number;
  total_touches: number;
  by_channel: ChannelCount[];
  conversion_pct: number;
  analyzed_total: number;
  attention: AttentionItem[];
  avg_operator_score: number | null;
  scored_calls_count: number;
}

const CHANNEL_META: Record<string, { icon: string; label: string; color: string }> = {
  call:     { icon: "Phone",             label: "Звонки",   color: "#22c55e" },
  telegram: { icon: "Send",              label: "Telegram", color: "#3b82f6" },
  max:      { icon: "MessageCircle",     label: "MAX",      color: "#a855f7" },
  avito:    { icon: "MessagesSquare",    label: "Avito",    color: "#f97316" },
  whatsapp: { icon: "Phone",             label: "WhatsApp", color: "#25d366" },
  webchat:  { icon: "MessageSquareText", label: "Веб-чат",  color: "#0ea5e9" },
};
const channelMeta = (c: string) => CHANNEL_META[c] || { icon: "MessageSquare", label: c, color: "#8b5cf6" };

const INTEREST_META: Record<string, { label: string; color: string }> = {
  high:   { label: "Высокий", color: "#22c55e" },
  medium: { label: "Средний", color: "#eab308" },
  low:    { label: "Низкий",  color: "#ef4444" },
};

interface Props {
  clients: Client[];
  sourceFilter?: string;
  onSelectClient: (c: Client) => void;
}

export default function TouchDashboard({ clients, sourceFilter = "", onSelectClient }: Props) {
  const t = useTheme();
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TouchDashboardData | null>(null);

  const load = (d: number, src: string) => {
    setLoading(true);
    const params: Record<string, string> = { days: String(d) };
    if (src) params.source = src;
    crmFetch("touch-dashboard", undefined, params)
      .then(r => setData(r as TouchDashboardData))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(days, sourceFilter); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [days, sourceFilter]);

  const findClient = (phone: string | null): Client | null => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, "").slice(-10);
    return clients.find(c => (c.phone || "").replace(/\D/g, "").slice(-10) === digits) ?? null;
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const d = data ?? {
    days, total_touches: 0, by_channel: [], conversion_pct: 0, analyzed_total: 0, attention: [],
    avg_operator_score: null, scored_calls_count: 0,
  };
  const maxChannelCount = Math.max(1, ...d.by_channel.map(x => x.count));

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-2xl p-4" style={{ background: t.surface, border: `1px solid ${t.border}` }}>{children}</div>
  );

  return (
    <div className="space-y-4">
      {/* Переключатель периода */}
      <div className="flex items-center justify-end gap-1">
        {[7, 30, 90].map(opt => (
          <button key={opt} onClick={() => setDays(opt)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition"
            style={{
              background: days === opt ? "#7c3aed22" : "transparent",
              color: days === opt ? "#a78bfa" : t.textMute,
              border: `1px solid ${days === opt ? "#7c3aed40" : t.border}`,
            }}>
            {opt} дн.
          </button>
        ))}
      </div>

      {/* Ключевые цифры */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <div className="text-xs mb-1" style={{ color: t.textMute }}>Касаний за {d.days} дн.</div>
          <div className="text-2xl font-bold" style={{ color: t.text }}>{d.total_touches}</div>
        </Card>
        <Card>
          <div className="text-xs mb-1" style={{ color: t.textMute }}>Конверсия в успех</div>
          <div className="text-2xl font-bold" style={{ color: "#22c55e" }}>{d.conversion_pct}%</div>
          <div className="text-[10px] mt-0.5" style={{ color: t.textMute }}>по {d.analyzed_total} проанализир.</div>
        </Card>
        <Card>
          <div className="text-xs mb-1" style={{ color: t.textMute }}>Требуют внимания</div>
          <div className="text-2xl font-bold" style={{ color: "#eab308" }}>{d.attention.length}</div>
        </Card>
        <Card>
          <div className="text-xs mb-1" style={{ color: t.textMute }}>Средняя оценка звонков</div>
          {d.avg_operator_score !== null ? (
            <>
              <div className="text-2xl font-bold" style={{ color: "#3b82f6" }}>{d.avg_operator_score} / 10</div>
              <div className="text-[10px] mt-0.5" style={{ color: t.textMute }}>по {d.scored_calls_count} звонк{d.scored_calls_count === 1 ? "у" : "ам"}</div>
            </>
          ) : (
            <div className="text-xs mt-1" style={{ color: t.textMute }}>Нет оценённых звонков</div>
          )}
        </Card>
      </div>

      {/* Распределение по каналам */}
      <Card>
        <div className="text-sm font-bold mb-3" style={{ color: t.text }}>Касания по каналам</div>
        {d.by_channel.length === 0 ? (
          <div className="text-xs py-4 text-center" style={{ color: t.textMute }}>Пока нет данных за выбранный период</div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {d.by_channel.map(ch => {
              const meta = channelMeta(ch.channel);
              const pct = Math.round((ch.count / maxChannelCount) * 100);
              return (
                <div key={ch.channel} className="flex items-center gap-2.5">
                  <Icon name={meta.icon} size={14} style={{ color: meta.color, flexShrink: 0 }} />
                  <div className="text-xs w-20 flex-shrink-0" style={{ color: t.textSub }}>{meta.label}</div>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: t.surface2 }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.color }} />
                  </div>
                  <div className="text-xs font-semibold w-8 text-right flex-shrink-0" style={{ color: t.text }}>{ch.count}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Топ клиентов «требуют внимания» */}
      <Card>
        <div className="text-sm font-bold mb-3" style={{ color: t.text }}>Требуют внимания</div>
        {d.attention.length === 0 ? (
          <div className="text-xs py-4 text-center" style={{ color: t.textMute }}>
            Пока некому уделить особое внимание — все клиенты в порядке.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {d.attention.map(a => {
              const client = findClient(a.phone);
              return (
                <div key={a.id}
                  onClick={() => client && onSelectClient(client)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl transition ${client ? "cursor-pointer" : ""}`}
                  style={{ background: t.surface2 }}
                  onMouseEnter={e => { if (client) (e.currentTarget as HTMLDivElement).style.background = t.border; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = t.surface2; }}>
                  <div className="relative flex-shrink-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{ background: "#7c3aed22", color: "#a78bfa" }}>
                      {(a.name || "?").charAt(0).toUpperCase()}
                    </div>
                    {a.unread && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-2"
                        style={{ background: "#ef4444", borderColor: t.surface2 }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate" style={{ color: t.text }}>{a.name || a.phone || "Без имени"}</div>
                    {a.next_action && (
                      <div className="text-[11px] truncate" style={{ color: t.textMute }}>{a.next_action}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {a.interest && INTEREST_META[a.interest] && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                        style={{ background: INTEREST_META[a.interest].color + "22", color: INTEREST_META[a.interest].color }}>
                        {INTEREST_META[a.interest].label}
                      </span>
                    )}
                    {a.stage && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                        style={{ background: "#7c3aed22", color: "#a78bfa" }}>{a.stage}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}