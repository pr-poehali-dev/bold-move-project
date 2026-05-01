import Icon from "@/components/ui/icon";
import { DEMO_STATUSES } from "./wlTypes";
import type { DemoPipelineCompany, DemoStatus } from "./wlTypes";

interface Props {
  c: DemoPipelineCompany;
  onMove: (status: DemoStatus) => void;
}

export function WLPipelineActionButtons({ c, onMove }: Props) {
  const btn = "flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold transition";

  // Доп. продажа доступна только после оплаты
  const canUpsell = c.status === "paid" || c.status === "upsell";

  // Основные статусы (без presented и upsell — они рендерятся отдельно)
  const mainStatuses = DEMO_STATUSES.filter(s => s.id !== "presented" && s.id !== "upsell");

  return (
    <div className="flex flex-col gap-2 pt-2.5 mt-2.5 border-t border-white/[0.06]"
      onClick={e => e.stopPropagation()}>

      {/* Основная строка статусов */}
      <div className="flex gap-1.5">
        {mainStatuses.map(s => {
          const active = c.status === s.id;
          return (
            <button key={s.id} onClick={() => !active && onMove(s.id)}
              disabled={active}
              className={btn}
              style={{
                background: active ? s.bg : "rgba(255,255,255,0.04)",
                color:      active ? s.color : "rgba(255,255,255,0.3)",
                border:     `1px solid ${active ? s.color + "50" : "transparent"}`,
                cursor:     active ? "default" : "pointer",
              }}>
              {active && <Icon name="Check" size={9} />}
              {s.label}
            </button>
          );
        })}
        {c.status === "presented" && (() => {
          const s = DEMO_STATUSES.find(st => st.id === "presented")!;
          return (
            <div className={btn} style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}50` }}>
              <Icon name="Check" size={9} /> {s.label}
            </div>
          );
        })()}
      </div>

      {/* Доп. продажа — только после оплаты */}
      {canUpsell && (() => {
        const s = DEMO_STATUSES.find(st => st.id === "upsell")!;
        const active = c.status === "upsell";
        return (
          <button onClick={() => !active && onMove("upsell")}
            disabled={active}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold transition"
            style={{
              background: active ? s.bg : "rgba(245,158,11,0.06)",
              color:      active ? s.color : "#f59e0b",
              border:     `1px solid ${active ? s.color + "50" : "rgba(245,158,11,0.25)"}`,
              cursor:     active ? "default" : "pointer",
            }}>
            <Icon name={active ? "Check" : "ShoppingBag"} size={10} />
            {active ? "Доп. продажа активна" : "Перевести в Доп. продажу"}
          </button>
        );
      })()}
    </div>
  );
}