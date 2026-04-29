import Icon from "@/components/ui/icon";

export function Label({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <Icon name={icon} size={11} style={{ color: "rgba(255,255,255,0.45)" }} />
      <span className="text-[10px] font-bold text-white/45 uppercase tracking-wider">{children}</span>
    </div>
  );
}

export function FloorPlan() {
  return (
    <svg viewBox="0 0 240 124" className="w-full h-full p-3">
      <rect x="6" y="6" width="228" height="98" rx="6" fill="none"
        stroke="rgba(167,139,250,0.55)" strokeWidth="1.5" strokeDasharray="3 2" />
      <rect x="14" y="14" width="110" height="50" rx="3" fill="rgba(167,139,250,0.07)"
        stroke="rgba(167,139,250,0.35)" strokeWidth="1" />
      <rect x="130" y="14" width="96" height="50" rx="3" fill="rgba(16,185,129,0.06)"
        stroke="rgba(16,185,129,0.35)" strokeWidth="1" />
      <rect x="14" y="70" width="212" height="28" rx="3" fill="rgba(249,115,22,0.06)"
        stroke="rgba(249,115,22,0.35)" strokeWidth="1" />
      <text x="20" y="32" fill="rgba(167,139,250,0.85)" fontSize="8" fontFamily="monospace">КУХНЯ</text>
      <text x="20" y="44" fill="rgba(255,255,255,0.4)" fontSize="7" fontFamily="monospace">12 м²</text>
      <text x="138" y="32" fill="rgba(16,185,129,0.85)" fontSize="8" fontFamily="monospace">СПАЛЬНЯ</text>
      <text x="138" y="44" fill="rgba(255,255,255,0.4)" fontSize="7" fontFamily="monospace">14 м²</text>
      <text x="20" y="86" fill="rgba(249,115,22,0.85)" fontSize="8" fontFamily="monospace">КОРИДОР · 6 м²</text>
      <text x="120" y="120" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="monospace">
        ИТОГО: 32 м²
      </text>
    </svg>
  );
}

export function Pulse({ color }: { color: string }) {
  return (
    <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none"
      style={{ background: `radial-gradient(circle, ${color}40, transparent 60%)`, animation: "pulse 2s ease-in-out infinite" }} />
  );
}

export function StepBar({ step }: { step: number }) {
  const labels = ["План", "Материалы", "Сумма", "Прибыль", "Скидка", "Сделка"];
  const colors = ["#a78bfa", "#a78bfa", "#fff", "#10b981", "#fbbf24", "#10b981"];
  return (
    <div className="px-4 py-2 flex items-center gap-1.5 border-b border-white/[0.05]"
      style={{ background: "rgba(255,255,255,0.015)" }}>
      {labels.map((l, i) => {
        const active = step >= i;
        const color  = active ? colors[i] : "rgba(255,255,255,0.15)";
        return (
          <div key={l} className="flex items-center gap-1.5 flex-1">
            <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
              style={{
                background: active ? color : "rgba(255,255,255,0.06)",
                boxShadow: step === i ? `0 0 12px ${color}` : "none",
              }}>
              {active && <Icon name="Check" size={9} style={{ color: "#0a0a14" }} />}
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider truncate"
              style={{ color: active ? color : "rgba(255,255,255,0.25)" }}>
              {l}
            </span>
            {i < labels.length - 1 && (
              <div className="flex-1 h-px"
                style={{ background: step > i ? color : "rgba(255,255,255,0.06)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
