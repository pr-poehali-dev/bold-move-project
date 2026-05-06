import Icon from "@/components/ui/icon";
import type { PlanState } from "./planTypes";
import { calcScale, polygonArea, polygonPerimeter } from "./planTypes";

// ─── Вкладка "Расчёт" ────────────────────────────────────────────────────────
export default function CalcTab({ state }: { state: PlanState }) {
  const { points, segments, room } = state;
  const scale = calcScale(points, segments);
  const areaPx = polygonArea(points);
  const perimPx = polygonPerimeter(points);
  const areaCm2 = scale ? areaPx / (scale * scale) : null;
  const areaM2  = areaCm2 ? Math.round(areaCm2 / 10000 * 100) / 100 : null;
  const perimM  = scale ? Math.round((perimPx / scale) / 100 * 100) / 100 : null;

  const ceilH = room.floorToCeilCm;
  const dipMm = room.concreteDipMm;
  const finishH = ceilH && dipMm ? ceilH - dipMm / 10 : null;

  const row = (label: string, value: string, unit = "", accent = false) => (
    <div className={`flex items-center justify-between py-2 border-b border-white/[0.05] ${accent ? "text-emerald-300" : "text-white/70"}`}>
      <span className="text-[12px]">{label}</span>
      <span className="text-[13px] font-bold font-mono">{value} <span className="text-[10px] font-normal text-white/30">{unit}</span></span>
    </div>
  );

  return (
    <div className="px-4 py-3 space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-2">Размеры</p>
        {row("Площадь помещения", areaM2 ? String(areaM2) : "—", "м²", true)}
        {row("Периметр", perimM ? String(perimM) : "—", "м")}
        {row("Кол-во углов", String(points.length))}
        {ceilH && row("Высота потолка", String(ceilH), "см")}
        {dipMm && row("Опуск от бетона", String(dipMm), "мм")}
        {finishH && row("Чистовая высота", String(Math.round(finishH * 10) / 10), "см", true)}
      </div>

      {!scale && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-3 text-[11px] text-amber-400">
          <Icon name="AlertTriangle" size={13} className="inline mr-1.5" />
          Введите хотя бы одну длину стороны в сантиметрах, чтобы рассчитать площадь.
        </div>
      )}
    </div>
  );
}
