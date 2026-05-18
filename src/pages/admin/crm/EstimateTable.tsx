import { useState, useCallback } from "react";
import { useTheme } from "./themeContext";
import Icon from "@/components/ui/icon";
import { EstimateBlock, PlanRoomForEstimate, PriceItem, SavedEstimate, fmt, pricingRules, parseValue } from "./estimateTypes";
import EstimateItemRow from "./EstimateItemRow";
import { DiscountInputModal } from "./DiscountInputModal";

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
  onChooseTier: (tier: "econom" | "standard" | "premium" | null) => void;
  onApplyDiscount?: (pct: number, exactAmt: number) => void;
}

export default function EstimateTable({
  blocks, prices, planRooms, estimate, standardTotal, editMode,
  onUpdateItem, onDeleteItem, onAddItem, onChooseTier, onApplyDiscount,
}: Props) {
  const t = useTheme();
  const [perRoom, setPerRoom] = useState(false);
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const chosen = estimate.chosen_tier;

  // В режиме редактирования — всегда По комнатам
  const effectivePerRoom = editMode ? true : perRoom;
  const [confirmReset, setConfirmReset] = useState(false);

  const handleResetClick = useCallback(() => setConfirmReset(true), []);
  const handleResetConfirm = useCallback(() => { setConfirmReset(false); onChooseTier(null); }, [onChooseTier]);
  const handleResetCancel  = useCallback(() => setConfirmReset(false), []);

  const blockTotal = (block: EstimateBlock) =>
    block.items.reduce((s, item) => {
      const p = parseValue(item.value);
      return s + (p ? p.total : 0);
    }, 0);

  const tiers: { key: "econom" | "standard" | "premium"; label: string; val: number; color: string }[] = [
    { key: "econom",   label: pricingRules.econom_label,   val: Math.round(standardTotal * pricingRules.econom_mult),  color: "#10b981" },
    { key: "standard", label: pricingRules.standard_label, val: standardTotal,                                          color: "#f97316" },
    { key: "premium",  label: pricingRules.premium_label,  val: Math.round(standardTotal * pricingRules.premium_mult), color: "#8b5cf6" },
  ];

  const totalsBlock = (
    <div className="rounded-2xl p-4" style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-bold uppercase tracking-wider" style={{ color: t.textMute }}>Итого</div>
        {chosen && !confirmReset && (
          <button
            onClick={handleResetClick}
            className="text-[10px] font-semibold flex items-center gap-1 transition hover:opacity-70"
            style={{ color: t.textMute }}
          >
            <Icon name="X" size={10} /> Сбросить выбор
          </button>
        )}
        {chosen && confirmReset && (
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: t.textMute }}>Сбросить согласование?</span>
            <button onClick={handleResetConfirm} className="text-[10px] font-bold px-2 py-0.5 rounded-lg transition" style={{ background: "#ef444420", color: "#ef4444" }}>Да</button>
            <button onClick={handleResetCancel}  className="text-[10px] font-bold px-2 py-0.5 rounded-lg transition" style={{ background: t.surface, color: t.textMute }}>Нет</button>
          </div>
        )}
      </div>
      <div className="space-y-2">
        {tiers
          .filter(r => !chosen || r.key === chosen)
          .map(r => {
            const isChosen = chosen === r.key;
            return (
              <div
                key={r.key}
                className="flex justify-between items-center rounded-xl px-3 py-2 cursor-pointer transition"
                style={{
                  background: isChosen ? r.color + "18" : "transparent",
                  border: isChosen ? `1px solid ${r.color}40` : "1px solid transparent",
                }}
                onClick={() => onChooseTier(chosen === r.key ? null : r.key)}
                title={chosen ? "Сбросить" : "Выбрать как согласованную цену"}
              >
                <div className="flex items-center gap-2">
                  {!chosen && (
                    <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition"
                      style={{ borderColor: r.color + "60" }}>
                    </div>
                  )}
                  {isChosen && (
                    <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: r.color }}>
                      <Icon name="Check" size={10} style={{ color: "#fff" }} />
                    </div>
                  )}
                  <span className="text-sm font-semibold" style={{ color: isChosen ? r.color : t.textMute }}>{r.label}</span>
                  {isChosen && <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold" style={{ background: r.color + "20", color: r.color }}>Согласовано</span>}
                </div>
                <span className={`font-${isChosen ? "black text-base" : "semibold text-sm"}`} style={{ color: r.color }}>
                  {fmt(r.val)} ₽
                </span>
              </div>
            );
          })}
      </div>
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
  );

  return (
    <>
      {/* Переключатель + кнопка скидки */}
      <div className="flex items-center gap-2">
        {/* Переключатель — скрываем в режиме редактирования */}
        {!editMode && (
          <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
            <button
              onClick={() => setPerRoom(false)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition"
              style={{
                background: !perRoom ? "rgba(124,58,237,0.2)" : t.surface2,
                color: !perRoom ? "#a78bfa" : t.textMute,
                borderRight: `1px solid ${t.border}`,
              }}
            >
              <Icon name="AlignJustify" size={12} />
              Все вместе
            </button>
            <button
              onClick={() => setPerRoom(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition"
              style={{
                background: perRoom ? "rgba(124,58,237,0.2)" : t.surface2,
                color: perRoom ? "#a78bfa" : t.textMute,
              }}
            >
              <Icon name="LayoutList" size={12} />
              По комнатам
            </button>
          </div>
        )}

        {/* Кнопка скидки — только в режиме редактирования */}
        {editMode && onApplyDiscount && (
          <button
            onClick={() => setDiscountModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition hover:brightness-110 active:scale-[0.97]"
            style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}
          >
            <Icon name="Tag" size={12} />
            Скидка
          </button>
        )}
      </div>

      {/* Модалка скидки */}
      {discountModalOpen && onApplyDiscount && (
        <DiscountInputModal
          baseIncome={standardTotal}
          initialPct={0}
          initialAmt={0}
          isApplied={false}
          applying={false}
          effectiveMax={50}
          onConfirm={(pct, amt) => { onApplyDiscount(pct, amt); setDiscountModalOpen(false); }}
          onClose={() => setDiscountModalOpen(false)}
          defaultFocus="pct"
        />
      )}

      {effectivePerRoom ? (
        /* ── По комнатам ── */
        <>
          {blocks.map((block, bi) => {
            const roomTotal = blockTotal(block);
            const econom  = Math.round(roomTotal * pricingRules.econom_mult);
            const premium = Math.round(roomTotal * pricingRules.premium_mult);
            return (
              <div key={bi} className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
                {/* Шапка комнаты */}
                <div className="px-3 py-2" style={{ background: t.surface2, borderBottom: `1px solid ${t.border}` }}>
                  <span className="text-xs font-bold" style={{ color: "#f97316" }}>{block.title}</span>
                </div>
                <table className="w-full">
                  <thead className="hidden sm:table-header-group">
                    <tr style={{ background: t.surface2 + "60", borderBottom: `1px solid ${t.border}` }}>
                      <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: t.textMute }}>Позиция</th>
                      <th className="text-center px-2 py-2 text-xs font-semibold uppercase tracking-wide w-24" style={{ color: t.textMute }}>Кол-во</th>
                      <th className="px-1 py-2 w-12" />
                      <th className="text-right px-2 py-2 text-xs font-semibold uppercase tracking-wide w-28" style={{ color: t.textMute }}>Цена</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wide w-28" style={{ color: t.textMute }}>Итого</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
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
                      <tr>
                        <td colSpan={6} className="px-3 py-1.5">
                          <button onClick={() => onAddItem(bi)} className="text-xs flex items-center gap-1.5 transition" style={{ color: t.textMute }}>
                            <Icon name="Plus" size={11} /> Добавить позицию
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {/* Итоги по комнате — только выбранный тир если согласовано */}
                {roomTotal > 0 && (
                  <div className="px-3 py-2.5 space-y-1" style={{ borderTop: `1px solid ${t.border}`, background: t.surface2 + "50" }}>
                    {(!chosen || chosen === "econom") && (
                      <div className="flex justify-between text-xs" style={{ fontWeight: chosen === "econom" ? 700 : 400 }}>
                        <span style={{ color: chosen === "econom" ? "#10b981" : t.textMute }}>{pricingRules.econom_label}</span>
                        <span style={{ color: "#10b981" }}>{fmt(econom)} ₽</span>
                      </div>
                    )}
                    {(!chosen || chosen === "standard") && (
                      <div className="flex justify-between text-xs" style={{ fontWeight: chosen === "standard" ? 700 : 400 }}>
                        <span style={{ color: chosen === "standard" ? "#f97316" : t.textMute }}>{pricingRules.standard_label}</span>
                        <span style={{ color: "#f97316" }}>{fmt(roomTotal)} ₽</span>
                      </div>
                    )}
                    {(!chosen || chosen === "premium") && (
                      <div className="flex justify-between text-xs" style={{ fontWeight: chosen === "premium" ? 700 : 400 }}>
                        <span style={{ color: chosen === "premium" ? "#8b5cf6" : t.textMute }}>{pricingRules.premium_label}</span>
                        <span style={{ color: "#8b5cf6" }}>{fmt(premium)} ₽</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {totalsBlock}
        </>
      ) : (
        /* ── Все вместе ── */
        <>
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
                            <button onClick={() => onAddItem(bi)} className="text-xs flex items-center gap-1.5 transition" style={{ color: t.textMute }}>
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
          {totalsBlock}
        </>
      )}
    </>
  );
}