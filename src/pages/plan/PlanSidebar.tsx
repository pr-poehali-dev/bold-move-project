import React, { useRef } from "react";
import Icon from "@/components/ui/icon";
import type { PlanState, Segment, DiagonalDef, PlanSettings } from "./planTypes";
import {
  pointLabel, segmentLabel, distPx, pxToCm, calcScale, angleDeg,
  buildAutoDiagonals, polygonArea, polygonPerimeter, genId,
} from "./planTypes";

interface PlanSidebarProps {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
}

// ── Аккордеон-секция ──────────────────────────────────────────────────────────
function Section({
  title, icon, iconColor, extra, defaultOpen = true, children,
  visible, onVisibilityToggle,
}: {
  title: string;
  icon: string;
  iconColor: string;
  extra?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  visible?: boolean;
  onVisibilityToggle?: () => void;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="border-b border-white/[0.07]">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/[0.03] transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Icon name={icon} size={14} style={{ color: iconColor }} />
        <span className="flex-1 text-left text-sm font-semibold text-white/80">{title}</span>
        {extra}
        {onVisibilityToggle && (
          <button
            onClick={e => { e.stopPropagation(); onVisibilityToggle(); }}
            className="p-1 rounded hover:bg-white/10 transition"
            title="Показать / скрыть"
          >
            <Icon name={visible ? "Eye" : "EyeOff"} size={13} className={visible ? "text-white/50" : "text-white/20"} />
          </button>
        )}
        <Icon name={open ? "ChevronUp" : "ChevronDown"} size={13} className="text-white/30" />
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

// ── Строка с полем ввода длины ────────────────────────────────────────────────
function LengthRow({
  label, valueCm, placeholder, visible, isActive, isHighlighted,
  onValueChange, onVisibilityToggle, onDelete, onFocus,
}: {
  label: string;
  valueCm: number | null;
  placeholder?: string;
  visible: boolean;
  isActive?: boolean;
  isHighlighted?: boolean;
  onValueChange: (v: number | null) => void;
  onVisibilityToggle: () => void;
  onDelete?: () => void;
  onFocus?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (isActive && inputRef.current) inputRef.current.focus();
  }, [isActive]);

  return (
    <div className={`flex items-center gap-2 py-1.5 rounded-lg px-2 transition-colors
      ${isActive ? "bg-violet-500/10 border border-violet-500/30" : isHighlighted ? "bg-white/[0.04]" : ""}`}>
      <span className="w-12 text-xs font-mono font-bold text-white/70 shrink-0">{label}</span>
      <input
        ref={inputRef}
        type="number"
        min={1}
        max={99999}
        step={1}
        value={valueCm ?? ""}
        placeholder={placeholder ?? "—"}
        onChange={e => {
          const v = e.target.value === "" ? null : Number(e.target.value);
          onValueChange(v);
        }}
        onFocus={onFocus}
        className="flex-1 bg-white/[0.06] border border-white/[0.1] rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-violet-500/60 focus:bg-violet-500/5 transition"
      />
      <span className="text-[10px] text-white/30">см</span>
      <button onClick={onVisibilityToggle} className="p-1 rounded hover:bg-white/10 transition" title="Показать/скрыть">
        <Icon name={visible ? "Eye" : "EyeOff"} size={12} className={visible ? "text-white/40" : "text-white/15"} />
      </button>
      {onDelete && (
        <button onClick={onDelete} className="p-1 rounded hover:bg-rose-500/20 transition" title="Удалить">
          <Icon name="Trash2" size={12} className="text-rose-400/50 hover:text-rose-400" />
        </button>
      )}
    </div>
  );
}

// ── Главный сайдбар ───────────────────────────────────────────────────────────
export default function PlanSidebar({ state, onChange }: PlanSidebarProps) {
  const { points, segments, diagonals, isClosed, settings, phase, activeInputIndex } = state;

  const scale = calcScale(points, segments);

  // ── Вспомогательные функции изменения ─────────────────────────────────────

  const updateSegment = (id: string, patch: Partial<Segment>) => {
    onChange({ segments: segments.map(s => s.id === id ? { ...s, ...patch } : s) });
  };

  const updateDiagonal = (id: string, patch: Partial<DiagonalDef>) => {
    onChange({ diagonals: diagonals.map(d => d.id === id ? { ...d, ...patch } : d) });
  };

  const updateSettings = (patch: Partial<PlanSettings>) => {
    onChange({ settings: { ...settings, ...patch } });
  };

  // Вычисляем угол в каждой точке
  const getAngle = (idx: number) => {
    if (!isClosed || points.length < 3) return null;
    const n = points.length;
    return angleDeg(points[(idx - 1 + n) % n], points[idx], points[(idx + 1) % n]);
  };

  // ── Площадь и периметр ────────────────────────────────────────────────────
  const areaPx = polygonArea(points);
  const perimPx = polygonPerimeter(points);
  const areaCm = scale ? Math.round(areaPx / (scale * scale) * 10) / 10 : null;
  const areaMm = scale ? Math.round(areaPx / (scale * scale) / 100 * 100) / 100 : null;
  const perimCm = scale ? Math.round((perimPx / scale) * 10) / 10 : null;
  const perimM = perimCm ? Math.round(perimCm / 100 * 100) / 100 : null;

  // ── Добавить диагональ вручную ────────────────────────────────────────────
  const handleAddDiagonal = (fromId: string, toId: string) => {
    const exists = diagonals.find(d =>
      (d.fromId === fromId && d.toId === toId) ||
      (d.fromId === toId && d.toId === fromId)
    );
    if (exists) return;
    const newDiag: DiagonalDef = {
      id: genId("d"),
      fromId,
      toId,
      lengthCm: null,
      showLength: true,
      visible: true,
    };
    onChange({ diagonals: [...diagonals, newDiag] });
  };

  // ── Автодиагонали ─────────────────────────────────────────────────────────
  const handleRebuildDiagonals = () => {
    onChange({ diagonals: buildAutoDiagonals(points, diagonals) });
  };

  // ── Пресеты углов ─────────────────────────────────────────────────────────
  const ANGLE_PRESETS = [90, 180, 270];

  const [addDiagFrom, setAddDiagFrom] = React.useState<string>("");
  const [addDiagTo, setAddDiagTo] = React.useState<string>("");

  const sectionHeader = (label: string) => (
    <span className="block text-[10px] font-bold uppercase tracking-widest text-white/25 mb-2 mt-1">{label}</span>
  );

  return (
    <div className="h-full flex flex-col bg-[#13141f] text-white overflow-y-auto">

      {/* ── Фигура ── */}
      <Section title="Фигура" icon="Pentagon" iconColor="#a78bfa" defaultOpen={true}>
        <div className="space-y-2">
          {/* Статистика */}
          <div className="grid grid-cols-3 gap-2">
            {([
              ["Углов", points.length.toString()],
              ["Периметр", perimM ? `${perimM} м` : "—"],
              ["Площадь", areaMm ? `${areaMm} м²` : "—"],
            ] as const).map(([l, v]) => (
              <div key={l} className="bg-white/[0.04] rounded-xl p-2 text-center">
                <div className="text-[10px] text-white/30 mb-0.5">{l}</div>
                <div className="text-sm font-bold text-white/80">{v}</div>
              </div>
            ))}
          </div>

          {/* Статус замыкания */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border
            ${isClosed
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-amber-500/10 border-amber-500/20 text-amber-400"}`}>
            <Icon name={isClosed ? "CheckCircle2" : "Circle"} size={13} />
            {isClosed ? "Фигура замкнута" : points.length < 3 ? `Нужно минимум 3 точки (сейчас ${points.length})` : "Фигура не замкнута"}
          </div>

          {/* Фаза */}
          {isClosed && (
            <div className="flex gap-1.5">
              {(["lengths", "angles"] as const).map(p => (
                <button key={p}
                  onClick={() => onChange({ phase: p, activeInputIndex: 0 })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition
                    ${state.phase === p
                      ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                      : "bg-white/[0.03] border-white/[0.07] text-white/40 hover:bg-white/[0.07]"}`}
                >
                  {p === "lengths" ? "Длины" : "Углы"}
                </button>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* ── Стороны ── */}
      <Section
        title="Стороны, см"
        icon="Ruler"
        iconColor="#60a5fa"
        visible={settings.showSegmentLabels}
        onVisibilityToggle={() => updateSettings({ showSegmentLabels: !settings.showSegmentLabels })}
        defaultOpen={true}
      >
        {segments.length === 0 && (
          <p className="text-xs text-white/25 text-center py-2">Нет отрезков</p>
        )}
        <div className="space-y-1">
          {segments.map((seg, idx) => {
            const a = points.find(p => p.id === seg.fromId);
            const b = points.find(p => p.id === seg.toId);
            const lenPx = a && b ? distPx(a, b) : 0;
            const autoCm = pxToCm(lenPx, scale);
            const lbl = segmentLabel(points, seg);
            const isActive = phase === "lengths" && activeInputIndex === idx;
            return (
              <LengthRow
                key={seg.id}
                label={lbl}
                valueCm={seg.lengthCm}
                placeholder={autoCm !== null ? String(autoCm) : "—"}
                visible={seg.showLength}
                isActive={isActive}
                onValueChange={v => {
                  updateSegment(seg.id, { lengthCm: v });
                  // автопереход к следующему отрезку
                  if (v !== null && phase === "lengths") {
                    const next = (activeInputIndex + 1) % segments.length;
                    onChange({ activeInputIndex: next });
                  }
                }}
                onVisibilityToggle={() => updateSegment(seg.id, { showLength: !seg.showLength })}
                onFocus={() => onChange({ activeInputIndex: idx })}
              />
            );
          })}
        </div>

        {/* Размерные линии toggle */}
        {segments.length > 0 && (
          <button
            onClick={() => updateSettings({ showDimLines: !settings.showDimLines })}
            className={`mt-2 w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-semibold border transition
              ${settings.showDimLines
                ? "bg-blue-500/10 border-blue-500/20 text-blue-300"
                : "bg-white/[0.03] border-white/[0.07] text-white/30"}`}
          >
            <Icon name="ArrowLeftRight" size={12} />
            {settings.showDimLines ? "Размерные линии вкл" : "Размерные линии выкл"}
          </button>
        )}
      </Section>

      {/* ── Углы ── */}
      <Section
        title="Углы"
        icon="Angle"
        iconColor="#fbbf24"
        visible={settings.showAngleLabels}
        onVisibilityToggle={() => updateSettings({ showAngleLabels: !settings.showAngleLabels })}
        defaultOpen={true}
      >
        {points.length === 0 && (
          <p className="text-xs text-white/25 text-center py-2">Нет точек</p>
        )}

        {/* Пресеты для быстрого применения */}
        {isClosed && (
          <div className="flex gap-1.5 mb-2">
            {ANGLE_PRESETS.map(deg => (
              <button key={deg}
                className="flex-1 py-1 rounded-lg text-xs font-bold border bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20 transition"
                title={`Все углы = ${deg}°`}
                onClick={() => {
                  // TODO: применить угол к активной точке
                  const idx = state.activeInputIndex;
                  onChange({ activeInputIndex: (idx + 1) % points.length });
                }}
              >
                {deg}°
              </button>
            ))}
          </div>
        )}

        <div className="space-y-1">
          {points.map((pt, idx) => {
            const deg = getAngle(idx);
            const isActive = phase === "angles" && activeInputIndex === idx;
            const isOdd = deg !== null && Math.abs(deg - Math.round(deg / 90) * 90) > 2;
            return (
              <div key={pt.id}
                className={`flex items-center gap-2 py-1.5 px-2 rounded-lg transition-colors
                  ${isActive ? "bg-amber-500/10 border border-amber-500/30" : "hover:bg-white/[0.03]"}`}
                onClick={() => onChange({ activeInputIndex: idx })}
                style={{ cursor: "pointer" }}
              >
                <span className="w-8 text-xs font-mono font-bold text-amber-300 shrink-0">{pointLabel(idx)}</span>
                <div className={`flex-1 bg-white/[0.06] border rounded-lg px-2 py-1 text-xs font-mono text-center
                  ${isOdd ? "text-rose-300 border-rose-500/30" : "text-white/70 border-white/[0.1]"}`}>
                  {deg !== null ? `${deg}°` : "—"}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); onChange({ selectedPointId: pt.id }); }}
                  className="p-1 rounded hover:bg-white/10 transition"
                >
                  <Icon name="Eye" size={12} className="text-white/30" />
                </button>
              </div>
            );
          })}
        </div>

        {isClosed && (
          <button className="mt-2 w-full py-1.5 rounded-lg text-xs font-semibold border bg-white/[0.03] border-white/[0.07] text-white/40 hover:bg-white/[0.07] transition">
            Все углы прямые
          </button>
        )}
      </Section>

      {/* ── Диагонали ── */}
      <Section
        title="Диагонали, см"
        icon="ArrowUpRight"
        iconColor="#f97316"
        visible={settings.showDiagonals}
        onVisibilityToggle={() => updateSettings({ showDiagonals: !settings.showDiagonals })}
        defaultOpen={true}
      >
        {diagonals.length === 0 && (
          <p className="text-xs text-white/25 text-center py-2">
            {isClosed ? "Нет диагоналей" : "Замкните фигуру"}
          </p>
        )}

        {/* Показать длины toggle */}
        {diagonals.length > 0 && (
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => {
                const allOn = diagonals.every(d => d.showLength);
                onChange({ diagonals: diagonals.map(d => ({ ...d, showLength: !allOn })) });
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] border bg-white/[0.03] border-white/[0.07] text-white/40 hover:bg-white/[0.07] transition"
            >
              <Icon name="Eye" size={11} />
              Показать длины
            </button>
            <button
              onClick={() => onChange({ diagonals: diagonals.map(d => ({ ...d, visible: false })) })}
              className="ml-auto text-[10px] text-rose-400/50 hover:text-rose-400 transition"
            >
              Удалить все
            </button>
          </div>
        )}

        <div className="space-y-1">
          {diagonals.map(diag => {
            const a = points.find(p => p.id === diag.fromId);
            const b = points.find(p => p.id === diag.toId);
            const idxA = points.findIndex(p => p.id === diag.fromId);
            const idxB = points.findIndex(p => p.id === diag.toId);
            const lenPx = a && b ? distPx(a, b) : 0;
            const autoCm = pxToCm(lenPx, scale);
            const lbl = `${pointLabel(idxA)}-${pointLabel(idxB)}`;
            return (
              <LengthRow
                key={diag.id}
                label={lbl}
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

        {/* Добавить диагональ вручную */}
        {isClosed && points.length >= 4 && (
          <div className="mt-3">
            {sectionHeader("Добавить диагональ")}
            <div className="flex gap-1.5 items-center">
              <select
                value={addDiagFrom}
                onChange={e => setAddDiagFrom(e.target.value)}
                className="flex-1 bg-white/[0.06] border border-white/[0.1] rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
              >
                <option value="">От</option>
                {points.map((p, i) => <option key={p.id} value={p.id}>{pointLabel(i)}</option>)}
              </select>
              <Icon name="ArrowRight" size={12} className="text-white/30 shrink-0" />
              <select
                value={addDiagTo}
                onChange={e => setAddDiagTo(e.target.value)}
                className="flex-1 bg-white/[0.06] border border-white/[0.1] rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
              >
                <option value="">До</option>
                {points.map((p, i) => <option key={p.id} value={p.id}>{pointLabel(i)}</option>)}
              </select>
              <button
                onClick={() => {
                  if (addDiagFrom && addDiagTo && addDiagFrom !== addDiagTo) {
                    handleAddDiagonal(addDiagFrom, addDiagTo);
                    setAddDiagFrom(""); setAddDiagTo("");
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-500/20 border border-orange-500/30 text-orange-300 hover:bg-orange-500/30 transition"
              >
                +
              </button>
            </div>
            <button
              onClick={handleRebuildDiagonals}
              className="mt-1.5 w-full py-1.5 rounded-lg text-xs font-semibold border bg-white/[0.03] border-white/[0.07] text-white/40 hover:bg-white/[0.07] transition"
            >
              Восстановить авто-диагонали
            </button>
          </div>
        )}
      </Section>

      {/* ── Настройки сетки ── */}
      <Section title="Настройки" icon="Settings2" iconColor="#94a3b8" defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">
              Шаг сетки: {settings.gridSize} px
            </label>
            <input
              type="range" min={10} max={80} step={5}
              value={settings.gridSize}
              onChange={e => updateSettings({ gridSize: Number(e.target.value) })}
              className="w-full accent-violet-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">
              Масштаб: {Math.round(settings.zoom * 100)}%
            </label>
            <input
              type="range" min={0.3} max={3} step={0.1}
              value={settings.zoom}
              onChange={e => updateSettings({ zoom: Number(e.target.value) })}
              className="w-full accent-violet-500"
            />
          </div>
        </div>
      </Section>

    </div>
  );
}
