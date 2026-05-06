import type { PageBlockStyle } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";

export function StylePanelPaddingOpacity({ s, onChange, lbl }: {
  s: PageBlockStyle;
  onChange: (p: Partial<PageBlockStyle>) => void;
  lbl: string;
}) {
  return (
    <>
      {/* ── Отступы ── */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] overflow-hidden">
        <div className="px-3 pt-3 pb-2 flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-emerald-500/30 flex items-center justify-center">
            <Icon name="Frame" size={11} className="text-emerald-400" />
          </div>
          <span className="text-xs font-bold text-white/70">Внутренние отступы</span>
        </div>
        <div className="px-3 pb-3">
          {/* Диаграмма отступов */}
          <div className="relative w-full aspect-square max-w-[160px] mx-auto mb-2">
            <div className="absolute inset-0 border border-white/10 rounded-xl flex items-center justify-center">
              <div className="w-1/2 h-1/2 border border-violet-500/30 rounded-lg bg-violet-500/10" />
            </div>
            {/* Top */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-10">
              <input type="number" min={0} max={80} step={4} value={s.padTop ?? 8}
                onChange={e => onChange({ padTop: Number(e.target.value) })}
                className="w-full text-center px-1 py-0.5 rounded text-[10px] text-white bg-black/40 border border-white/10 focus:outline-none" />
            </div>
            {/* Bottom */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-10">
              <input type="number" min={0} max={80} step={4} value={s.padBottom ?? 8}
                onChange={e => onChange({ padBottom: Number(e.target.value) })}
                className="w-full text-center px-1 py-0.5 rounded text-[10px] text-white bg-black/40 border border-white/10 focus:outline-none" />
            </div>
            {/* Left */}
            <div className="absolute left-1 top-1/2 -translate-y-1/2 w-10">
              <input type="number" min={0} max={80} step={4} value={s.padLeft ?? 8}
                onChange={e => onChange({ padLeft: Number(e.target.value) })}
                className="w-full text-center px-1 py-0.5 rounded text-[10px] text-white bg-black/40 border border-white/10 focus:outline-none" />
            </div>
            {/* Right */}
            <div className="absolute right-1 top-1/2 -translate-y-1/2 w-10">
              <input type="number" min={0} max={80} step={4} value={s.padRight ?? 8}
                onChange={e => onChange({ padRight: Number(e.target.value) })}
                className="w-full text-center px-1 py-0.5 rounded text-[10px] text-white bg-black/40 border border-white/10 focus:outline-none" />
            </div>
          </div>
          <button onClick={() => onChange({ padTop:8, padRight:12, padBottom:8, padLeft:12 })}
            className="w-full py-1.5 rounded-lg text-[10px] text-white/40 hover:text-white/60 border border-white/[0.07] hover:bg-white/[0.04] transition">
            Сбросить
          </button>
        </div>
      </div>

      {/* ── Прозрачность блока ── */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center">
            <Icon name="Eye" size={11} className="text-white/60" />
          </div>
          <span className="text-xs font-bold text-white/70">Прозрачность блока</span>
          <span className="ml-auto text-xs text-violet-300 font-bold">{s.opacity ?? 100}%</span>
        </div>
        <input type="range" min={10} max={100} step={5}
          value={s.opacity ?? 100}
          onChange={e => onChange({ opacity: Number(e.target.value) })}
          className="w-full accent-violet-500" />
        <div className="flex justify-between text-[9px] text-white/20 mt-1">
          <span>10%</span><span>Видимый</span><span>100%</span>
        </div>
      </div>
    </>
  );
}
