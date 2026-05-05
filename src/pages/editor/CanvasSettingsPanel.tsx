import React from "react";
import type { PageSettings } from "@/context/AuthContext";

export function CanvasSettingsPanel({ settings, onChange }: { settings: PageSettings; onChange: (s: PageSettings) => void }) {
  const lbl = "text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1.5 block";
  return (
    <div className="p-4 space-y-4">
      <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Настройки холста</p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={lbl}>Ширина (px)</label>
          <input type="number" step={10} value={settings.canvasWidth ?? 390}
            onChange={e => onChange({ ...settings, canvasWidth: Number(e.target.value) })}
            className="w-full px-2 py-1.5 rounded-lg text-xs text-white bg-white/[0.06] border border-white/[0.1] focus:outline-none" />
        </div>
        <div>
          <label className={lbl}>Высота (px)</label>
          <input type="number" step={50} value={settings.canvasHeight ?? 1200}
            onChange={e => onChange({ ...settings, canvasHeight: Number(e.target.value) })}
            className="w-full px-2 py-1.5 rounded-lg text-xs text-white bg-white/[0.06] border border-white/[0.1] focus:outline-none" />
        </div>
      </div>

      <div>
        <label className={lbl}>Сетка (px)</label>
        <div className="flex gap-1.5">
          {[4,8,16,32].map(g => (
            <button key={g} onClick={() => onChange({ ...settings, gridSize: g })}
              className={`flex-1 py-1.5 rounded-lg text-xs transition ${(settings.gridSize??8)===g?"bg-violet-500/30 text-violet-300 border border-violet-500/50":"bg-white/[0.03] text-white/40 border border-white/[0.07] hover:bg-white/[0.06]"}`}>
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
        <div>
          <p className="text-xs text-white/60 font-medium">Примагничивание</p>
          <p className="text-[10px] text-white/25">К сетке и к краям блоков</p>
        </div>
        <button onClick={() => onChange({ ...settings, snap: !settings.snap })}
          className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.snap?"bg-violet-600":"bg-white/10"}`}>
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${settings.snap?"left-6":"left-1"}`} />
        </button>
      </div>

      <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
        <div>
          <p className="text-xs text-white/60 font-medium">Показать сетку</p>
          <p className="text-[10px] text-white/25">Направляющие на холсте</p>
        </div>
        <button onClick={() => onChange({ ...settings, snap: settings.snap })}
          className="text-[10px] text-white/30 hover:text-white/60 transition">визуально</button>
      </div>
    </div>
  );
}
