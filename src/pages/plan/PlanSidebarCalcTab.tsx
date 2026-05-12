import React from "react";
import Icon from "@/components/ui/icon";
import type { PlanState, SegmentPriceItem, FloorItem } from "./planTypes";
import { calcScale, polygonArea, polygonPerimeter, segmentLabel } from "./planTypes";

// ─── Вкладка "Расчёт" ────────────────────────────────────────────────────────
export default function CalcTab({
  state,
  onRemoveItem,
  onUpdateQuantity,
  onRemoveFloorItem,
  onUpdateFloorQuantity,
}: {
  state: PlanState;
  onRemoveItem?: (segId: string, priceId: number) => void;
  onUpdateQuantity?: (segId: string, priceId: number, quantity: number) => void;
  onRemoveFloorItem?: (id: string) => void;
  onUpdateFloorQuantity?: (id: string, quantity: number) => void;
}) {
  const { points, segments, room, floorItems = [] } = state;
  const scale    = calcScale(points, segments);
  const areaPx   = polygonArea(points);
  const perimPx  = polygonPerimeter(points);
  const areaCm2  = scale ? areaPx / (scale * scale) : null;
  const areaM2   = areaCm2 ? Math.round(areaCm2 / 10000 * 100) / 100 : null;
  const perimM   = scale ? Math.round((perimPx / scale) / 100 * 100) / 100 : null;
  const allSet   = segments.length > 0 && segments.every(s => s.lengthCm !== null && s.lengthCm > 0);
  const exactPerimM  = allSet ? Math.round(segments.reduce((s, seg) => s + (seg.lengthCm ?? 0), 0) / 100 * 100) / 100 : null;
  const displayPerim = exactPerimM ?? perimM;

  const ceilH   = room.floorToCeilCm;
  const dipMm   = room.concreteDipMm;
  const finishH = ceilH && dipMm ? ceilH - dipMm / 10 : null;

  // Собираем товары с СТЕН
  const wallItems: { item: SegmentPriceItem; segId: string; segLabel: string }[] = [];
  segments.forEach(seg => {
    (seg.items ?? []).forEach(item => {
      wallItems.push({ item, segId: seg.id, segLabel: segmentLabel(points, seg) });
    });
  });

  // Итого по стенам — группировка по priceId
  const wallTotals = new Map<number, { item: SegmentPriceItem; total: number }>();
  wallItems.forEach(({ item }) => {
    const existing = wallTotals.get(item.priceId);
    if (existing) existing.total += (item.quantity ?? 1);
    else wallTotals.set(item.priceId, { item, total: item.quantity ?? 1 });
  });

  // Итого по полотну — группировка по priceId
  const floorTotals = new Map<number, { item: FloorItem; total: number }>();
  floorItems.forEach(item => {
    const existing = floorTotals.get(item.priceId);
    if (existing) existing.total += item.quantity;
    else floorTotals.set(item.priceId, { item, total: item.quantity });
  });

  // Общие итого (стены + полотно)
  const allTotals = new Map<number, { name: string; imageUrl: string | null; unit: string; total: number }>();
  wallTotals.forEach(({ item, total }) => {
    allTotals.set(item.priceId, { name: item.name, imageUrl: item.imageUrl, unit: item.unit, total });
  });
  floorTotals.forEach(({ item, total }) => {
    const existing = allTotals.get(item.priceId);
    if (existing) existing.total += total;
    else allTotals.set(item.priceId, { name: item.name, imageUrl: item.imageUrl, unit: item.unit, total });
  });

  const hasWallItems = wallItems.length > 0;
  const hasFloorItems = floorItems.length > 0;
  const hasAnyItems = hasWallItems || hasFloorItems;

  const [editKey, setEditKey] = React.useState<string | null>(null);
  const [draft,   setDraft]   = React.useState("");

  const commitEdit = (segId: string, priceId: number) => {
    const v = parseFloat(draft.replace(",", "."));
    if (!isNaN(v) && v > 0) onUpdateQuantity?.(segId, priceId, v);
    setEditKey(null); setDraft("");
  };

  const commitFloorEdit = (id: string) => {
    const v = parseFloat(draft.replace(",", "."));
    if (!isNaN(v) && v > 0) onUpdateFloorQuantity?.(id, v);
    setEditKey(null); setDraft("");
  };

  const row = (label: string, value: string, unit = "", accent = false) => (
    <div className={`flex items-center justify-between py-2 border-b border-white/[0.05] ${accent ? "text-emerald-300" : "text-white/70"}`}>
      <span className="text-[12px]">{label}</span>
      <span className="text-[13px] font-bold font-mono">{value} <span className="text-[10px] font-normal text-white/30">{unit}</span></span>
    </div>
  );

  return (
    <div className="px-4 py-3 space-y-5">

      {/* Размеры */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-2">Размеры</p>
        {row("Площадь помещения", areaM2 ? String(areaM2) : "—", "м²", true)}
        {row("Периметр", displayPerim ? String(displayPerim) : "—", "м")}
        {row("Кол-во углов", String(points.length))}
        {ceilH && row("Высота потолка", String(ceilH), "см")}
        {dipMm && row("Опуск от бетона", String(dipMm), "мм")}
        {finishH && row("Чистовая высота", String(Math.round(finishH * 10) / 10), "см", true)}
      </div>

      {!scale && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-3 text-[11px] text-amber-400">
          <Icon name="AlertTriangle" size={13} className="inline mr-1.5" />
          Введите хотя бы одну длину стороны, чтобы рассчитать площадь.
        </div>
      )}

      {/* Материалы */}
      {hasAnyItems && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-2">Материалы</p>

          {/* Итого всё */}
          <div className="mb-3 bg-violet-500/8 border border-violet-500/20 rounded-xl px-3 py-2.5 space-y-1.5">
            <p className="text-[10px] text-violet-300/60 font-semibold uppercase tracking-wide mb-1">Итого</p>
            {Array.from(allTotals.values()).map(({ name, imageUrl, unit, total }) => (
              <div key={name} className="flex items-center gap-2">
                {imageUrl && (
                  <img src={imageUrl} className="w-5 h-5 rounded object-cover shrink-0 opacity-80" alt="" />
                )}
                <span className="text-[12px] text-white/70 flex-1 truncate">{name}</span>
                <span className="text-[12px] font-bold text-violet-300 font-mono shrink-0">
                  {Math.round(total * 100) / 100} <span className="text-[10px] font-normal text-violet-300/60">{unit}</span>
                </span>
              </div>
            ))}
          </div>

          {/* Товары на стенах */}
          {hasWallItems && (
            <div className="mb-3">
              <p className="text-[10px] text-white/25 font-semibold uppercase tracking-wide mb-1.5">На стенах</p>
              <div className="space-y-1">
                {wallItems.map(({ item, segId, segLabel }) => {
                  const key = `wall-${segId}-${item.priceId}`;
                  const qty = item.quantity ?? 1;
                  return (
                    <div key={key} className="flex items-center gap-2 py-1.5 border-b border-white/[0.05] group">
                      {item.imageUrl && (
                        <img src={item.imageUrl} className="w-6 h-6 rounded object-cover shrink-0" alt="" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-white/80 truncate">{item.name}</p>
                        <p className="text-[10px] text-white/30">{segLabel}</p>
                      </div>

                      {editKey === key ? (
                        <input
                          autoFocus type="number" min={0.01} step={0.1}
                          value={draft}
                          onChange={e => setDraft(e.target.value)}
                          onBlur={() => commitEdit(segId, item.priceId)}
                          onKeyDown={e => {
                            if (e.key === "Enter") commitEdit(segId, item.priceId);
                            if (e.key === "Escape") { setEditKey(null); setDraft(""); }
                          }}
                          className="w-16 bg-[#1a1b2e] border border-violet-500/50 rounded-lg px-2 py-1 text-[12px] text-white font-bold text-center focus:outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => { setEditKey(key); setDraft(String(qty)); }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/15 border border-violet-500/25 hover:bg-violet-500/25 transition"
                          title="Изменить количество"
                        >
                          <span className="text-[12px] font-bold text-violet-300 font-mono">{Math.round(qty * 100) / 100}</span>
                          <span className="text-[10px] text-violet-300/50">{item.unit}</span>
                          <Icon name="Pencil" size={9} className="text-violet-400/60" />
                        </button>
                      )}

                      <button
                        onClick={() => onRemoveItem?.(segId, item.priceId)}
                        className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-rose-500/20 transition text-white/30 hover:text-rose-400"
                      >
                        <Icon name="X" size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Товары на полотне */}
          {hasFloorItems && (
            <div>
              <p className="text-[10px] text-white/25 font-semibold uppercase tracking-wide mb-1.5">На полотне</p>
              <div className="space-y-1">
                {floorItems.map(item => {
                  const key = `floor-${item.id}`;
                  return (
                    <div key={key} className="flex items-center gap-2 py-1.5 border-b border-white/[0.05] group">
                      {item.imageUrl && (
                        <img src={item.imageUrl} className="w-6 h-6 rounded object-cover shrink-0" alt="" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-white/80 truncate">{item.name}</p>
                        <p className="text-[10px] text-white/30">Полотно</p>
                      </div>

                      {editKey === key ? (
                        <input
                          autoFocus type="number" min={0.01} step={0.1}
                          value={draft}
                          onChange={e => setDraft(e.target.value)}
                          onBlur={() => commitFloorEdit(item.id)}
                          onKeyDown={e => {
                            if (e.key === "Enter") commitFloorEdit(item.id);
                            if (e.key === "Escape") { setEditKey(null); setDraft(""); }
                          }}
                          className="w-16 bg-[#1a1b2e] border border-violet-500/50 rounded-lg px-2 py-1 text-[12px] text-white font-bold text-center focus:outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => { setEditKey(key); setDraft(String(item.quantity)); }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/15 border border-violet-500/25 hover:bg-violet-500/25 transition"
                          title="Изменить количество"
                        >
                          <span className="text-[12px] font-bold text-violet-300 font-mono">{Math.round(item.quantity * 100) / 100}</span>
                          <span className="text-[10px] text-violet-300/50">{item.unit}</span>
                          <Icon name="Pencil" size={9} className="text-violet-400/60" />
                        </button>
                      )}

                      <button
                        onClick={() => onRemoveFloorItem?.(item.id)}
                        className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-rose-500/20 transition text-white/30 hover:text-rose-400"
                      >
                        <Icon name="X" size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {!hasAnyItems && state.isClosed && (
        <div className="text-center py-4 text-white/20 text-[11px]">
          <Icon name="Package" size={24} className="mx-auto mb-2 opacity-20" />
          Добавьте материалы из каталога
        </div>
      )}
    </div>
  );
}
