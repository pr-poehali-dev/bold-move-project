import type { PageBlockStyle } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";

const PRESET_GRADIENTS: { label: string; from: string; to: string; angle: number }[] = [
  { label: "Закат",    from: "#f97316", to: "#e11d48", angle: 135 },
  { label: "Ночь",     from: "#6366f1", to: "#0f172a", angle: 135 },
  { label: "Океан",    from: "#0ea5e9", to: "#6366f1", angle: 135 },
  { label: "Лес",      from: "#10b981", to: "#0f172a", angle: 135 },
  { label: "Малина",   from: "#ec4899", to: "#8b5cf6", angle: 135 },
  { label: "Золото",   from: "#f59e0b", to: "#ef4444", angle: 135 },
  { label: "Лёд",      from: "#e0f2fe", to: "#6366f1", angle: 180 },
  { label: "Туман",    from: "#374151", to: "#111827", angle: 135 },
];

export function StylePanelBackground({ s, onChange, tab2, lbl }: {
  s: PageBlockStyle;
  onChange: (p: Partial<PageBlockStyle>) => void;
  tab2: (v: boolean) => string;
  lbl: string;
}) {
  const bgType = s.bgType ?? "none";

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] overflow-hidden">
      <div className="px-3 pt-3 pb-2 flex items-center gap-2">
        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-orange-500 to-violet-600 flex items-center justify-center">
          <Icon name="Palette" size={11} className="text-white" />
        </div>
        <span className="text-xs font-bold text-white/70">Фон</span>
      </div>
      <div className="px-3 pb-3 space-y-2.5">
        {/* Тип */}
        <div className="flex gap-1.5">
          {(["none","color","gradient"] as const).map(t => (
            <button key={t} onClick={() => onChange({ bgType: t })} className={tab2(bgType === t)}>
              {t === "none" ? "Нет" : t === "color" ? "Цвет" : "Градиент"}
            </button>
          ))}
        </div>

        {bgType === "color" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input type="color" value={s.bgColor || "#1e1e2e"}
                onChange={e => onChange({ bgColor: e.target.value })}
                className="w-10 h-10 rounded-xl cursor-pointer border border-white/10 bg-transparent" />
              <input value={s.bgColor || ""}
                onChange={e => onChange({ bgColor: e.target.value })}
                placeholder="#1e1e2e"
                className="flex-1 px-2 py-2 rounded-xl text-xs text-white bg-white/[0.06] border border-white/[0.1] focus:outline-none" />
            </div>
            <div>
              <label className={lbl}>Прозрачность {s.bgOpacity ?? 100}%</label>
              <input type="range" min={0} max={100} step={1}
                value={s.bgOpacity ?? 100}
                onChange={e => onChange({ bgOpacity: Number(e.target.value) })}
                className="w-full accent-violet-500" />
            </div>
          </div>
        )}

        {bgType === "gradient" && (
          <div className="space-y-2.5">
            {/* Пресеты */}
            <div className="grid grid-cols-4 gap-1.5">
              {PRESET_GRADIENTS.map(p => (
                <button key={p.label}
                  onClick={() => onChange({ bgGradFrom: p.from, bgGradTo: p.to, bgGradAngle: p.angle })}
                  title={p.label}
                  style={{ background: `linear-gradient(${p.angle}deg, ${p.from}, ${p.to})` }}
                  className="h-8 rounded-lg border-2 border-transparent hover:border-white/40 transition" />
              ))}
            </div>
            {/* Цвета */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={lbl}>Цвет 1</label>
                <div className="flex items-center gap-1.5">
                  <input type="color" value={s.bgGradFrom || "#6366f1"}
                    onChange={e => onChange({ bgGradFrom: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-white/10" />
                  <input value={s.bgGradFrom || ""}
                    onChange={e => onChange({ bgGradFrom: e.target.value })}
                    className="flex-1 px-2 py-1.5 rounded-lg text-[10px] text-white bg-white/[0.06] border border-white/[0.1] focus:outline-none" />
                </div>
              </div>
              <div>
                <label className={lbl}>Цвет 2</label>
                <div className="flex items-center gap-1.5">
                  <input type="color" value={s.bgGradTo || "#0f172a"}
                    onChange={e => onChange({ bgGradTo: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-white/10" />
                  <input value={s.bgGradTo || ""}
                    onChange={e => onChange({ bgGradTo: e.target.value })}
                    className="flex-1 px-2 py-1.5 rounded-lg text-[10px] text-white bg-white/[0.06] border border-white/[0.1] focus:outline-none" />
                </div>
              </div>
            </div>
            {/* Угол */}
            <div>
              <label className={lbl}>Угол {s.bgGradAngle ?? 135}°</label>
              <div className="flex items-center gap-2">
                <input type="range" min={0} max={360} step={15}
                  value={s.bgGradAngle ?? 135}
                  onChange={e => onChange({ bgGradAngle: Number(e.target.value) })}
                  className="flex-1 accent-violet-500" />
                <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center shrink-0"
                  style={{ background: `conic-gradient(from ${(s.bgGradAngle??135)}deg, ${s.bgGradFrom||"#6366f1"}, ${s.bgGradTo||"#0f172a"})` }} />
              </div>
            </div>
            {/* Превью */}
            <div className="w-full h-8 rounded-xl"
              style={{ background: `linear-gradient(${s.bgGradAngle??135}deg, ${s.bgGradFrom||"#6366f1"}, ${s.bgGradTo||"#0f172a"})` }} />
          </div>
        )}
      </div>
    </div>
  );
}
