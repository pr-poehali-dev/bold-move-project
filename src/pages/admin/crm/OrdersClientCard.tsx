import { useState, useRef } from "react";
import { Client, STATUS_LABELS, STATUS_COLORS, getClientOrders, stageDuration } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { NEXT_STATUS, NEXT_LABEL, ORDERS_TABS, SERVICE_NEXT_STATUS, SERVICE_NEXT_LABEL } from "./ordersTypes";
import { useSubstatuses } from "./substatusContext";
import { useOrderSourcesCtx, sourceDisplay } from "./orderSourcesContext";
import { SNAP_WIDTH, InstallProgress } from "./ordersClientRowShared";
import { useSwipeGesture } from "./useSwipeGesture";
import { useOrderMetrics } from "./useOrderMetrics";
import { SubstatusPicker } from "./SubstatusPicker";
import { fmtMoscowDateTime } from "./timeMoscow";

function Metric({ label, value, color, icon }: { label: string; value: string; color?: string; icon?: string }) {
  const t = useTheme();
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-wider font-medium" style={{ color: t.textMute }}>{label}</span>
      <span className="text-xs font-bold flex items-center gap-1" style={{ color: color || t.text }}>
        {icon && <Icon name={icon} size={10} style={{ color }} />}
        {value}
      </span>
    </div>
  );
}

export function OrdersClientCard({ c, allClients, onClick, onNextStep, onSaveSubStatus, onSaveVerified, onSaveConfirmed, onSwipeBuilder, onSwipeAgent }: {
  c: Client;
  allClients?: Client[];
  onClick: () => void;
  onNextStep: (id: number, next: string) => void;
  onSaveSubStatus?: (id: number, subStatusId: number) => void;
  onSaveVerified?: (id: number, verified: boolean) => void;
  onSaveConfirmed?: (id: number, confirmed: boolean) => void;
  onSwipeBuilder?: (client: Client) => void;
  onSwipeAgent?: (client: Client) => void;
}) {
  const t = useTheme();
  const orderSources = useOrderSourcesCtx();
  // Бейдж источника скрываем ТОЛЬКО когда есть кликабельная ссылка на диалог Avito
  // (тогда источник и так виден по оранжевой кнопке «Avito», дублировать не нужно).
  // Если источник = Авито, но ссылки нет (например, заявка заведена вручную и отмечена
  // как «Авито» для статистики) — бейдж обязательно показываем, иначе источник
  // визуально теряется и его не видно в отчётах.
  const src = sourceDisplay(c.source, orderSources);
  const isAvitoSrc = (c.source || "").trim().toLowerCase() === "авито" || (c.source || "").trim().toLowerCase() === "avito";
  const showSrcBadge = src && !(isAvitoSrc && c.avito_chat_url);
  const allSubs = useSubstatuses();
  const [stepping, setStepping]             = useState(false);
  const localSubStatus = c.sub_status ?? null;

  const cardRef = useRef<HTMLDivElement>(null);
  const { offset, dragging, swipeHint } = useSwipeGesture({ elRef: cardRef, client: c, onSwipeBuilder, onSwipeAgent });

  const clientWithSub = { ...c, sub_status: localSubStatus };
  // Сервисные заявки (доделки/переделки) не привязаны к общим табам воронки —
  // у них своя мини-воронка из 3 этапов (см. SERVICE_STATUSES), подэтапы «Монтажей» им не подходят.
  const tab         = !c.is_service ? ORDERS_TABS.find(tb => tb.statuses.includes(c.status)) : undefined;
  // Активный подэтап (напр. «Новый в работе») — показываем его в углу вместо общего статуса
  const activeSub   = tab ? allSubs.find(s => s.parent_status === tab.id && String(s.id) === localSubStatus) : undefined;
  // Все варианты подстатуса для текущего этапа — для выпадающего списка смены
  const subsForTab  = tab ? allSubs.filter(s => s.parent_status === tab.id) : [];
  const isInstall   = tab?.id === "installs";
  const isCancelled = c.status === "cancelled";
  const isDone      = c.status === "done";
  const nextStatus  = c.is_service ? SERVICE_NEXT_STATUS[c.status] : NEXT_STATUS[c.status];
  const nextLabel   = c.is_service ? SERVICE_NEXT_LABEL[c.status] : NEXT_LABEL[c.status];

  const { contractSum, income, debt, costs, profit } = useOrderMetrics(c);
  const ordersCount = allClients ? getClientOrders(c, allClients).length : 1;

  const handleNext = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!nextStatus || stepping) return;
    setStepping(true);
    await onNextStep(c.id, nextStatus);
    setStepping(false);
  };

  return (
    <div className="relative rounded-2xl overflow-hidden h-full flex flex-col"
      style={{ background: t.surface, border: `1px solid ${t.border}` }}>

      {/* Фоны свайпа — только мобайл */}
      <div className="absolute inset-y-0 left-0 flex flex-col items-center justify-center gap-1 pointer-events-none sm:hidden"
        style={{
          width: SNAP_WIDTH, zIndex: 0, transition: "background 0.2s",
          background: swipeHint === "agent" ? "linear-gradient(135deg,#059669,#10b981)" : "linear-gradient(135deg,#065f46,#059669)",
        }}>
        <Icon name="Bot" size={20} style={{ color: "#fff" }} />
        <span className="text-[10px] font-bold uppercase tracking-wide text-white">Агент</span>
      </div>
      <div className="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-1 pointer-events-none sm:hidden"
        style={{
          width: SNAP_WIDTH, zIndex: 0, transition: "background 0.2s",
          background: swipeHint === "builder" ? "linear-gradient(135deg,#1d4ed8,#3b82f6)" : "linear-gradient(135deg,#1e3a6e,#1d4ed8)",
        }}>
        <Icon name="Layers" size={20} style={{ color: "#fff" }} />
        <span className="text-[10px] font-bold uppercase tracking-wide text-white">Построитель</span>
      </div>

      {/* Карточка */}
      <div ref={cardRef} className="flex flex-col flex-1"
        style={{
          position: "relative", zIndex: 1, background: t.surface,
          willChange: "transform", userSelect: "none",
          transform: `translateX(${offset}px)`,
          transition: dragging ? "none" : "transform 0.3s cubic-bezier(0.25,1,0.5,1)",
        }}>

        {/* Основной контент */}
        <div className="p-3 sm:p-4 cursor-pointer hover:brightness-[1.03] transition flex-1" onClick={onClick}>
          <div className="flex items-start mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold truncate flex-1 min-w-0" style={{ color: t.text }}>
                  {localStorage.getItem(`order_title_${c.id}`) || `Заявка №${c.id}`}
                </span>
                {/* Ответственный — компактно, иконкой с подсказкой при наведении,
                    чтобы не занимать отдельную строку в карточке */}
                <span className="flex-shrink-0 flex items-center justify-center w-4 h-4 rounded-full"
                  title={c.assigned_name ? `Ответственный: ${c.assigned_name}` : "Ответственный не назначен"}
                  style={{ background: c.assigned_name ? "#34d39922" : t.surface2 }}>
                  <Icon name={c.assigned_name ? "UserCheck" : "UserPlus"} size={10}
                    style={{ color: c.assigned_name ? "#34d399" : t.textMute }} />
                </span>
                {isInstall
                  ? <InstallProgress client={clientWithSub} />
                  : (
                    <SubstatusPicker
                      dense
                      active={activeSub}
                      options={subsForTab}
                      fallbackLabel={STATUS_LABELS[c.status] || c.status}
                      fallbackColor={STATUS_COLORS[c.status]}
                      onSelect={subId => onSaveSubStatus?.(c.id, subId)}
                    />
                  )
                }
              </div>
              {/* Строка времени + источник — ОДНИМ рядом под заголовком (время слева,
                  источник справа), а не в общем flex-wrap ряду с остальными бейджами,
                  чтобы на узких карточках (5 колонок в гриде) заголовок не обрезался
                  и источник был явно виден рядом с таймером. */}
              {(() => {
                // Единый "якорь" текущего времени для всех трёх счётчиков — иначе на
                // границе минуты значения расходятся (52/53/53) хотя from одинаковый.
                const now = Date.now();
                // Последнее действие — любое касание заявки (правка карточки, звонок,
                // сообщение), приходит с бэкенда уже готовым (GREATEST по нескольким источникам).
                const lastAction = stageDuration(c.last_activity_at, now);
                const onStage = !isDone && !isCancelled ? stageDuration(c.status_changed_at, now) : "";
                const age = stageDuration(c.created_at, now);
                const hasTime = lastAction || onStage || age;
                const hasSrc = showSrcBadge || c.avito_chat_url;
                if (!hasTime && !hasSrc) return null;
                return (
                  <div className="flex items-center justify-between gap-1 mt-1">
                    {hasTime ? (
                      <span className="inline-flex items-center gap-1 text-[10px] rounded-md font-semibold leading-none flex-shrink-0"
                        style={{ background: t.surface2, border: `1px solid ${t.border}`, height: 20, padding: "0 7px", boxSizing: "border-box" }}
                        title={`Последнее действие: ${lastAction || "—"} · На этапе: ${onStage || "—"} · Возраст заявки: ${age || "—"}`}>
                        <Icon name="Clock" size={10} style={{ color: t.accentLight }} />
                        {lastAction && <span style={{ color: t.text }}>{lastAction}</span>}
                        {lastAction && (onStage || age) && <span style={{ color: t.textMute }}>/</span>}
                        {onStage && <span style={{ color: t.textSub }}>{onStage}</span>}
                        {onStage && age && <span style={{ color: t.textMute }}>/</span>}
                        {age && <span style={{ color: t.textMute }}>{age}</span>}
                      </span>
                    ) : <span />}
                    {c.avito_chat_url ? (
                      <button
                        onClick={e => { e.stopPropagation(); window.open(c.avito_chat_url!, "_blank"); }}
                        title="Открыть диалог в Avito"
                        className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md font-medium transition hover:opacity-80 flex-shrink-0"
                        style={{ background: "#f9731620", color: "#f97316" }}>
                        <Icon name="ExternalLink" size={9} /> Avito
                      </button>
                    ) : showSrcBadge ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0"
                        style={{ background: src!.color + "20", color: src!.color }}>
                        {src!.label}
                      </span>
                    ) : null}
                  </div>
                );
              })()}
              <div className="flex items-center gap-1 flex-wrap mt-1">
                {ordersCount > 1 && (
                  <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md font-bold"
                    style={{ background: "#7c3aed22", color: "#a78bfa" }}
                    title={`Всего заявок у клиента: ${ordersCount}`}>
                    <Icon name="Layers" size={9} /> {ordersCount}
                  </span>
                )}
                {c.is_demo && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wide"
                    style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b44" }}>
                    ДЕМО
                  </span>
                )}
                {c.is_service && (
                  <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md font-bold"
                    title="Сервисная заявка — доделка/переделка, не новый монтаж"
                    style={{ background: "#14b8a622", color: "#14b8a6", border: "1px solid #14b8a644" }}>
                    <Icon name="Hammer" size={9} /> Сервис
                  </span>
                )}
                {c.has_missed_call && (
                  <span
                    title="Есть пропущенный звонок, на который ещё не перезвонили"
                    className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md font-semibold"
                    style={{ background: "#ef444420", color: "#ef4444" }}>
                    <Icon name="PhoneMissed" size={9} /> Пропущен
                  </span>
                )}
              </div>
              <div className="space-y-1 mt-1.5">
                {c.client_name && (
                  <div className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg" style={{ background: t.surface2 }}>
                    <Icon name="User" size={10} style={{ color: "#8b5cf6", flexShrink: 0 }} />
                    <span className="truncate" style={{ color: t.textSub }}>{c.client_name}</span>
                  </div>
                )}
                {c.phone && (
                  <div className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg" style={{ background: t.surface2 }}>
                    <Icon name="Phone" size={10} style={{ color: "#10b981", flexShrink: 0 }} />
                    <span className="truncate" style={{ color: t.textSub }}>{c.phone}</span>
                  </div>
                )}
                {(c.address || c.area) && (
                  <div className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg" style={{ background: t.surface2 }}>
                    <Icon name="MapPin" size={10} style={{ color: "#f59e0b", flexShrink: 0 }} />
                    <span className="truncate flex-1" style={{ color: t.textSub }}>{c.address || "Адрес не указан"}</span>
                    {c.area && <span className="flex-shrink-0 text-[10px] font-medium" style={{ color: t.textMute }}>{c.area} м²</span>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {(c.measure_date || c.install_date || (c.next_call_date && !isDone && !isCancelled)) && (
            <div className="flex gap-2 mb-3 flex-wrap">
              {c.measure_date && (
                <div className="flex items-center gap-1 text-[10px] px-1.5 py-1 rounded-md"
                  style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
                  <Icon name="Ruler" size={9} />
                  <div>
                    <div className="font-medium">{new Date(c.measure_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</div>
                    <div className="opacity-60">Замер</div>
                  </div>
                </div>
              )}
              {c.install_date && (
                <div className="flex items-center gap-1 text-[10px] px-1.5 py-1 rounded-md"
                  style={{ background: "rgba(249,115,22,0.1)", color: "#f97316" }}>
                  <Icon name="Wrench" size={9} />
                  <div>
                    <div className="font-medium">{new Date(c.install_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</div>
                    <div className="opacity-60">Монтаж</div>
                  </div>
                </div>
              )}
              {c.next_call_date && !isDone && !isCancelled && (() => {
                const isOverdue = new Date(c.next_call_date).getTime() < Date.now();
                const callColor = isOverdue ? "#ef4444" : "#60a5fa";
                return (
                  <div className="flex items-center gap-1 text-[10px] px-1.5 py-1 rounded-md"
                    title={isOverdue ? "Звонок просрочен!" : "Дата и время следующего звонка клиенту"}
                    style={{ background: isOverdue ? "rgba(239,68,68,0.15)" : "rgba(59,130,246,0.1)", color: callColor }}>
                    <Icon name={isOverdue ? "PhoneMissed" : "PhoneCall"} size={9} />
                    <div>
                      <div className="font-medium">{fmtMoscowDateTime(c.next_call_date)}</div>
                      <div className="opacity-60">{isOverdue ? "Просрочен" : "Звонок"}</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {income > 0 && (
            <div className="grid grid-cols-3 gap-2 pt-2.5 mt-1" style={{ borderTop: `1px solid ${t.border2}` }}>
              <Metric label="Доходы"  value={`${income.toLocaleString("ru-RU")} ₽`} color="#10b981" icon="TrendingUp" />
              <Metric label="Затраты" value={costs > 0 ? `${costs.toLocaleString("ru-RU")} ₽` : "—"} color={costs > 0 ? "#f97316" : undefined} icon="TrendingDown" />
              <Metric label={profit >= 0 ? "Прибыль" : "Убыток"} value={profit !== 0 ? `${Math.abs(profit).toLocaleString("ru-RU")} ₽` : "—"} color={profit > 0 ? "#a78bfa" : profit < 0 ? "#ef4444" : undefined} icon={profit >= 0 ? "TrendingUp" : "TrendingDown"} />
            </div>
          )}

          {contractSum > 0 && debt > 0 && !isDone && !isCancelled && (
            <div className="flex items-center gap-1.5 mt-2 text-[10px] px-2 py-1 rounded-md"
              style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
              <Icon name="AlertCircle" size={10} />
              <span>Долг: <b>{debt.toLocaleString("ru-RU")} ₽</b></span>
            </div>
          )}

          {isCancelled && c.cancel_reason && (
            <div className="mt-2 text-[10px] px-2.5 py-1.5 rounded-lg"
              style={{ background: "rgba(239,68,68,0.07)", color: "#ef4444" }}>
              Причина отказа: {c.cancel_reason}
            </div>
          )}

          {/* Финальная сверка: два независимых переключателя — «Проверено» (качество
              и оплата сверены) и «Подтверждено» (например, клиент подтвердил закрытие). */}
          {isDone && (
            <div className="grid grid-cols-2 gap-1.5 mt-2.5 pt-2.5" style={{ borderTop: `1px solid ${t.border2}` }}>
              <button
                onClick={e => { e.stopPropagation(); onSaveVerified?.(c.id, !c.is_verified); }}
                title={c.is_verified ? "Проверено — нажмите, чтобы снять отметку" : "Отметить как проверенное"}
                className="flex items-center justify-center gap-1.5 text-[10px] px-2 py-1.5 rounded-lg font-bold transition"
                style={c.is_verified
                  ? { background: "#10b98122", color: "#10b981", border: "1px solid #10b98155" }
                  : { background: "transparent", color: t.textMute, border: `1px solid ${t.border}` }}>
                <Icon name={c.is_verified ? "CheckCheck" : "Circle"} size={10} />
                Проверено
              </button>
              <button
                onClick={e => { e.stopPropagation(); onSaveConfirmed?.(c.id, !c.is_confirmed); }}
                title={c.is_confirmed ? "Подтверждено — нажмите, чтобы снять отметку" : "Отметить как подтверждённое"}
                className="flex items-center justify-center gap-1.5 text-[10px] px-2 py-1.5 rounded-lg font-bold transition"
                style={c.is_confirmed
                  ? { background: "#06b6d422", color: "#06b6d4", border: "1px solid #06b6d455" }
                  : { background: "transparent", color: t.textMute, border: `1px solid ${t.border}` }}>
                <Icon name={c.is_confirmed ? "ShieldCheck" : "Circle"} size={10} />
                Подтверждено
              </button>
            </div>
          )}
        </div>

        {/* Следующий шаг */}
        {nextStatus && !isDone && !isCancelled && (
          <button onClick={handleNext} disabled={stepping}
            className="w-full flex items-center justify-between px-4 py-3 sm:py-2.5 transition disabled:opacity-60 active:opacity-70"
            style={{ borderTop: `1px solid ${t.border2}`, background: STATUS_COLORS[nextStatus] + "08" }}>
            {stepping ? (
              <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: STATUS_COLORS[nextStatus] }}>
                <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" /> Обновление...
              </span>
            ) : (
              <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: STATUS_COLORS[nextStatus] }}>
                <Icon name="ArrowRight" size={11} />{nextLabel}
              </span>
            )}
            <Icon name="ChevronRight" size={13} style={{ color: STATUS_COLORS[nextStatus] + "80" }} />
          </button>
        )}

        {isDone && (
          <div className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-emerald-500"
            style={{ borderTop: `1px solid ${t.border2}`, background: "rgba(16,185,129,0.06)" }}>
            <span className="flex items-center gap-1.5"><Icon name="CheckCircle2" size={12} /> Заказ завершён</span>
            {contractSum > 0 && <span className="text-emerald-400">{contractSum.toLocaleString("ru-RU")} ₽</span>}
          </div>
        )}
      </div>
    </div>
  );
}