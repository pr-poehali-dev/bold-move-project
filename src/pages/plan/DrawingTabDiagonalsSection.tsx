import React from "react";
import Icon from "@/components/ui/icon";
import type { PlanState, DiagonalDef, PlanSettings } from "./planTypes";
import { pointLabel, distPx, pxToCm, calcScale, buildAutoDiagonals, genId } from "./planTypes";
import { Section, LengthRow } from "./PlanSidebarShared";

interface Props {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
  updateDiagonal: (id: string, patch: Partial<DiagonalDef>) => void;
  updateSettings: (patch: Partial<PlanSettings>) => void;
  focusDiagonalRef?: React.MutableRefObject<(() => void) | null>;
}

const lbl10 = "block text-[10px] font-bold uppercase tracking-widest text-white/25 mb-1";

export default function DrawingTabDiagonalsSection({ state, onChange, updateDiagonal, updateSettings, focusDiagonalRef }: Props) {
  const { points, diagonals, isClosed, settings } = state;
  const scale = calcScale(points, state.segments);
  const [addDiagFrom, setAddDiagFrom] = React.useState("");
  const [addDiagTo, setAddDiagTo]     = React.useState("");
  const [forceOpen, setForceOpen]     = React.useState(false);

  // Refs для полей ввода диагоналей
  const diagInputRefs = React.useRef<React.RefObject<HTMLInputElement>[]>([]);
  if (diagInputRefs.current.length !== diagonals.length) {
    diagInputRefs.current = diagonals.map(() => React.createRef<HTMLInputElement>());
  }

  // Передаём функцию фокуса первой незаполненной диагонали наружу
  React.useEffect(() => {
    if (!focusDiagonalRef) return;
    focusDiagonalRef.current = () => {
      setForceOpen(true);
      setTimeout(() => {
        // Ищем первую диагональ без lengthCm
        const idx = diagonals.findIndex(d => d.lengthCm === null);
        const ref = diagInputRefs.current[idx >= 0 ? idx : 0];
        if (ref?.current) {
          ref.current.focus();
          ref.current.select();
          ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 150);
    };
  }, [diagonals, focusDiagonalRef]);

  return (
    <Section title="Диагонали, см" icon="ArrowUpRight" iconColor="#f97316"
      visible={settings.showDiagonals}
      onVisibilityToggle={() => updateSettings({ showDiagonals: !settings.showDiagonals })}
      badge={diagonals.length > 0 ? String(diagonals.length) : undefined}
      defaultOpen={false}
      forceOpen={forceOpen}>

      {diagonals.length === 0
        ? <p className="text-[11px] text-white/20 text-center py-3">{isClosed ? "Нет диагоналей" : "Замкните фигуру"}</p>
        : (<>
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
            {diagonals.map((diag, idx) => {
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
                  inputRef={diagInputRefs.current[idx]}
                  onValueChange={v => updateDiagonal(diag.id, { lengthCm: v })}
                  onVisibilityToggle={() => updateDiagonal(diag.id, { visible: !diag.visible })}
                  onDelete={() => onChange({ diagonals: diagonals.filter(d => d.id !== diag.id) })}
                />
              );
            })}
          </div>
        </>)
      }

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
          <button onClick={() => onChange({ diagonals: buildAutoDiagonals(points, diagonals, state.baseScale ?? null) })}
            className="mt-1.5 w-full py-1.5 rounded-xl text-[11px] font-semibold border bg-white/[0.03] border-white/[0.07] text-white/35 hover:bg-white/[0.07] transition">
            Восстановить авто-диагонали
          </button>
        </div>
      )}
    </Section>
  );
}
