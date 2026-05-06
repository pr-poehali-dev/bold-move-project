import React from "react";
import Icon from "@/components/ui/icon";
import type { PlanState, PlanSettings } from "./planTypes";
import { pointLabel, distPx, pxToCm, calcScale, genId } from "./planTypes";
import { Section, LengthRow } from "./PlanSidebarShared";

interface Props {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
}

// ─── Форма добавления размерной линии ─────────────────────────────────────────
function AddDimLineForm({ points, onAdd }: { points: { id: string }[]; onAdd: (fromId: string, toId: string) => void }) {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  return (
    <div className="mt-2.5 pt-2 border-t border-white/[0.06]">
      <span className="block text-[10px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Добавить линию</span>
      <div className="flex gap-1.5 items-center">
        <select value={from} onChange={e => setFrom(e.target.value)}
          className="flex-1 bg-white/[0.06] border border-white/[0.1] rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none">
          <option value="">От</option>
          {points.map((p, i) => <option key={p.id} value={p.id}>{pointLabel(i)}</option>)}
        </select>
        <Icon name="ArrowRight" size={11} className="text-white/25 shrink-0" />
        <select value={to} onChange={e => setTo(e.target.value)}
          className="flex-1 bg-white/[0.06] border border-white/[0.1] rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none">
          <option value="">До</option>
          {points.map((p, i) => <option key={p.id} value={p.id}>{pointLabel(i)}</option>)}
        </select>
        <button onClick={() => { if (from && to && from !== to) { onAdd(from, to); setFrom(""); setTo(""); } }}
          className="w-8 h-8 rounded-lg bg-white/[0.08] border border-white/[0.12] text-white/60 hover:bg-white/[0.14] transition flex items-center justify-center">
          <Icon name="Plus" size={14} />
        </button>
      </div>
    </div>
  );
}

export default function MarkupTab({ state, onChange }: Props) {
  const { points, dimLines, isClosed, settings } = state;
  const scale = calcScale(points, state.segments);

  const lbl10 = "block text-[10px] font-bold uppercase tracking-widest text-white/25 mb-1";

  const updateSettings = (patch: Partial<PlanSettings>) =>
    onChange({ settings: { ...settings, ...patch } });

  return (
    <div>
      {/* ── Размерные линии ── */}
      <Section title="Размерные линии, см" icon="ArrowLeftRight" iconColor="#a78bfa"
        visible={settings.showDimLines}
        onVisibilityToggle={() => updateSettings({ showDimLines: !settings.showDimLines })}
        badge={dimLines.length > 0 ? String(dimLines.length) : undefined}
        defaultOpen>

        {dimLines.length === 0
          ? <p className="text-[11px] text-white/20 text-center py-3">Нет пользовательских линий</p>
          : (
            <div className="space-y-1">
              {dimLines.map((dl) => {
                const a = points.find(p => p.id === dl.fromId);
                const b = points.find(p => p.id === dl.toId);
                const idxA = points.findIndex(p => p.id === dl.fromId);
                const idxB = points.findIndex(p => p.id === dl.toId);
                const lenPx = a && b ? distPx(a, b) : 0;
                const autoCm = pxToCm(lenPx, scale);
                return (
                  <div key={dl.id} className="space-y-1">
                    <LengthRow
                      label={`${pointLabel(idxA)}-${pointLabel(idxB)}`}
                      valueCm={dl.labelCm}
                      placeholder={autoCm !== null ? String(autoCm) : "—"}
                      visible={dl.visible}
                      onValueChange={v => onChange({ dimLines: dimLines.map(d => d.id === dl.id ? { ...d, labelCm: v } : d) })}
                      onVisibilityToggle={() => onChange({ dimLines: dimLines.map(d => d.id === dl.id ? { ...d, visible: !d.visible } : d) })}
                      onDelete={() => onChange({ dimLines: dimLines.filter(d => d.id !== dl.id) })}
                    />
                    <div className="flex items-center gap-2 px-1.5">
                      <span className="text-[9px] text-white/25">Смещение</span>
                      <input type="range" min={15} max={100} step={5}
                        value={dl.offsetPx}
                        onChange={e => onChange({ dimLines: dimLines.map(d => d.id === dl.id ? { ...d, offsetPx: Number(e.target.value) } : d) })}
                        className="flex-1 accent-violet-500"
                      />
                      <span className="text-[9px] text-white/25 w-5">{dl.offsetPx}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }

        {isClosed && points.length >= 2 && (
          <AddDimLineForm points={points} onAdd={(fromId, toId) => {
            onChange({ dimLines: [...dimLines, { id: genId("dl"), fromId, toId, offsetPx: 40, visible: true, labelCm: null }] });
          }} />
        )}
      </Section>

      {/* ── Видимость слоёв ── */}
      <Section title="Видимость слоёв" icon="Eye" iconColor="#60a5fa" defaultOpen>
        <div className="space-y-1">
          {([
            ["Сетка",             "Grid3x3",       "showGrid",          "#60a5fa"],
            ["Точки",             "CircleDot",     "showPoints",        "#a78bfa"],
            ["Метки точек",       "Tag",           "showPointLabels",   "#a78bfa"],
            ["Подписи сторон",    "Type",          "showSegmentLabels", "#60a5fa"],
            ["Метки углов",       "Angle",         "showAngleLabels",   "#fbbf24"],
            ["Диагонали",         "ArrowUpRight",  "showDiagonals",     "#f97316"],
            ["Размерные линии",   "ArrowLeftRight","showDimLines",      "#a78bfa"],
          ] as const).map(([label, icon, key]) => (
            <div key={key} className="flex items-center justify-between py-1.5 px-1 rounded-lg hover:bg-white/[0.03] transition">
              <div className="flex items-center gap-2">
                <Icon name={icon} size={12} className="text-white/35" />
                <span className="text-[12px] text-white/60">{label}</span>
              </div>
              <button
                onClick={() => updateSettings({ [key]: !settings[key] } as Partial<PlanSettings>)}
                className={`w-9 h-5 rounded-full border transition-all relative ${
                  settings[key]
                    ? "bg-white border-white"
                    : "bg-white/[0.07] border-white/[0.15]"
                }`}>
                <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all ${
                  settings[key] ? "left-[18px] bg-[#111]" : "left-0.5 bg-white/40"
                }`} />
              </button>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Настройки сетки ── */}
      <Section title="Настройки сетки" icon="Settings2" iconColor="#94a3b8" defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <label className={lbl10}>Шаг сетки: {settings.gridSize} px</label>
            <input type="range" min={10} max={80} step={5}
              value={settings.gridSize}
              onChange={e => updateSettings({ gridSize: Number(e.target.value) })}
              className="w-full accent-violet-500" />
          </div>
        </div>
      </Section>
    </div>
  );
}
