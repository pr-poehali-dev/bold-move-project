import { useState } from "react";
import { useTheme } from "./themeContext";
import { STATUS_LABELS, STATUS_COLORS } from "./crmApi";
import { useSubstatuses } from "./substatusContext";
import DrumPicker, { DrumItem } from "./DrumPicker";
import Icon from "@/components/ui/icon";

const STATUS_ORDER = [
  "new",
  "call",
  "measure",
  "measured",
  "contract",
  "prepaid",
  "install_scheduled",
  "install_done",
  "extra_paid",
  "done",
  "cancelled",
];

const DRUM_ITEMS: DrumItem[] = STATUS_ORDER.map(s => ({
  value: s,
  label: STATUS_LABELS[s] ?? s,
  color: STATUS_COLORS[s] ?? "#8b5cf6",
}));

// ── Воронка для десктопа (оригинальный вид) ───────────────────────────────
// tabId — соответствие вкладке воронки, из которой берём кастомные подэтапы (substatus).
const FUNNEL_STAGES = [
  { statuses: ["new"],                                                                    label: "Заявка",   color: "#8b5cf6", icon: "Inbox",       tabId: "leads" },
  { statuses: ["call"],                                                                   label: "В работе", color: "#a78bfa", icon: "Zap",         tabId: "working" },
  { statuses: ["measure", "measured"],                                                    label: "Замер",    color: "#f59e0b", icon: "Ruler",       tabId: "measures" },
  { statuses: ["contract", "prepaid", "install_scheduled", "install_done", "extra_paid"], label: "Монтаж",  color: "#f97316", icon: "Wrench",      tabId: "installs" },
  { statuses: ["done"],                                                                   label: "Готово",   color: "#10b981", icon: "CheckCircle2", tabId: "done" },
  { statuses: ["cancelled"],                                                              label: "Отказ",    color: "#ef4444", icon: "XCircle",     tabId: "done" },
] as const;

const STAGE_DETAIL: Record<string, string[]> = {
  "Замер":    ["measure", "measured"],
  "Монтаж":   ["contract", "prepaid", "install_scheduled", "install_done", "extra_paid"],
};

function DesktopFunnel({ status, subStatus, onSave, onSaveSubStatus, allowedStatuses }: {
  status: string; subStatus: string | null;
  onSave: (s: string) => void; onSaveSubStatus: (v: string | null) => void;
  /** null — ограничений нет (видны и доступны все этапы, как раньше) */
  allowedStatuses: string[] | null;
}) {
  const t = useTheme();
  const allSubs = useSubstatuses();
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const currentStageIdx = FUNNEL_STAGES.findIndex(g => g.statuses.includes(status as never));
  const currentStage    = FUNNEL_STAGES[currentStageIdx];

  const isStatusAllowed = (s: string) => !allowedStatuses || allowedStatuses.includes(s);
  // Этап целиком скрываем, если сотруднику не разрешён НИ ОДИН его статус — иначе
  // право orders_edit открывало бы кликабельными вообще все этапы/подэтапы, даже
  // явно снятые в настройках доступа (allowed_statuses фильтровал только то, что
  // видно в списках заявок, а не сам селектор статуса в карточке).
  const mainStages = FUNNEL_STAGES
    .filter(g => g.label !== "Отказ")
    .filter(g => g.statuses.some(isStatusAllowed));

  // Кастомные подэтапы для конкретного этапа воронки (по tabId) — показываем только
  // если у этапа вообще есть хоть один разрешённый статус (сам этап не скрыт)
  const subsFor = (tabId: string) => allSubs.filter(s => s.parent_status === tabId);
  // Системные детали этапа (Замер/Монтаж), отфильтрованные по разрешённым статусам
  const detailStatusesFor = (label: string) => (STAGE_DETAIL[label] || []).filter(isStatusAllowed);
  // У этапа есть что разворачивать, если есть системные детали ИЛИ кастомные подэтапы
  const hasDetail = (g: typeof FUNNEL_STAGES[number]) =>
    detailStatusesFor(g.label).length > 0 || subsFor(g.tabId).length > 0;

  return (
    <div className="pt-2 pb-2 space-y-2">
      <div className="flex items-stretch gap-0.5">
        {mainStages.map((g, i, arr) => {
          const isActive = g.statuses.includes(status as never);
          const isPast   = currentStageIdx > i;
          // Первый статус этапа, реально доступный сотруднику (а не обязательно
          // g.statuses[0] — тот может быть запрещён при частичном разрешении этапа)
          const firstAllowed = g.statuses.find(isStatusAllowed) ?? g.statuses[0];
          return (
            <div key={g.label} className="flex items-center flex-1 min-w-0">
              <button
                onClick={() => {
                  if (hasDetail(g)) {
                    // Переводим на первый доступный статус этапа (если ещё не на нём) и разворачиваем подэтапы
                    if (!g.statuses.includes(status as never)) onSave(firstAllowed);
                    setExpandedStage(expandedStage === g.label ? null : g.label);
                  } else {
                    onSave(firstAllowed);
                    setExpandedStage(null);
                  }
                }}
                className="flex flex-col items-center gap-1 flex-1 min-w-0 py-2 px-0.5 rounded-xl transition"
                style={{
                  background: isActive ? g.color + "20" : isPast ? g.color + "10" : "transparent",
                  border: `1.5px solid ${isActive ? g.color + "60" : isPast ? g.color + "30" : t.border2}`,
                  minHeight: 56,
                }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: isActive ? g.color : isPast ? g.color + "40" : t.surface }}>
                  <Icon name={g.icon} size={11} style={{ color: isActive ? "#fff" : isPast ? g.color : t.textMute }} />
                </div>
                <span className="text-[9px] font-semibold text-center leading-tight w-full"
                  style={{ color: isActive ? g.color : isPast ? g.color + "cc" : t.textMute, wordBreak: "break-word" }}>
                  {g.label}
                </span>
              </button>
              {i < arr.length - 1 && (
                <div className="w-1.5 flex-shrink-0 h-px mx-0.5"
                  style={{ background: isPast ? currentStage?.color + "50" : t.border2 }} />
              )}
            </div>
          );
        })}

        {isStatusAllowed("cancelled") && (
          <>
            <div className="w-1.5 flex-shrink-0" />
            <button
              onClick={() => { onSave("cancelled"); setExpandedStage(null); }}
              className="flex flex-col items-center gap-1 py-2 px-2 rounded-xl transition flex-shrink-0"
              style={{
                background: status === "cancelled" ? "#ef444420" : "transparent",
                border: `1.5px solid ${status === "cancelled" ? "#ef444460" : t.border2}`,
                minHeight: 56,
              }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: status === "cancelled" ? "#ef4444" : t.surface }}>
                <Icon name="XCircle" size={11} style={{ color: status === "cancelled" ? "#fff" : t.textMute }} />
              </div>
              <span className="text-[9px] font-semibold" style={{ color: status === "cancelled" ? "#ef4444" : t.textMute }}>
                Отказ
              </span>
            </button>
          </>
        )}
      </div>

      {expandedStage && (() => {
        const stage = FUNNEL_STAGES.find(g => g.label === expandedStage);
        const detailStatuses = detailStatusesFor(expandedStage);
        const subs = stage ? subsFor(stage.tabId) : [];
        if (detailStatuses.length === 0 && subs.length === 0) return null;
        return (
          <div className="flex flex-wrap gap-1.5 pt-1 pl-1">
            {/* Кастомные подэтапы (те же, что на карточке): «Дата замера не назначена», «Новый в работе» и т.п.
                Идут первыми — «Дата замера не назначена» должна быть самым первым вариантом на этапе «Замер». */}
            {subs.map(s => {
              const active = subStatus === String(s.id);
              return (
                <button key={`sub-${s.id}`}
                  onClick={() => { onSaveSubStatus(active ? null : String(s.id)); }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition border"
                  style={active
                    ? { background: s.color, color: "#fff", borderColor: s.color }
                    : { borderColor: t.border2, background: t.surface, color: t.textSub }}>
                  {s.label}
                </button>
              );
            })}
            {/* Системные статусы этапа (Замер/Монтаж) */}
            {detailStatuses.map(s => (
              <button key={s} onClick={() => { onSave(s); setExpandedStage(null); }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition border"
                style={status === s
                  ? { background: STATUS_COLORS[s] + "25", color: STATUS_COLORS[s], borderColor: STATUS_COLORS[s] + "50" }
                  : { borderColor: t.border2, background: t.surface, color: "#fff" }}>
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ── Барабан для мобиле ────────────────────────────────────────────────────
function MobileDrum({ status, onSave, allowedStatuses }: {
  status: string; onSave: (s: string) => void;
  /** null — ограничений нет */
  allowedStatuses: string[] | null;
}) {
  const t = useTheme();
  const [pending, setPending] = useState<string | null>(null);

  // Недоступные сотруднику статусы убираем из барабана целиком — иначе он мог
  // прокрутить и выбрать статус, явно снятый в настройках доступа. Текущий статус
  // заявки оставляем видимым всегда (даже если он вдруг не в списке разрешённых) —
  // иначе барабан не сможет корректно показать, где заявка находится сейчас.
  const items = allowedStatuses
    ? DRUM_ITEMS.filter(i => i.value === status || allowedStatuses.includes(i.value))
    : DRUM_ITEMS;

  const currentItem = items.find(i => i.value === status) ?? items[0];
  const pendingItem = pending ? (items.find(i => i.value === pending) ?? currentItem) : null;
  const displayItem = pendingItem ?? currentItem;
  const hasChange   = pending !== null && pending !== status;

  const handleChange = (val: string) => {
    setPending(val !== status ? val : null);
  };

  const handleSave = () => {
    if (pending) { onSave(pending); setPending(null); }
  };

  return (
    <div className="py-1">
      {/* Статус-бейдж */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: t.textMute }}>
          Статус заявки
        </span>
        <div className="flex items-center gap-1.5">
          {hasChange && (
            <>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg line-through opacity-50"
                style={{ background: currentItem.color + "15", color: currentItem.color }}>
                {currentItem.label}
              </span>
              <Icon name="ArrowRight" size={10} style={{ color: t.textMute }} />
            </>
          )}
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg"
            style={{ background: displayItem.color + "20", color: displayItem.color }}>
            {displayItem.label}
          </span>
        </div>
      </div>

      {/* Барабан */}
      <div style={{
        borderRadius: 16, overflow: "hidden",
        background: t.surface2,
        border: `1px solid ${hasChange ? displayItem.color + "50" : t.border}`,
        transition: "border-color 0.2s",
        ["--drum-bg" as string]: t.surface2,
      }}>
        <DrumPicker
          items={items}
          value={pending ?? status}
          onChange={handleChange}
          itemHeight={40}
          visibleCount={3}
        />
      </div>

      {/* Кнопки подтверждения */}
      <div className={`overflow-hidden transition-all duration-200 ${hasChange ? "max-h-20 mt-2.5" : "max-h-0 mt-0"}`}>
        <div className="flex gap-2">
          <button onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold text-white transition active:scale-95"
            style={{ background: displayItem.color }}>
            <Icon name="Check" size={14} />
            Сохранить
          </button>
          <button onClick={() => setPending(null)}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition active:scale-95"
            style={{ background: t.surface2, color: t.textMute, border: `1px solid ${t.border}` }}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Экспортируемый компонент ──────────────────────────────────────────────
export function StatusSelector({ status, subStatus = null, onSave, onSaveSubStatus, readOnly = false, allowedStatuses = null }: {
  status: string; subStatus?: string | null;
  onSave: (s: string) => void; onSaveSubStatus?: (v: string | null) => void;
  readOnly?: boolean;
  /** Этапы, разрешённые сотруднику (null = ограничений нет — как было раньше) */
  allowedStatuses?: string[] | null;
}) {
  if (readOnly) {
    // Только просмотр — без возможности смены
    const color = STATUS_COLORS[status] ?? "#8b5cf6";
    return (
      <div className="flex items-center gap-2 py-2 px-1">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="text-sm font-semibold" style={{ color }}>
          {STATUS_LABELS[status] ?? status}
        </span>
        <span className="text-xs opacity-50 ml-1">(только просмотр)</span>
      </div>
    );
  }
  return (
    <>
      {/* Десктоп: воронка с кнопками */}
      <div className="hidden sm:block">
        <DesktopFunnel status={status} subStatus={subStatus} onSave={onSave}
          onSaveSubStatus={onSaveSubStatus ?? (() => {})} allowedStatuses={allowedStatuses} />
      </div>
      {/* Мобиле: барабан с подтверждением */}
      <div className="sm:hidden">
        <MobileDrum status={status} onSave={onSave} allowedStatuses={allowedStatuses} />
      </div>
    </>
  );
}