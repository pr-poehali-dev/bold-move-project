import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useAuth, CLIENT_ROLES } from "@/context/AuthContext";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

const CRM_STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  new:               { label: "Новая заявка",      color: "#3b82f6", icon: "Sparkles" },
  call:              { label: "Связываемся",        color: "#8b5cf6", icon: "Phone" },
  measure:           { label: "Запись на замер",    color: "#f59e0b", icon: "CalendarDays" },
  measured:          { label: "Замер проведён",     color: "#a78bfa", icon: "Ruler" },
  contract:          { label: "Договор подписан",   color: "#06b6d4", icon: "FileCheck" },
  prepaid:           { label: "Предоплата внесена", color: "#0ea5e9", icon: "CreditCard" },
  install_scheduled: { label: "Монтаж назначен",   color: "#f97316", icon: "Hammer" },
  install_done:      { label: "Монтаж выполнен",   color: "#fb923c", icon: "CheckSquare" },
  extra_paid:        { label: "Доплата получена",  color: "#84cc16", icon: "Banknote" },
  done:              { label: "Завершено",          color: "#10b981", icon: "CheckCircle2" },
  cancelled:         { label: "Отменено",           color: "#ef4444", icon: "XCircle" },
};

const STATUS_ORDER = [
  "new", "call", "measure", "measured",
  "contract", "prepaid", "install_scheduled", "install_done", "extra_paid", "done",
];

// Группы фильтров для таба
const FILTER_TABS = [
  { id: "all",      label: "Все" },
  { id: "active",   label: "В работе" },
  { id: "measure",  label: "Замер" },
  { id: "contract", label: "Договор" },
  { id: "install",  label: "Монтаж" },
  { id: "done",     label: "Завершено" },
  { id: "cancelled",label: "Отменено" },
];

function matchFilter(filter: string, status: string | null): boolean {
  if (filter === "all") return true;
  if (filter === "active") return ["new", "call"].includes(status ?? "");
  if (filter === "measure") return ["measure", "measured"].includes(status ?? "");
  if (filter === "contract") return ["contract", "prepaid"].includes(status ?? "");
  if (filter === "install") return ["install_scheduled", "install_done", "extra_paid"].includes(status ?? "");
  if (filter === "done") return status === "done";
  if (filter === "cancelled") return status === "cancelled";
  return true;
}

interface Block {
  title: string;
  numbered: boolean;
  items: { name: string; value: string }[];
}

interface Estimate {
  id: number;
  title: string;
  total_econom: number | null;
  total_standard: number | null;
  total_premium: number | null;
  created_at: string;
  crm_status: string | null;
  chat_id: number | null;
  blocks: Block[];
  totals: string[];
  final_phrase: string;
}

// ── Степпер прогресса ────────────────────────────────────────────────────────
function StatusStepper({ status }: { status: string | null }) {
  if (!status || status === "cancelled") return null;
  const steps = ["new", "measure", "contract", "install_scheduled", "done"];
  const labels = ["Заявка", "Замер", "Договор", "Монтаж", "Готово"];
  const curIdx = Math.max(0, STATUS_ORDER.indexOf(status));
  const active = (s: string) => STATUS_ORDER.indexOf(s) <= curIdx;

  return (
    <div className="flex items-center mt-4">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center flex-1">
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
              style={{
                background: active(s) ? "#f97316" : "rgba(255,255,255,0.08)",
                color: active(s) ? "#fff" : "rgba(255,255,255,0.25)",
                boxShadow: active(s) ? "0 0 8px rgba(249,115,22,0.4)" : "none",
              }}>
              {active(s) ? <Icon name="Check" size={11} /> : i + 1}
            </div>
            <div className="text-[9px] mt-1 text-center leading-tight whitespace-nowrap"
              style={{ color: active(s) ? "rgba(249,115,22,0.9)" : "rgba(255,255,255,0.2)" }}>
              {labels[i]}
            </div>
          </div>
          {i < steps.length - 1 && (
            <div className="flex-1 h-[2px] mx-1.5 mb-3 transition-all"
              style={{ background: active(steps[i + 1]) ? "#f97316" : "rgba(255,255,255,0.08)" }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Таблица сметы ────────────────────────────────────────────────────────────
function EstimateTable({ blocks, totals, finalPhrase }: { blocks: Block[]; totals: string[]; finalPhrase: string }) {
  if (!blocks || blocks.length === 0) return (
    <div className="text-xs text-white/25 text-center py-4">Детали сметы недоступны</div>
  );

  let numCounter = 0;
  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-white/[0.08]">
      <table className="w-full text-xs">
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.05)" }}>
            <th className="text-left px-3 py-2 text-white/30 font-semibold text-[10px] uppercase tracking-wider">Позиция</th>
            <th className="text-right px-3 py-2 text-white/30 font-semibold text-[10px] uppercase tracking-wider w-[130px]">Стоимость</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((block, bi) => {
            if (block.numbered) numCounter++;
            const label = block.numbered ? `${numCounter}. ${block.title}` : block.title;
            return (
              <>
                <tr key={`h-${bi}`} style={{ background: "rgba(255,255,255,0.02)" }}>
                  <td colSpan={2} className="px-3 pt-2.5 pb-1.5 font-bold text-orange-400 text-[11px]">{label}</td>
                </tr>
                {block.items.map((item, ii) => (
                  <tr key={`r-${bi}-${ii}`} className={ii > 0 ? "border-t border-white/[0.04]" : ""}>
                    <td className="px-3 py-1.5 text-white/65 text-[11px] leading-snug">{item.name}</td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap text-orange-400 font-semibold text-[11px]">
                      {item.value ? item.value.split("=").pop()?.trim() : ""}
                    </td>
                  </tr>
                ))}
              </>
            );
          })}
        </tbody>
      </table>

      {totals.length > 0 && (
        <div className="border-t border-orange-500/20 px-3 py-2.5" style={{ background: "rgba(249,115,22,0.06)" }}>
          {totals.map((t, i) => {
            const isHighlight = /standard/i.test(t);
            const isHeader = /итогов|итого\s*стоим/i.test(t) && !t.includes("Econom") && !t.includes("Standard") && !t.includes("Premium");
            if (isHeader) return (
              <div key={i} className="text-[10px] text-white/30 text-right mb-0.5">{t.replace(/:$/, "")}</div>
            );
            return (
              <div key={i} className={`flex justify-end text-[11px] ${isHighlight ? "text-orange-400 font-black text-sm" : "text-white/60"}`}>
                <span className="mr-3">{t.split(":")[0]}:</span>
                <span className="font-bold">{t.split(":").slice(1).join(":").trim()}</span>
              </div>
            );
          })}
        </div>
      )}

      {finalPhrase && (
        <div className="px-3 py-2 text-[10px] text-white/30 italic border-t border-white/[0.04]">{finalPhrase}</div>
      )}
    </div>
  );
}

// ── Карточка заявки ──────────────────────────────────────────────────────────
function EstimateCard({ e }: { e: Estimate }) {
  const [expanded, setExpanded] = useState(false);
  const st = e.crm_status ? (CRM_STATUS_LABELS[e.crm_status] ?? null) : null;

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{ background: "#0e0e1c", border: `1px solid ${st ? st.color + "40" : "rgba(255,255,255,0.07)"}` }}>

      {/* Цветная полоска */}
      <div className="h-1" style={{ background: st ? st.color : "#3b82f6" }} />

      <div className="p-5">
        {/* Шапка */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-sm font-bold text-white">{e.title}</div>
            <div className="text-xs text-white/30 mt-0.5">
              {new Date(e.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
          {st && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold flex-shrink-0"
              style={{ background: st.color + "20", color: st.color }}>
              <Icon name={st.icon} size={12} />
              {st.label}
            </div>
          )}
        </div>

        {/* Цены */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Econom",   val: e.total_econom },
            { label: "Standard", val: e.total_standard },
            { label: "Premium",  val: e.total_premium },
          ].map(p => p.val ? (
            <div key={p.label} className="rounded-xl px-3 py-2.5 text-center"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-[10px] text-white/30 mb-0.5">{p.label}</div>
              <div className="text-sm font-bold text-orange-400">
                {Math.round(p.val).toLocaleString("ru-RU")} ₽
              </div>
            </div>
          ) : null)}
        </div>

        {/* Степпер */}
        <StatusStepper status={e.crm_status} />

        {e.crm_status === "cancelled" && (
          <div className="mt-3 text-xs text-red-400/70 text-center">Заявка отменена</div>
        )}

        {/* Кнопка раскрыть смету */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-4 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition"
          style={{
            background: expanded ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.04)",
            border: expanded ? "1px solid rgba(249,115,22,0.3)" : "1px solid rgba(255,255,255,0.06)",
            color: expanded ? "#f97316" : "rgba(255,255,255,0.4)",
          }}>
          <Icon name={expanded ? "ChevronUp" : "ChevronDown"} size={13} />
          {expanded ? "Скрыть смету" : "Показать смету"}
        </button>

        {/* Разворачиваемая смета */}
        {expanded && (
          <EstimateTable blocks={e.blocks} totals={e.totals} finalPhrase={e.final_phrase} />
        )}
      </div>
    </div>
  );
}

// ── Главная страница ─────────────────────────────────────────────────────────
export default function MyOrders() {
  const { user, token, logout } = useAuth();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState("all");

  useEffect(() => {
    if (!token) return;
    fetch(`${AUTH_URL}?action=my-estimates`, {
      headers: { "X-Authorization": `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setEstimates(d.estimates || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  if (!token && !loading) { window.location.href = "/"; return null; }
  if (user && !CLIENT_ROLES.includes(user.role)) { window.location.href = "/admin-yura"; return null; }

  const roleLabel = user?.role === "designer" ? "Дизайнер" : user?.role === "foreman" ? "Прораб" : "Клиент";
  const filtered  = estimates.filter(e => matchFilter(filter, e.crm_status));

  // Счётчики по группам
  const counts: Record<string, number> = {};
  FILTER_TABS.forEach(tab => {
    counts[tab.id] = estimates.filter(e => matchFilter(tab.id, e.crm_status)).length;
  });

  return (
    <div className="min-h-screen" style={{ background: "#07070f" }}>

      {/* Шапка */}
      <div className="px-4 sm:px-6 py-4 flex items-center justify-between border-b border-white/[0.07]"
        style={{ background: "#0b0b15" }}>
        <a href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-500/15 flex items-center justify-center">
            <Icon name="Zap" size={14} style={{ color: "#f97316" }} />
          </div>
          <span className="font-black text-sm text-white">MOS<span className="text-orange-400">POTOLKI</span></span>
        </a>
        <div className="flex items-center gap-3">
          {user?.discount > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
              style={{ background: "#a78bfa20", color: "#a78bfa", border: "1px solid #a78bfa30" }}>
              <Icon name="Percent" size={12} />
              Скидка {user.discount}%
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)" }}>
            <div className="w-5 h-5 rounded-full bg-orange-500/30 flex items-center justify-center text-[10px] font-bold text-orange-300">
              {(user?.name || user?.email || "?")[0]?.toUpperCase()}
            </div>
            <span className="text-xs font-semibold text-orange-300">{user?.name || user?.email}</span>
            <span className="text-[10px] text-orange-400/50">{roleLabel}</span>
          </div>
          <button onClick={() => logout().then(() => { window.location.href = "/"; })}
            className="text-white/30 hover:text-white/60 transition">
            <Icon name="LogOut" size={14} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Заголовок */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-black text-white mb-1">Мои заявки</h1>
            <p className="text-sm text-white/35">Следите за статусом ваших заказов</p>
          </div>
          <a href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition"
            style={{ background: "rgba(249,115,22,0.12)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)" }}>
            <Icon name="Plus" size={13} />
            Новая смета
          </a>
        </div>

        {/* Фильтры по статусам */}
        {estimates.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-5">
            {FILTER_TABS.filter(t => t.id === "all" || counts[t.id] > 0).map(tab => (
              <button key={tab.id} onClick={() => setFilter(tab.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition"
                style={filter === tab.id ? {
                  background: "#f97316", color: "#fff",
                } : {
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.45)",
                }}>
                {tab.label}
                {tab.id !== "all" && (
                  <span className="text-[10px] px-1 rounded font-bold"
                    style={{ background: filter === tab.id ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)" }}>
                    {counts[tab.id]}
                  </span>
                )}
                {tab.id === "all" && (
                  <span className="text-[10px] px-1 rounded font-bold"
                    style={{ background: filter === tab.id ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)" }}>
                    {estimates.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Контент */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : estimates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center">
              <Icon name="FileSpreadsheet" size={28} style={{ color: "#f97316" }} />
            </div>
            <div>
              <div className="text-white font-bold text-base mb-1">Заявок пока нет</div>
              <div className="text-white/35 text-sm">Рассчитайте смету в нашем боте — она появится здесь</div>
            </div>
            <a href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: "#f97316" }}>
              <Icon name="MessageCircle" size={15} />
              Рассчитать смету
            </a>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Icon name="Filter" size={32} style={{ color: "rgba(255,255,255,0.15)" }} />
            <div className="text-white/30 text-sm">Нет заявок с таким статусом</div>
            <button onClick={() => setFilter("all")} className="text-xs text-orange-400 hover:text-orange-300 transition">
              Показать все
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(e => <EstimateCard key={e.id} e={e} />)}
          </div>
        )}
      </div>
    </div>
  );
}
