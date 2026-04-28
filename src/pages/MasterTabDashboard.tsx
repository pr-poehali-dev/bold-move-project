import Icon from "@/components/ui/icon";
import type { AdminStats, ExpiringUser } from "./masterAdminTypes";
import { fmtDate, daysLeft, ROLE_LABELS } from "./masterAdminTypes";
import func2url from "@/../backend/func2url.json";
import { useState } from "react";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

interface Props {
  stats: AdminStats | null;
  loading: boolean;
}

const TG_TEMPLATE = (u: ExpiringUser) =>
  `Привет${u.name ? `, ${u.name}` : ""}! 👋\n\nНапоминаем, что ваша подписка заканчивается ${fmtDate(u.subscription_end)} (осталось ${daysLeft(u.subscription_end)} дн.).\n\nБудете продлевать? Напишите нам — поможем оформить быстро! 🚀`;

export default function MasterTabDashboard({ stats, loading }: Props) {
  const [tgUser,    setTgUser]    = useState<ExpiringUser | null>(null);
  const [tgText,    setTgText]    = useState("");
  const [tgSending, setTgSending] = useState(false);
  const [tgDone,    setTgDone]    = useState<number | null>(null);

  const openTg = (u: ExpiringUser) => {
    setTgUser(u);
    setTgText(TG_TEMPLATE(u));
    setTgDone(null);
  };

  const sendTg = async () => {
    if (!tgUser) return;
    setTgSending(true);
    try {
      await fetch(`${AUTH_URL}?action=send-tg-notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: tgUser.id, message: tgText }),
      });
      setTgDone(tgUser.id);
      setTgUser(null);
    } finally {
      setTgSending(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!stats) return null;

  const statCards = [
    { label: "Пользователей", value: stats.total_users, icon: "Users",       color: "#10b981" },
    { label: "Ожидают",       value: stats.pending,      icon: "Clock",       color: "#f59e0b" },
    { label: "Подписок",      value: stats.active_subs,  icon: "CreditCard",  color: "#60a5fa" },
    { label: "Смет создано",  value: stats.total_estimates, icon: "FileText", color: "#a78bfa" },
    { label: "Новых за неделю", value: stats.new_week,   icon: "TrendingUp",  color: "#34d399" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Карточки статистики */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statCards.map(c => (
          <div key={c.label} className="rounded-2xl p-4"
            style={{ background: "#0e0e1c", border: `1px solid ${c.color}25` }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${c.color}20` }}>
                <Icon name={c.icon} size={14} style={{ color: c.color }} />
              </div>
              <span className="text-[11px] text-white/40">{c.label}</span>
            </div>
            <div className="text-2xl font-black" style={{ color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* По ролям */}
      <div className="rounded-2xl p-5" style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="text-xs font-bold text-white/40 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Icon name="PieChart" size={13} style={{ color: "#10b981" }} />
          Распределение по ролям
        </div>
        <div className="flex flex-wrap gap-3">
          {Object.entries(stats.by_role).map(([role, count]) => {
            const meta = ROLE_LABELS[role] || { label: role, color: "#94a3b8" };
            return (
              <div key={role} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: `${meta.color}12`, border: `1px solid ${meta.color}30` }}>
                <span className="text-xs font-bold" style={{ color: meta.color }}>{meta.label}</span>
                <span className="text-sm font-black text-white">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ⚠️ Заканчивается подписка */}
      {stats.expiring_soon.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1.5px solid rgba(245,158,11,0.4)" }}>
          <div className="px-5 py-3 flex items-center gap-2"
            style={{ background: "rgba(245,158,11,0.12)" }}>
            <Icon name="AlertTriangle" size={15} style={{ color: "#f59e0b" }} />
            <span className="text-sm font-bold" style={{ color: "#f59e0b" }}>
              Заканчивается подписка — {stats.expiring_soon.length} чел.
            </span>
          </div>
          <div className="divide-y" style={{ divideColor: "rgba(255,255,255,0.04)" }}>
            {stats.expiring_soon.map(u => {
              const days = daysLeft(u.subscription_end);
              const urgent = days <= 2;
              return (
                <div key={u.id} className="flex items-center gap-4 px-5 py-3.5"
                  style={{ background: "#0e0e1c" }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: urgent ? "#ef444420" : "#f59e0b20", color: urgent ? "#ef4444" : "#f59e0b" }}>
                    {(u.name || u.email)[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{u.name || "—"}</div>
                    <div className="text-xs text-white/35 truncate">{u.email}</div>
                    {u.phone && <div className="text-xs text-white/25">{u.phone}</div>}
                  </div>
                  <div className="text-right flex-shrink-0 mr-3">
                    <div className="text-xs text-white/40">до {fmtDate(u.subscription_end)}</div>
                    <div className="text-sm font-bold" style={{ color: urgent ? "#ef4444" : "#f59e0b" }}>
                      {days <= 0 ? "сегодня!" : `${days} дн.`}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {u.telegram && (
                      <a href={`https://t.me/${u.telegram.replace("@", "")}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                        style={{ background: "#229ed920", color: "#229ed9", border: "1px solid #229ed930" }}>
                        <Icon name="Send" size={12} /> TG
                      </a>
                    )}
                    <button onClick={() => openTg(u)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                      style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
                      <Icon name="MessageSquare" size={12} /> Написать
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {stats.expiring_soon.length === 0 && (
        <div className="rounded-2xl p-6 flex items-center gap-3"
          style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)" }}>
          <Icon name="CheckCircle2" size={18} style={{ color: "#10b981" }} />
          <span className="text-sm text-emerald-300/70">Подписки в порядке — нет заканчивающихся в ближайшие 7 дней</span>
        </div>
      )}

      {/* Модалка Telegram */}
      {tgUser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.80)" }} onClick={() => setTgUser(null)}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.1)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#229ed920" }}>
                  <Icon name="Send" size={15} style={{ color: "#229ed9" }} />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Напомнить о подписке</div>
                  <div className="text-xs text-white/30">{tgUser.name || tgUser.email}</div>
                </div>
              </div>
              <button onClick={() => setTgUser(null)} className="text-white/30 hover:text-white/60 transition">
                <Icon name="X" size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[11px] text-white/40 mb-1.5 block">Telegram: {tgUser.telegram || "не указан"}</label>
                <label className="text-[11px] text-white/40 mb-1.5 block">Телефон: {tgUser.phone || "не указан"}</label>
              </div>
              <div>
                <label className="text-[11px] text-white/40 mb-1.5 block font-medium">Сообщение</label>
                <textarea value={tgText} onChange={e => setTgText(e.target.value)} rows={6}
                  className="w-full rounded-xl px-4 py-3 text-sm resize-none focus:outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} />
              </div>
              <div className="flex gap-2">
                {tgUser.telegram && (
                  <a href={`https://t.me/${tgUser.telegram.replace("@","")}`} target="_blank" rel="noopener noreferrer"
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
                    style={{ background: "#229ed9" }}>
                    <Icon name="Send" size={14} /> Открыть в Telegram
                  </a>
                )}
                <button onClick={() => navigator.clipboard.writeText(tgText)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium transition"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <Icon name="Copy" size={14} />
                </button>
              </div>
              {!tgUser.telegram && (
                <p className="text-xs text-amber-400/70 flex items-center gap-1.5">
                  <Icon name="AlertCircle" size={12} /> Telegram не указан — скопируйте и отправьте вручную
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
