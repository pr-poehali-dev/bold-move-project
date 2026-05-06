import type { PageBlockStyle } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";

const PRESET_SHADOWS = [
  { label: "Нет",       x:0, y:0, blur:0,  color:"rgba(0,0,0,0.4)" },
  { label: "Мягкая",    x:0, y:4, blur:12, color:"rgba(0,0,0,0.3)" },
  { label: "Чёткая",    x:2, y:4, blur:6,  color:"rgba(0,0,0,0.5)" },
  { label: "Свечение",  x:0, y:0, blur:20, color:"rgba(139,92,246,0.5)" },
  { label: "Красная",   x:0, y:0, blur:16, color:"rgba(239,68,68,0.5)" },
];

export function StylePanelBorderShadow({ s, onChange, tab2, lbl, numInp }: {
  s: PageBlockStyle;
  onChange: (p: Partial<PageBlockStyle>) => void;
  tab2: (v: boolean) => string;
  lbl: string;
  numInp: string;
}) {
  return (
    <>
      {/* ── Рамка ── */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] overflow-hidden">
        <div className="px-3 pt-3 pb-2 flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-blue-500/30 flex items-center justify-center">
            <Icon name="Square" size={11} className="text-blue-400" />
          </div>
          <span className="text-xs font-bold text-white/70">Рамка</span>
        </div>
        <div className="px-3 pb-3 space-y-2.5">
          {/* Стиль */}
          <div className="flex gap-1.5">
            {(["solid","dashed","dotted"] as const).map(st => (
              <button key={st} onClick={() => onChange({ borderStyle: st })}
                className={tab2((s.borderStyle ?? "solid") === st)}>
                {st === "solid" ? "—" : st === "dashed" ? "- -" : "···"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lbl}>Толщина</label>
              <div className="flex items-center gap-1.5">
                <input type="range" min={0} max={12} step={1}
                  value={s.borderWidth ?? 0}
                  onChange={e => onChange({ borderWidth: Number(e.target.value) })}
                  className="flex-1 accent-blue-500" />
                <span className="text-white/40 text-[10px] w-6 text-right">{s.borderWidth ?? 0}</span>
              </div>
            </div>
            <div>
              <label className={lbl}>Скругление</label>
              <div className="flex items-center gap-1.5">
                <input type="range" min={0} max={48} step={2}
                  value={s.borderRadius ?? 12}
                  onChange={e => onChange({ borderRadius: Number(e.target.value) })}
                  className="flex-1 accent-blue-500" />
                <span className="text-white/40 text-[10px] w-6 text-right">{s.borderRadius ?? 12}</span>
              </div>
            </div>
          </div>
          {/* Цвет рамки */}
          <div className="flex items-center gap-2">
            <label className={lbl + " mb-0"}>Цвет</label>
            <input type="color" value={s.borderColor?.startsWith("#") ? s.borderColor : "#ffffff"}
              onChange={e => onChange({ borderColor: e.target.value })}
              className="w-8 h-8 rounded-lg cursor-pointer border border-white/10 ml-auto" />
            <input value={s.borderColor || ""}
              onChange={e => onChange({ borderColor: e.target.value })}
              placeholder="#ffffff"
              className="flex-1 px-2 py-1.5 rounded-lg text-[10px] text-white bg-white/[0.06] border border-white/[0.1] focus:outline-none" />
          </div>
          {/* Превью рамки */}
          {(s.borderWidth ?? 0) > 0 && (
            <div className="h-8 rounded-xl w-full"
              style={{
                border: `${s.borderWidth}px ${s.borderStyle ?? "solid"} ${s.borderColor ?? "#fff"}`,
                borderRadius: s.borderRadius ?? 12,
              }} />
          )}
        </div>
      </div>

      {/* ── Тень ── */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] overflow-hidden">
        <div className="px-3 pt-3 pb-2 flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-purple-500/30 flex items-center justify-center">
            <Icon name="Layers" size={11} className="text-purple-400" />
          </div>
          <span className="text-xs font-bold text-white/70">Тень</span>
        </div>
        <div className="px-3 pb-3 space-y-2.5">
          {/* Пресеты */}
          <div className="flex flex-wrap gap-1.5">
            {PRESET_SHADOWS.map(p => (
              <button key={p.label}
                onClick={() => onChange({ shadowX: p.x, shadowY: p.y, shadowBlur: p.blur, shadowColor: p.color })}
                className="px-2.5 py-1 rounded-lg text-[10px] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-white/50 hover:text-white/80 transition">
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {([["shadowX","X"],["shadowY","Y"],["shadowBlur","Размытие"]] as const).map(([k, l]) => (
              <div key={k}>
                <label className={lbl}>{l}</label>
                <input type="number" step={1} value={(s as Record<string, number>)[k] ?? 0}
                  onChange={e => onChange({ [k]: Number(e.target.value) })}
                  className={numInp} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className={lbl + " mb-0"}>Цвет тени</label>
            <input type="color" value={s.shadowColor?.startsWith("#") ? s.shadowColor : "#000000"}
              onChange={e => onChange({ shadowColor: e.target.value })}
              className="w-8 h-8 rounded-lg cursor-pointer border border-white/10 ml-auto" />
          </div>
        </div>
      </div>
    </>
  );
}
