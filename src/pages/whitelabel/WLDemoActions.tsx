import Icon from "@/components/ui/icon";

function Spin() {
  return <div className="w-3 h-3 border-2 border-white/15 border-t-violet-400 rounded-full animate-spin" />;
}

interface DemoActionsProps {
  onOpenSite: () => void;
  onOpenPanel: () => void;
  onEditBrand: () => void;
  onRunApiTests: () => void;
  onBuyAgent: () => void;
  onDelete: () => void;
  hasOwnAgent: boolean;
  isBuying: boolean;
  isDeleting: boolean;
}

export function WLDemoActions({
  onOpenSite,
  onOpenPanel,
  onEditBrand,
  onRunApiTests,
  onBuyAgent,
  onDelete,
  hasOwnAgent,
  isBuying,
  isDeleting,
}: DemoActionsProps) {
  const btn = "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition hover:opacity-80 disabled:opacity-50";

  return (
    <div className="flex flex-wrap gap-1.5">
      <button onClick={onOpenSite} className={btn}
        style={{ background: "rgba(6,182,212,0.12)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.25)" }}>
        <Icon name="Globe" size={10} /> Открыть сайт
      </button>
      <button onClick={onOpenPanel} className={btn}
        style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}>
        <Icon name="LayoutDashboard" size={10} /> Панель
      </button>
      <button onClick={onEditBrand} className={btn}
        style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}>
        <Icon name="Pencil" size={10} /> Бренд
      </button>
      <button onClick={onRunApiTests} className={btn}
        style={{ background: "rgba(16,185,129,0.10)", color: "#10b981", border: "1px solid rgba(16,185,129,0.22)" }}>
        <Icon name="Zap" size={10} /> Живые API
      </button>

      {!hasOwnAgent ? (
        <button onClick={onBuyAgent} disabled={isBuying} className={btn}
          style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}>
          {isBuying ? <Spin /> : <Icon name="Sparkles" size={10} />} Купили агента
        </button>
      ) : (
        <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
          style={{ background: "rgba(16,185,129,0.08)", color: "#10b981", border: "1px solid rgba(16,185,129,0.18)" }}>
          <Icon name="CheckCircle2" size={10} /> Агент активен
        </span>
      )}

      <button onClick={onDelete} disabled={isDeleting} className={`${btn} ml-auto`}
        style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.20)" }}>
        {isDeleting ? <Spin /> : <Icon name="Trash2" size={10} />} Удалить
      </button>
    </div>
  );
}