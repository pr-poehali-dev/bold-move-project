import Icon from "@/components/ui/icon";

interface DrawerCostsAutoSectionProps {
  hasRules: boolean;
  contractSum: number;
  autoMode: boolean;
  autoFilled: boolean;
  onApplyAuto: () => void;
  onOpenRules: () => void;
  onDismissAutoFilled: () => void;
}

export function DrawerCostsAutoSection({
  hasRules,
  contractSum,
  autoMode,
  autoFilled,
  onApplyAuto,
  onOpenRules,
  onDismissAutoFilled,
}: DrawerCostsAutoSectionProps) {
  return (
    <>
      <div className="flex items-center gap-1.5 pt-2 pb-1 w-full">
        <button
          onClick={onApplyAuto}
          disabled={!hasRules || !contractSum}
          title={!contractSum ? "Сначала укажите сумму договора" : !hasRules ? "Настройте правило (шестерёнка)" : "Авто-расчёт по правилу"}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition disabled:opacity-30"
          style={{ background: "#ef444415", color: "#ef4444", border: "1px solid #ef444430" }}>
          <Icon name="Zap" size={11} />
          Авто
        </button>
        <button
          onClick={onOpenRules}
          title="Настроить правила авто-расчёта"
          className="p-1 rounded-lg transition hover:bg-white/5"
          style={{ color: "#6b7280" }}>
          <Icon name="Settings2" size={13} />
        </button>
        {!hasRules && (
          <span className="text-[10px]" style={{ color: "#6b7280" }}>Настройте правило →</span>
        )}
        {hasRules && autoMode && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full ml-auto"
            style={{ background: "#ef444418", border: "1px solid #ef444435" }}
            title="Авто-режим включён — затраты пересчитываются при изменении суммы">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#ef4444" }} />
            <span className="text-[10px] font-medium" style={{ color: "#ef4444" }}>авто</span>
          </div>
        )}
      </div>

      {autoFilled && (
        <div className="flex items-start gap-2 rounded-lg px-2.5 py-2 mb-1"
          style={{ background: "#ef444412", border: "1px solid #ef444430" }}>
          <Icon name="Zap" size={12} style={{ color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
          <div className="flex-1">
            <span className="text-[11px] leading-relaxed" style={{ color: "#fca5a5" }}>
              Затраты заполнены автоматически по правилу. Можно изменить вручную.
            </span>
          </div>
          <button onClick={onDismissAutoFilled} style={{ color: "#ef444460" }}>
            <Icon name="X" size={11} />
          </button>
        </div>
      )}
    </>
  );
}
