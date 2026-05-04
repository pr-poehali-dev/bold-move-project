import Icon from "@/components/ui/icon";

interface DrawerIncomeAutoSectionProps {
  hasIncomeRules: boolean;
  contractSum: number;
  autoMode: boolean;
  autoFilled: boolean;
  onApplyAuto: () => void;
  onOpenRules: () => void;
  onDismissAutoFilled: () => void;
}

export function DrawerIncomeAutoSection({
  hasIncomeRules,
  contractSum,
  autoMode,
  autoFilled,
  onApplyAuto,
  onOpenRules,
  onDismissAutoFilled,
}: DrawerIncomeAutoSectionProps) {
  return (
    <>
      <div className="flex items-center gap-1.5 pt-2 pb-1 w-full">
        <button
          onClick={onApplyAuto}
          disabled={!hasIncomeRules || !contractSum}
          title={!contractSum ? "Сначала укажите сумму договора" : !hasIncomeRules ? "Настройте правило (шестерёнка)" : "Авто-расчёт по правилу"}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition disabled:opacity-30"
          style={{ background: "#10b98115", color: "#10b981", border: "1px solid #10b98130" }}>
          <Icon name="Zap" size={11} />
          Авто
        </button>
        <button
          onClick={onOpenRules}
          title="Настроить правила авто-расчёта доходов"
          className="p-1 rounded-lg transition hover:bg-white/5"
          style={{ color: "#6b7280" }}>
          <Icon name="Settings2" size={13} />
        </button>
        {!hasIncomeRules && (
          <span className="text-[10px]" style={{ color: "#6b7280" }}>Настройте правило →</span>
        )}
        {hasIncomeRules && autoMode && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full ml-auto"
            style={{ background: "#10b98118", border: "1px solid #10b98135" }}
            title="Авто-режим включён — доходы пересчитываются при изменении суммы">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#10b981" }} />
            <span className="text-[10px] font-medium" style={{ color: "#10b981" }}>авто</span>
          </div>
        )}
      </div>

      {autoFilled && (
        <div className="flex items-start gap-2 rounded-lg px-2.5 py-2 mb-1"
          style={{ background: "#10b98112", border: "1px solid #10b98130" }}>
          <Icon name="Zap" size={12} style={{ color: "#10b981", flexShrink: 0, marginTop: 1 }} />
          <div className="flex-1">
            <span className="text-[11px] leading-relaxed" style={{ color: "#6ee7b7" }}>
              Доходы заполнены автоматически по правилу. Можно изменить вручную.
            </span>
          </div>
          <button onClick={onDismissAutoFilled} style={{ color: "#10b98160" }}>
            <Icon name="X" size={11} />
          </button>
        </div>
      )}
    </>
  );
}
