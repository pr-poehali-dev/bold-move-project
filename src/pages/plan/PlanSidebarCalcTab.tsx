import React from "react";
import Icon from "@/components/ui/icon";
import type { PlanState, SegmentPriceItem } from "./planTypes";
import { calcScale, polygonArea, polygonPerimeter, segmentLabel } from "./planTypes";
import { sortCategories } from "./categoryOrder";
import ActiveItemPopup from "./ActiveItemPopup";

// ─── Вкладка "Расчёт" ────────────────────────────────────────────────────────
export default function CalcTab({
  state,
  onUpdateQuantity,
  onUpdateFloorQuantity,
  onHideMaterialsButton,
  onShowMaterialsButton,
  // Колбэки быстрых функций (те же, что в нижнем баре)
  onRemoveActiveItem,
  onAssignToAllSegs,
  onRemoveFromAllSegs,
  isItemOnAllSegs,
  onAdjustQuantity,
  onSetQuantity,
  onAddToFloor,
  onReplaceItem,
  onDragItemStart,
  onAddToCategory,
  onHoverItem,
}: {
  state: PlanState;
  onRemoveItem?: (segId: string, priceId: number) => void;
  onUpdateQuantity?: (segId: string, priceId: number, quantity: number) => void;
  onRemoveFloorItem?: (id: string) => void;
  onUpdateFloorQuantity?: (id: string, quantity: number) => void;
  onHideMaterialsButton?: () => void;
  onShowMaterialsButton?: () => void;
  onRemoveActiveItem?: (priceId: number) => void;
  onAssignToAllSegs?: (item: SegmentPriceItem) => void;
  onRemoveFromAllSegs?: (priceId: number) => void;
  isItemOnAllSegs?: (priceId: number) => boolean;
  onAdjustQuantity?: (priceId: number, delta: number) => void;
  onSetQuantity?: (priceId: number, value: number) => void;
  onAddToFloor?: (item: SegmentPriceItem) => void;
  onReplaceItem?: (item: SegmentPriceItem) => void;
  onDragItemStart?: (item: SegmentPriceItem, clientX: number, clientY: number) => void;
  onAddToCategory?: (category: string) => void;
  /** Навели/увели курсор со строки позиции — подсветить её стены на чертеже */
  onHoverItem?: (priceId: number | null) => void;
}) {
  // Попап быстрых функций по клику на позицию
  const [popup, setPopup] = React.useState<{ item: SegmentPriceItem; total: number; x: number; bottom: number } | null>(null);

  // Закрываем попап при клике вне
  React.useEffect(() => {
    if (!popup) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-item-popup]") && !target.closest("[data-calc-row]")) {
        setPopup(null);
      }
    };
    window.addEventListener("mousedown", handler);
    window.addEventListener("touchstart", handler);
    return () => {
      window.removeEventListener("mousedown", handler);
      window.removeEventListener("touchstart", handler);
    };
  }, [popup]);

  const hasPopupFns = !!(onRemoveActiveItem || onReplaceItem || onAddToFloor);
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

  const hasWallItems = wallItems.length > 0;
  const hasFloorItems = floorItems.length > 0;
  const hasAnyItems = hasWallItems || hasFloorItems;

  // Группировка всех товаров по категориям (как в PlanMaterialsScreen)
  const grouped = React.useMemo(() => {
    const map = new Map<string, { priceId: number; name: string; category: string; imageUrl: string | null; unit: string; total: number; isFloor: boolean; floorId?: string; segIds: string[] }[]>();
    // Стены — агрегируем по priceId
    const wallAgg = new Map<number, { priceId: number; name: string; category: string; imageUrl: string | null; unit: string; total: number; segIds: string[] }>();
    wallItems.forEach(({ item, segId }) => {
      const ex = wallAgg.get(item.priceId);
      if (ex) { ex.total += (item.quantity ?? 1); ex.segIds.push(segId); }
      else wallAgg.set(item.priceId, { priceId: item.priceId, name: item.name, category: item.category ?? "Прочее", imageUrl: item.imageUrl, unit: item.unit, total: item.quantity ?? 1, segIds: [segId] });
    });
    wallAgg.forEach(entry => {
      const cat = entry.category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push({ ...entry, isFloor: false });
    });
    // Полотно
    floorItems.forEach(item => {
      const cat = item.category ?? "Прочее";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push({ priceId: item.priceId, name: item.name, category: cat, imageUrl: item.imageUrl, unit: item.unit, total: item.quantity, isFloor: true, floorId: item.id, segIds: [] });
    });
    return map;
  }, [wallItems, floorItems]);

  const categories = sortCategories(Array.from(grouped.keys()));



  return (
    <div className="px-4 py-3 space-y-5">

      {/* Размеры */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Размеры</p>
          {onHideMaterialsButton && (
            <button
              onClick={onHideMaterialsButton}
              title="Скрыть кнопку Материалы из меню"
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg transition hover:bg-white/10"
              style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}
            >
              <Icon name="EyeOff" size={12} />
              <span>Скрыть</span>
            </button>
          )}
          {onShowMaterialsButton && (
            <button
              onClick={onShowMaterialsButton}
              title="Показать кнопку Материалы в меню"
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg transition hover:bg-white/10"
              style={{ color: "rgba(167,139,250,0.6)", fontSize: 10 }}
            >
              <Icon name="Eye" size={12} />
              <span>Показать в меню</span>
            </button>
          )}
        </div>

        {/* Три главные метрики — компактный ряд блоков */}
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-2 py-2.5 flex flex-col items-center gap-1">
            <span className="text-[10px] text-emerald-400/80 font-bold uppercase tracking-wider leading-none">Площадь</span>
            <span className="text-[18px] font-bold font-mono text-emerald-300 leading-none">{areaM2 ?? "—"}</span>
            <span className="text-[11px] text-emerald-400/60 font-medium">м²</span>
          </div>
          <div className="bg-white/[0.05] border border-white/[0.1] rounded-xl px-2 py-2.5 flex flex-col items-center gap-1">
            <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider leading-none">Периметр</span>
            <span className="text-[18px] font-bold font-mono text-white/90 leading-none">{displayPerim ?? "—"}</span>
            <span className="text-[11px] text-white/40 font-medium">м</span>
          </div>
          <div className="bg-white/[0.05] border border-white/[0.1] rounded-xl px-2 py-2.5 flex flex-col items-center gap-1">
            <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider leading-none">Углов</span>
            <span className="text-[18px] font-bold font-mono text-white/90 leading-none">{points.length}</span>
            <span className="text-[11px] text-white/40 font-medium">шт</span>
          </div>
        </div>

        {/* Высота/опуск — только если заполнены в параметрах помещения */}
        {(ceilH || dipMm || finishH) && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 space-y-1">
            {ceilH && <div className="flex justify-between items-center">
              <span className="text-[11px] text-white/50">Высота потолка</span>
              <span className="text-[12px] font-bold font-mono text-white/70">{ceilH} <span className="text-[10px] font-normal text-white/30">см</span></span>
            </div>}
            {dipMm && <div className="flex justify-between items-center">
              <span className="text-[11px] text-white/50">Опуск от бетона</span>
              <span className="text-[12px] font-bold font-mono text-white/70">{dipMm} <span className="text-[10px] font-normal text-white/30">мм</span></span>
            </div>}
            {finishH && <div className="flex justify-between items-center">
              <span className="text-[11px] text-emerald-400/80">Чистовая высота</span>
              <span className="text-[12px] font-bold font-mono text-emerald-300">{Math.round(finishH * 10) / 10} <span className="text-[10px] font-normal text-emerald-400/40">см</span></span>
            </div>}
          </div>
        )}
      </div>

      {!scale && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-3 text-[11px] text-amber-400">
          <Icon name="AlertTriangle" size={13} className="inline mr-1.5" />
          Введите хотя бы одну длину стороны, чтобы рассчитать площадь.
        </div>
      )}

      {/* Материалы — сгруппированные по категориям */}
      {hasAnyItems && (
        <div className="space-y-4">
          {categories.map(cat => {
            const lines = grouped.get(cat) ?? [];
            return (
              <div key={cat}>
                {/* Заголовок категории */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(167,139,250,0.7)" }}>{cat}</span>
                  <div className="flex-1 h-px" style={{ background: "rgba(124,58,237,0.15)" }} />
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>{lines.length} поз.</span>
                </div>

                <div className="space-y-1.5">
                  {lines.map(line => {
                    // Собираем SegmentPriceItem для попапа/перетаскивания
                    const spItem: SegmentPriceItem = {
                      priceId: line.priceId,
                      name: line.name,
                      category: line.category,
                      imageUrl: line.imageUrl,
                      categoryImageUrl: null,
                      unit: line.unit,
                      isWallItem: !line.isFloor,
                    };
                    const openPopup = (clientX: number, topY: number) => {
                      if (!hasPopupFns) return;
                      setPopup({
                        item: spItem,
                        total: line.total,
                        x: clientX,
                        bottom: window.innerHeight - topY + 8,
                      });
                    };
                    return (
                    <div
                      key={`${line.isFloor ? "f" : "w"}-${line.priceId}`}
                      className="flex items-center gap-2.5 rounded-xl px-2.5 py-2"
                      style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.06)" }}
                      onMouseEnter={() => onHoverItem?.(line.priceId)}
                      onMouseLeave={() => onHoverItem?.(null)}
                    >
                      {/* Кликабельная + перетаскиваемая зона: картинка + название */}
                      <div
                        data-calc-row="1"
                        onClick={e => {
                          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          openPopup(r.left + 20, r.top);
                        }}
                        onPointerDown={e => {
                          if (!onDragItemStart) return;
                          onDragItemStart(spItem, e.clientX, e.clientY);
                        }}
                        className="flex items-center gap-2.5 flex-1 min-w-0"
                        style={{
                          cursor: onDragItemStart ? "grab" : hasPopupFns ? "pointer" : "default",
                          touchAction: "none",
                          userSelect: "none",
                          WebkitUserSelect: "none",
                        }}
                      >
                        {/* Картинка */}
                        <div className="w-8 h-8 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center"
                          style={{ background: "rgba(124,58,237,0.1)" }}>
                          {line.imageUrl
                            ? <img src={line.imageUrl} alt={line.name} className="w-full h-full object-cover pointer-events-none" draggable={false} />
                            : <Icon name="Package" size={13} style={{ color: "#a78bfa" }} />
                          }
                        </div>

                        {/* Название */}
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-[12px] font-semibold leading-snug line-clamp-2">{line.name}</div>
                        </div>
                      </div>

                      {/* −  кол-во  + */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            const next = Math.max(0, parseFloat((line.total - (line.unit === "шт" ? 1 : 0.1)).toFixed(2)));
                            if (line.isFloor && line.floorId) onUpdateFloorQuantity?.(line.floorId, next);
                            else line.segIds.forEach(sid => onUpdateQuantity?.(sid, line.priceId, next / (line.segIds.length || 1)));
                          }}
                          className="w-6 h-6 rounded-lg flex items-center justify-center transition active:scale-90"
                          style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)" }}
                        >
                          <Icon name="Minus" size={10} />
                        </button>
                        <input
                          type="number"
                          value={Math.round(line.total * 100) / 100}
                          onChange={e => {
                            const next = parseFloat(e.target.value);
                            if (isNaN(next) || next < 0) return;
                            if (line.isFloor && line.floorId) onUpdateFloorQuantity?.(line.floorId, next);
                            else line.segIds.forEach(sid => onUpdateQuantity?.(sid, line.priceId, next / (line.segIds.length || 1)));
                          }}
                          onClick={e => (e.target as HTMLInputElement).select()}
                          className="text-center text-white font-bold text-[12px] font-mono rounded-md"
                          style={{
                            width: 44,
                            background: "rgba(255,255,255,0.07)",
                            border: "1px solid transparent",
                            outline: "none",
                            padding: "2px 2px",
                          }}
                          onFocus={e => { e.target.style.borderColor = "rgba(139,92,246,0.6)"; e.target.select(); }}
                          onBlur={e => { e.target.style.borderColor = "transparent"; }}
                        />
                        <button
                          onClick={() => {
                            const next = parseFloat((line.total + (line.unit === "шт" ? 1 : 0.1)).toFixed(2));
                            if (line.isFloor && line.floorId) onUpdateFloorQuantity?.(line.floorId, next);
                            else line.segIds.forEach(sid => onUpdateQuantity?.(sid, line.priceId, next / (line.segIds.length || 1)));
                          }}
                          className="w-6 h-6 rounded-lg flex items-center justify-center transition active:scale-90"
                          style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)" }}
                        >
                          <Icon name="Plus" size={10} />
                        </button>
                      </div>
                    </div>
                  );
                  })}
                  {/* Добавить товар в эту категорию — открывает список, как "Заменить" из нижнего бара */}
                  {onAddToCategory && (
                    <button
                      onClick={() => onAddToCategory(cat)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium transition"
                      style={{ background: "rgba(124,58,237,0.08)", border: "1px dashed rgba(139,92,246,0.3)", color: "rgba(167,139,250,0.7)" }}
                    >
                      <Icon name="Plus" size={10} />
                      Добавить
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Попап быстрых функций — как в нижнем баре */}
      {popup && (
        <ActiveItemPopup
          item={popup.item}
          pos={{ x: popup.x, bottom: popup.bottom }}
          total={popup.total}
          onAllSegs={isItemOnAllSegs?.(popup.item.priceId) ?? false}
          hasSegments={state.isClosed && state.segments.length > 0}
          selectedSegmentIds={state.selectedSegmentIds}
          onClose={() => setPopup(null)}
          onRemoveActiveItem={(pid) => onRemoveActiveItem?.(pid)}
          onAssignToAllSegs={(it) => onAssignToAllSegs?.(it)}
          onRemoveFromAllSegs={(pid) => onRemoveFromAllSegs?.(pid)}
          onAdjustQuantity={(pid, d) => onAdjustQuantity?.(pid, d)}
          onSetQuantity={(pid, v) => onSetQuantity?.(pid, v)}
          onAddToFloor={onAddToFloor}
          onReplaceItem={onReplaceItem}
        />
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