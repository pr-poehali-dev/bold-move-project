import { useTheme } from "./themeContext";
import Icon from "@/components/ui/icon";
import { EstimateBlock, PlanRoomForEstimate, PriceItem, SavedEstimate, fmt, pricingRules } from "./estimateTypes";
import EstimateItemRow from "./EstimateItemRow";
import PlanRoomPreview from "@/pages/plan/PlanRoomPreview";

interface Props {
  blocks: EstimateBlock[];
  prices: PriceItem[];
  planRooms: PlanRoomForEstimate[];
  estimate: SavedEstimate;
  standardTotal: number;
  editMode: boolean;
  onUpdateItem: (bi: number, ii: number, name: string, qty: number, price: number, unit: string) => void;
  onDeleteItem: (bi: number, ii: number) => void;
  onAddItem: (bi: number) => void;
}

export default function EstimateTable({
  blocks, prices, planRooms, estimate, standardTotal, editMode,
  onUpdateItem, onDeleteItem, onAddItem,
}: Props) {
  const t = useTheme();

  return (
    <>
      {/* Таблица позиций */}
      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
        <table className="w-full">
          <thead className="hidden sm:table-header-group">
            <tr style={{ background: t.surface2, borderBottom: `1px solid ${t.border}` }}>
              <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: t.textMute }}>Позиция</th>
              <th className="text-center px-2 py-2.5 text-xs font-semibold uppercase tracking-wide w-24" style={{ color: t.textMute }}>Кол-во</th>
              <th className="px-1 py-2.5 w-12" />
              <th className="text-right px-2 py-2.5 text-xs font-semibold uppercase tracking-wide w-28" style={{ color: t.textMute }}>Цена</th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide w-28" style={{ color: t.textMute }}>Итого</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {blocks.map((block, bi) => {
              let numCounter = 0;
              blocks.slice(0, bi).forEach(b => { if (b.numbered) numCounter++; });
              if (block.numbered) numCounter++;
              const label = block.numbered ? `${numCounter}. ${block.title}` : block.title;
              return (
                <>
                  <tr key={`h-${bi}`} style={{ background: t.surface2 + "80" }}>
                    <td colSpan={6} className="px-3 py-2 text-xs font-bold" style={{ color: "#f97316", borderBottom: `1px solid ${t.border2}` }}>
                      {label}
                    </td>
                  </tr>
                  {block.items.map((item, ii) => (
                    <EstimateItemRow
                      key={`${bi}-${ii}`}
                      item={item}
                      onChange={editMode ? (name, qty, price, unit) => onUpdateItem(bi, ii, name, qty, price, unit) : undefined}
                      onDelete={editMode ? () => onDeleteItem(bi, ii) : undefined}
                      prices={prices}
                      readOnly={!editMode}
                    />
                  ))}
                  {editMode && (
                    <tr key={`add-${bi}`}>
                      <td colSpan={6} className="px-3 py-1.5">
                        <button
                          onClick={() => onAddItem(bi)}
                          className="text-xs flex items-center gap-1.5 transition"
                          style={{ color: t.textMute }}
                        >
                          <Icon name="Plus" size={11} /> Добавить позицию
                        </button>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Итоги */}
      <div className="rounded-2xl p-4" style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
        <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: t.textMute }}>Итого</div>
        <div className="space-y-2">
          {[
            { label: pricingRules.econom_label,   val: Math.round(standardTotal * pricingRules.econom_mult),   color: "#10b981" },
            { label: pricingRules.standard_label, val: standardTotal,                                           color: "#f97316", bold: true },
            { label: pricingRules.premium_label,  val: Math.round(standardTotal * pricingRules.premium_mult),  color: "#8b5cf6" },
          ].map(r => (
            <div key={r.label} className="flex justify-between items-center">
              <span className="text-sm" style={{ color: t.textMute }}>{r.label}</span>
              <span className={`font-${r.bold ? "black text-base" : "semibold text-sm"}`} style={{ color: r.color }}>
                {fmt(r.val)} ₽
              </span>
            </div>
          ))}
        </div>

        {/* Разбивка: материалы / монтаж */}
        {estimate.material_cost != null && estimate.material_cost > 0 && (
          <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: `1px solid ${t.border}` }}>
            <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: t.textMute }}>Себестоимость (закупка)</div>
            <div className="flex justify-between items-center">
              <span className="text-xs" style={{ color: t.textMute }}>Материалы</span>
              <span className="text-xs font-semibold text-blue-400">{fmt(estimate.material_cost)} ₽</span>
            </div>
            {standardTotal > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: t.textMute }}>Монтаж (продажа)</span>
                <span className="text-xs font-semibold" style={{ color: t.textMute }}>
                  {fmt(standardTotal - estimate.material_cost)} ₽
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Чертежи комнат из плана */}
      {planRooms.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
          <div className="px-3 py-2.5 flex items-center gap-2" style={{ background: t.surface2, borderBottom: `1px solid ${t.border}` }}>
            <Icon name="LayoutDashboard" size={13} style={{ color: t.textMute }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: t.textMute }}>Чертежи комнат</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-px" style={{ background: t.border }}>
            {planRooms.map(room => {
              const drawData = room.active_variant_data ?? room.data;
              const variantName = room.active_variant_name;
              const hasVariant = !!room.active_variant_id;
              return (
                <div key={room.id} className="flex flex-col" style={{ background: t.bg }}>
                  <div className="relative" style={{ height: 140 }}>
                    <PlanRoomPreview data={drawData ?? {}} width={300} height={140} />
                    {hasVariant && (
                      <div
                        className="absolute top-2 left-2 px-2 py-0.5 rounded-lg text-[10px] font-bold"
                        style={{ background: "rgba(124,58,237,0.85)", color: "#fff" }}
                      >
                        {variantName}
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-2 flex items-center gap-2" style={{ borderTop: `1px solid ${t.border}` }}>
                    <span className="flex-1 text-xs font-semibold truncate" style={{ color: t.text }}>{room.name}</span>
                    {!room.include_in_estimate && (
                      <span className="text-[10px]" style={{ color: t.textMute }}>не в смете</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
