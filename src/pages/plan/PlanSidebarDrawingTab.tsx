import React from "react";
import Icon from "@/components/ui/icon";
import type { PlanState, Segment, DiagonalDef, PlanSettings, RoomParams } from "./planTypes";
import {
  pointLabel, segmentLabel, distPx, pxToCm, calcScale, angleDeg,
  buildAutoDiagonals, polygonArea, polygonPerimeter, genId,
} from "./planTypes";
import { Section, LengthRow } from "./PlanSidebarShared";

interface Props {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
}

// ─── Форма добавления размерной линии ─────────────────────────────────────────
function AddDimLineForm({ points, onAdd }: { points: { id: string }[]; onAdd: (fromId: string, toId: string) => void }) {
  const [from, setFrom] = React.useState("");
  const [to, setTo]     = React.useState("");
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
          className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition flex items-center justify-center">
          <Icon name="Plus" size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Вкладка "Чертёж" ────────────────────────────────────────────────────────
export default function DrawingTab({ state, onChange }: Props) {
  const { points, segments, diagonals, dimLines, isClosed, settings, phase, activeInputIndex, room } = state;
  const scale = calcScale(points, segments);

  const updateSegment = (id: string, patch: Partial<Segment>) =>
    onChange({ segments: segments.map(s => s.id === id ? { ...s, ...patch } : s) });

  const updateDiagonal = (id: string, patch: Partial<DiagonalDef>) =>
    onChange({ diagonals: diagonals.map(d => d.id === id ? { ...d, ...patch } : d) });

  const updateSettings = (patch: Partial<PlanSettings>) =>
    onChange({ settings: { ...settings, ...patch } });

  const updateRoom = (patch: Partial<RoomParams>) =>
    onChange({ room: { ...room, ...patch } });

  const areaPx = polygonArea(points);
  const perimPx = polygonPerimeter(points);
  const areaCm2 = scale ? Math.round(areaPx / (scale * scale) * 10) / 10 : null;
  const areaM2  = areaCm2 ? Math.round(areaCm2 / 10000 * 100) / 100 : null;
  const perimCm = scale ? Math.round((perimPx / scale) * 10) / 10 : null;
  const perimM  = perimCm ? Math.round(perimCm / 100 * 100) / 100 : null;

  const getAngle = (idx: number) => {
    if (!isClosed || points.length < 3) return null;
    const n = points.length;
    return angleDeg(points[(idx - 1 + n) % n], points[idx], points[(idx + 1) % n]);
  };

  const [addDiagFrom, setAddDiagFrom] = React.useState("");
  const [addDiagTo, setAddDiagTo]     = React.useState("");

  const lbl10 = "block text-[10px] font-bold uppercase tracking-widest text-white/25 mb-1";

  return (
    <div>
      {/* ── Фигура ── */}
      <Section title="Фигура" icon="Pentagon" iconColor="#a78bfa" defaultOpen>

        {/* Активная фигура */}
        <div className="mb-3">
          <label className={lbl10}>Активная фигура</label>
          <input value={room.name}
            onChange={e => updateRoom({ name: e.target.value })}
            className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-3 py-2 text-[12px] text-white focus:outline-none focus:border-violet-500/50 transition"
          />
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {([
            ["Периметр", perimM ? `${perimM} м` : "—", "#60a5fa"],
            ["Площадь",  areaM2 ? `${areaM2} м²` : "—", "#34d399"],
            ["Углов",    points.length.toString(), "#a78bfa"],
          ] as const).map(([l, v, c]) => (
            <div key={l} className="bg-white/[0.04] rounded-xl p-2 text-center border border-white/[0.06]">
              <div className="text-[9px] text-white/30 mb-0.5 uppercase tracking-wide">{l}</div>
              <div className="text-[13px] font-bold" style={{ color: c }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Параметры помещения */}
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lbl10}>Высота от пола до чернового потолка, см</label>
              <input type="number" min={100} max={500} step={1}
                value={room.floorToCeilCm ?? ""}
                placeholder="—"
                onChange={e => updateRoom({ floorToCeilCm: e.target.value ? Number(e.target.value) : null })}
                className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-2 py-2 text-[12px] text-white focus:outline-none focus:border-violet-500/50 transition"
              />
            </div>
            <div>
              <label className={lbl10}>Мансардный потолок</label>
              <button
                onClick={() => updateRoom({ mansardCeiling: !room.mansardCeiling })}
                className={`w-full py-2 px-3 rounded-xl text-[12px] font-semibold border transition ${
                  room.mansardCeiling
                    ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                    : "bg-white/[0.05] border-white/[0.1] text-white/40"
                }`}
              >
                {room.mansardCeiling ? "Да" : "Нет"}
              </button>
            </div>
          </div>
          <div>
            <label className={lbl10}>Опуск от бетона, мм</label>
            <input type="number" min={0} max={500} step={1}
              value={room.concreteDipMm ?? ""}
              placeholder="—"
              onChange={e => updateRoom({ concreteDipMm: e.target.value ? Number(e.target.value) : null })}
              className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-2 py-2 text-[12px] text-white focus:outline-none focus:border-violet-500/50 transition"
            />
          </div>
        </div>

        {/* Статус */}
        <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold border ${
          isClosed
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            : "bg-amber-500/10 border-amber-500/20 text-amber-400"
        }`}>
          <Icon name={isClosed ? "CheckCircle2" : "Circle"} size={12} />
          {isClosed ? "Фигура замкнута" : points.length < 3 ? `Нужно ≥3 точки (сейчас ${points.length})` : "Фигура не замкнута — кликни первую точку"}
        </div>

        {/* Фаза */}
        {isClosed && (
          <div className="flex gap-1.5 mt-2">
            {(["lengths", "angles"] as const).map(p => (
              <button key={p}
                onClick={() => onChange({ phase: p, activeInputIndex: 0 })}
                className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold border transition ${
                  state.phase === p
                    ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                    : "bg-white/[0.03] border-white/[0.07] text-white/35 hover:bg-white/[0.07]"
                }`}>
                {p === "lengths" ? "Длины" : "Углы"}
              </button>
            ))}
          </div>
        )}
      </Section>

      {/* ── Стороны ── */}
      <Section title="Стороны, см" icon="Ruler" iconColor="#60a5fa"
        visible={settings.showSegmentLabels}
        onVisibilityToggle={() => updateSettings({ showSegmentLabels: !settings.showSegmentLabels })}
        badge={segments.length > 0 ? String(segments.length) : undefined}
        defaultOpen>
        {segments.length === 0
          ? <p className="text-[11px] text-white/20 text-center py-3">Нет отрезков</p>
          : (
            <div className="space-y-0.5">
              {segments.map((seg, idx) => {
                const a = points.find(p => p.id === seg.fromId);
                const b = points.find(p => p.id === seg.toId);
                const lenPx = a && b ? distPx(a, b) : 0;
                const autoCm = pxToCm(lenPx, scale);
                const isActive = phase === "lengths" && activeInputIndex === idx;
                return (
                  <LengthRow key={seg.id}
                    label={segmentLabel(points, seg)}
                    valueCm={seg.lengthCm}
                    placeholder={autoCm !== null ? String(autoCm) : "—"}
                    visible={seg.showLength}
                    isActive={isActive}
                    onValueChange={v => updateSegment(seg.id, { lengthCm: v })}
                    onCommit={() => {
                      if (phase === "lengths")
                        onChange({ activeInputIndex: (activeInputIndex + 1) % segments.length });
                    }}
                    onVisibilityToggle={() => updateSegment(seg.id, { showLength: !seg.showLength })}
                    onFocus={() => onChange({ activeInputIndex: idx })}
                  />
                );
              })}
            </div>
          )
        }

        {/* Дуги/скругления на отрезках */}
        {segments.length > 0 && isClosed && (
          <div className="mt-2.5 pt-2 border-t border-white/[0.06]">
            <label className={lbl10}>Скругления углов (px)</label>
            <div className="space-y-0.5">
              {segments.map(seg => {
                const toIdx = points.findIndex(p => p.id === seg.toId);
                if (toIdx < 0) return null;
                return (
                  <div key={`arc-${seg.id}`} className="flex items-center gap-1.5">
                    <span className="w-10 text-[11px] font-mono text-white/40 shrink-0">{pointLabel(toIdx)}</span>
                    <input type="range" min={0} max={80} step={5}
                      value={seg.arcRadius}
                      onChange={e => updateSegment(seg.id, { arcRadius: Number(e.target.value) })}
                      className="flex-1 accent-emerald-500"
                    />
                    <span className="text-[10px] text-white/30 w-6 text-right font-mono">{seg.arcRadius}</span>
                    <button onClick={() => updateSegment(seg.id, { arcRadius: 0 })}
                      className="p-1 rounded hover:bg-white/10 transition" title="Сбросить дугу">
                      <Icon name="X" size={10} className="text-white/25" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Размерные линии toggle */}
        <button onClick={() => updateSettings({ showDimLines: !settings.showDimLines })}
          className={`mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-semibold border transition ${
            settings.showDimLines
              ? "bg-blue-500/10 border-blue-500/20 text-blue-300"
              : "bg-white/[0.03] border-white/[0.07] text-white/30"
          }`}>
          <Icon name="ArrowLeftRight" size={11} />
          {settings.showDimLines ? "Размерные линии вкл" : "Размерные линии выкл"}
        </button>
      </Section>

      {/* ── Углы ── */}
      <Section title="Углы" icon="Angle" iconColor="#fbbf24"
        visible={settings.showAngleLabels}
        onVisibilityToggle={() => updateSettings({ showAngleLabels: !settings.showAngleLabels })}
        badge={points.length > 0 ? String(points.length) : undefined}
        defaultOpen>

        {points.length === 0
          ? <p className="text-[11px] text-white/20 text-center py-3">Нет точек</p>
          : (<>
            {/* Быстрые действия */}
            <div className="flex gap-1.5 mb-2">
              <button className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-semibold border bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition"
                onClick={() => onChange({ phase: "angles", activeInputIndex: 0 })} title="Перейти к вводу углов">
                <Icon name="Target" size={11} />
                Указать угол {pointLabel(state.activeInputIndex)}
              </button>
              <button
                className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border bg-white/[0.04] border-white/[0.08] text-white/40 hover:bg-white/[0.08] transition"
                title="Все углы прямые">
                Все прямые
              </button>
            </div>

            {/* Пресеты */}
            <div className="flex gap-1.5 mb-2">
              {[90, 180, 270].map(deg => (
                <button key={deg}
                  className="flex-1 py-1 rounded-lg text-[11px] font-bold border bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20 transition"
                  title={`${deg}° → следующий`}
                  onClick={() => onChange({ activeInputIndex: (state.activeInputIndex + 1) % Math.max(1, points.length) })}>
                  {deg}°
                </button>
              ))}
            </div>

            {/* Список углов */}
            <div className="space-y-0.5">
              {points.map((pt, idx) => {
                const deg = getAngle(idx);
                const isActive = phase === "angles" && activeInputIndex === idx;
                const isOdd = deg !== null && Math.abs(deg - Math.round(deg / 90) * 90) > 1.5;
                return (
                  <div key={pt.id}
                    className={`flex items-center gap-1.5 py-1 px-1.5 rounded-lg cursor-pointer transition-colors
                      ${isActive ? "bg-amber-500/10 ring-1 ring-amber-500/30" : "hover:bg-white/[0.03]"}`}
                    onClick={() => onChange({ activeInputIndex: idx })}>
                    <Icon name="Angle" size={11} className="text-amber-500/60 shrink-0" />
                    <span className="w-7 text-[11px] font-mono font-bold text-amber-300 shrink-0">{pointLabel(idx)}</span>
                    <div className={`flex-1 bg-white/[0.05] border rounded-lg px-2 py-1 text-[11px] font-mono text-center
                      ${isOdd ? "text-rose-300 border-rose-500/30 bg-rose-500/5" : "text-white/60 border-white/[0.08]"}`}>
                      {deg !== null ? `${deg}°` : "—"}
                    </div>
                    <button onClick={e => { e.stopPropagation(); onChange({ selectedPointId: pt.id }); }}
                      className="p-1 rounded hover:bg-white/10 transition shrink-0">
                      <Icon name="Eye" size={11} className="text-white/25" />
                    </button>
                  </div>
                );
              })}
            </div>
          </>)
        }
      </Section>

      {/* ── Диагонали ── */}
      <Section title="Диагонали, см" icon="ArrowUpRight" iconColor="#f97316"
        visible={settings.showDiagonals}
        onVisibilityToggle={() => updateSettings({ showDiagonals: !settings.showDiagonals })}
        badge={diagonals.length > 0 ? String(diagonals.length) : undefined}
        defaultOpen>

        {diagonals.length === 0
          ? <p className="text-[11px] text-white/20 text-center py-3">{isClosed ? "Нет диагоналей" : "Замкните фигуру"}</p>
          : (<>
            {/* Заголовочные кнопки */}
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => { const allOn = diagonals.every(d => d.showLength); onChange({ diagonals: diagonals.map(d => ({ ...d, showLength: !allOn })) }); }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] border bg-white/[0.04] border-white/[0.08] text-white/40 hover:bg-white/[0.07] transition">
                <Icon name="Eye" size={10} />
                Показать длины
              </button>
              <button
                onClick={() => onChange({ diagonals: diagonals.map(d => ({ ...d, visible: false })) })}
                className="ml-auto text-[10px] text-rose-400/50 hover:text-rose-400 transition px-1">
                Удалить все
              </button>
            </div>
            <div className="space-y-0.5">
              {diagonals.map(diag => {
                const a = points.find(p => p.id === diag.fromId);
                const b = points.find(p => p.id === diag.toId);
                const idxA = points.findIndex(p => p.id === diag.fromId);
                const idxB = points.findIndex(p => p.id === diag.toId);
                const lenPx = a && b ? distPx(a, b) : 0;
                const autoCm = pxToCm(lenPx, scale);
                return (
                  <LengthRow key={diag.id}
                    label={`${pointLabel(idxA)}-${pointLabel(idxB)}`}
                    valueCm={diag.lengthCm}
                    placeholder={autoCm !== null ? String(autoCm) : "—"}
                    visible={diag.visible}
                    onValueChange={v => updateDiagonal(diag.id, { lengthCm: v })}
                    onVisibilityToggle={() => updateDiagonal(diag.id, { visible: !diag.visible })}
                    onDelete={() => onChange({ diagonals: diagonals.filter(d => d.id !== diag.id) })}
                  />
                );
              })}
            </div>
          </>)
        }

        {/* Добавить диагональ вручную */}
        {isClosed && points.length >= 4 && (
          <div className="mt-3 pt-2 border-t border-white/[0.06]">
            <label className={lbl10}>Добавить диагональ</label>
            <div className="flex gap-1.5 items-center">
              <select value={addDiagFrom} onChange={e => setAddDiagFrom(e.target.value)}
                className="flex-1 bg-white/[0.06] border border-white/[0.1] rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none">
                <option value="">От</option>
                {points.map((p, i) => <option key={p.id} value={p.id}>{pointLabel(i)}</option>)}
              </select>
              <Icon name="ArrowRight" size={11} className="text-white/25 shrink-0" />
              <select value={addDiagTo} onChange={e => setAddDiagTo(e.target.value)}
                className="flex-1 bg-white/[0.06] border border-white/[0.1] rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none">
                <option value="">До</option>
                {points.map((p, i) => <option key={p.id} value={p.id}>{pointLabel(i)}</option>)}
              </select>
              <button
                onClick={() => {
                  if (!addDiagFrom || !addDiagTo || addDiagFrom === addDiagTo) return;
                  const exists = diagonals.find(d =>
                    (d.fromId === addDiagFrom && d.toId === addDiagTo) ||
                    (d.fromId === addDiagTo && d.toId === addDiagFrom)
                  );
                  if (!exists) onChange({ diagonals: [...diagonals, { id: genId("d"), fromId: addDiagFrom, toId: addDiagTo, lengthCm: null, showLength: true, visible: true }] });
                  setAddDiagFrom(""); setAddDiagTo("");
                }}
                className="w-8 h-8 rounded-lg text-sm font-bold bg-orange-500/20 border border-orange-500/30 text-orange-300 hover:bg-orange-500/30 transition flex items-center justify-center">
                <Icon name="Plus" size={14} />
              </button>
            </div>
            <button onClick={() => onChange({ diagonals: buildAutoDiagonals(points, diagonals) })}
              className="mt-1.5 w-full py-1.5 rounded-xl text-[11px] font-semibold border bg-white/[0.03] border-white/[0.07] text-white/35 hover:bg-white/[0.07] transition">
              Восстановить авто-диагонали
            </button>
          </div>
        )}
      </Section>

      {/* ── Размерные линии ── */}
      <Section title="Размерные линии, см" icon="ArrowLeftRight" iconColor="#a78bfa"
        visible={settings.showDimLines}
        onVisibilityToggle={() => updateSettings({ showDimLines: !settings.showDimLines })}
        badge={dimLines.length > 0 ? String(dimLines.length) : undefined}
        defaultOpen={false}>

        {dimLines.length === 0
          ? <p className="text-[11px] text-white/20 text-center py-3">Нет пользовательских линий</p>
          : (
            <div className="space-y-1">
              {dimLines.map((dl, idx) => {
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

        {/* Добавить размерную линию */}
        {isClosed && points.length >= 2 && (
          <AddDimLineForm points={points} onAdd={(fromId, toId) => {
            onChange({ dimLines: [...dimLines, { id: genId("dl"), fromId, toId, offsetPx: 40, visible: true, labelCm: null }] });
          }} />
        )}
      </Section>

      {/* ── Настройки ── */}
      <Section title="Настройки сетки" icon="Settings2" iconColor="#94a3b8" defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <label className={lbl10}>Шаг сетки: {settings.gridSize} px</label>
            <input type="range" min={10} max={80} step={5}
              value={settings.gridSize}
              onChange={e => updateSettings({ gridSize: Number(e.target.value) })}
              className="w-full accent-violet-500" />
          </div>
          <div className="flex items-center gap-2">
            <label className={lbl10 + " mb-0 flex-1"}>Метки точек</label>
            <button onClick={() => updateSettings({ showPointLabels: !settings.showPointLabels })}
              className={`px-3 py-1 rounded-lg text-[11px] font-semibold border transition ${settings.showPointLabels ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "bg-white/[0.04] border-white/[0.08] text-white/35"}`}>
              {settings.showPointLabels ? "Вкл" : "Выкл"}
            </button>
          </div>
        </div>
      </Section>
    </div>
  );
}