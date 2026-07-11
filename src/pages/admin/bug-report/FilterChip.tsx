// ── Чип-фильтр ─────────────────────────────────────────────────────────────
export default function FilterChip({ label, count, active, color, onClick }: {
  label: string; count: number; active: boolean; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition"
      style={{
        background: active ? color + "22" : "rgba(255,255,255,0.05)",
        border: `1px solid ${active ? color + "55" : "rgba(255,255,255,0.08)"}`,
        color: active ? color : "rgba(255,255,255,0.6)",
      }}
    >
      {label}
      <span className="px-1.5 rounded-full text-[10px]" style={{ background: active ? color + "33" : "rgba(255,255,255,0.08)" }}>
        {count}
      </span>
    </button>
  );
}
