import { useState } from "react";
import Icon from "@/components/ui/icon";
import { AiRisk, RiskSettings } from "./discountBlockTypes";
import { DiscountEntry } from "@/hooks/useDiscountHistory";
import { DiscountRiskPopup } from "./DiscountRiskPopup";
import { DiscountInputModal } from "./DiscountInputModal";
import { DiscountAppliedView } from "./DiscountAppliedView";
import { DiscountSliderView } from "./DiscountSliderView";

interface Props {
  discount: number;
  setDiscount: (v: number) => void;
  applying: boolean;
  applied: boolean;
  analysisLoading: boolean;
  baseIncome: number;
  discountedIncome: number;
  discountedProfit: number;
  discountedMargin: number;
  isNegative: boolean;
  isRealLoss: boolean;
  isOverMinMargin: boolean;
  isWarning: boolean;
  isOverMax: boolean;
  currentZone: "none" | "low" | "mid" | "high";
  accentColor: string;
  borderColor: string;
  effectiveMax: number;
  sliderMax: number;
  zoneLow: number;
  zoneMid: number;
  risk: RiskSettings;
  aiRisk: AiRisk | null;
  aiError: string | null;
  fmt: (n: number) => string;
  onAnalysisClick: () => void;
  onApplyDiscount: (pct?: number, exactAmt?: number) => void;
  onResetDiscount: () => void;
  onUpdateDiscount: (newPct: number, exactAmt?: number) => void;
  hasAppliedDiscount: boolean;
  appliedDiscountPct: number;
  discountHistory: DiscountEntry[];
  totalDiscountAmount: number;
  setApplied: (v: boolean) => void;
}

export function DiscountSliderPanel({
  discount, setDiscount,
  applying, applied, analysisLoading,
  baseIncome, discountedIncome, discountedProfit, discountedMargin,
  isNegative, isRealLoss, isOverMinMargin, isWarning, isOverMax,
  currentZone, accentColor, borderColor,
  effectiveMax, sliderMax, zoneLow, zoneMid,
  risk, aiRisk, aiError,
  fmt, onAnalysisClick, onApplyDiscount, onResetDiscount, onUpdateDiscount,
  hasAppliedDiscount, appliedDiscountPct,
  discountHistory, totalDiscountAmount, setApplied,
}: Props) {
  const [riskPopupOpen, setRiskPopupOpen] = useState(false);
  const [modalOpen,     setModalOpen]     = useState(false);
  const [modalFocus,    setModalFocus]    = useState<"pct" | "amt">("pct");

  const openModal = (focus: "pct" | "amt") => { setModalFocus(focus); setModalOpen(true); };

  const handleModalConfirm = (pct: number, exactAmt: number) => {
    if (hasAppliedDiscount) {
      onUpdateDiscount(pct, exactAmt);
    } else {
      setDiscount(pct);
      onApplyDiscount(pct, exactAmt);
    }
    setModalOpen(false);
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${borderColor}`, background: "#f59e0b08" }}>

      {/* Шапка */}
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${borderColor}` }}>
        <Icon name="Tag" size={13} style={{ color: "#f59e0b" }} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-yellow-400">
          Оценка риска скидки
        </span>
        <button onClick={() => setRiskPopupOpen(true)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition hover:opacity-80"
          style={{ background: "rgba(139,92,246,0.1)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.25)" }}
          title="Настройки правил скидки">
          <Icon name="Settings2" size={11} />
        </button>
        <button onClick={onAnalysisClick} disabled={analysisLoading}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition disabled:opacity-50 hover:opacity-80"
          style={{ background: "rgba(16,185,129,0.12)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" }}>
          {analysisLoading
            ? <><div className="w-2.5 h-2.5 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Анализ...</>
            : <><Icon name="BarChart2" size={11} /> Анализ объекта</>
          }
        </button>
      </div>

      {riskPopupOpen && <DiscountRiskPopup onClose={() => setRiskPopupOpen(false)} />}

      {modalOpen && (
        <DiscountInputModal
          baseIncome={baseIncome}
          initialPct={hasAppliedDiscount ? appliedDiscountPct : discount}
          initialAmt={hasAppliedDiscount ? totalDiscountAmount : Math.round(baseIncome * discount / 100)}
          isApplied={hasAppliedDiscount}
          applying={applying}
          effectiveMax={effectiveMax}
          defaultFocus={modalFocus}
          onConfirm={handleModalConfirm}
          onClose={() => setModalOpen(false)}
        />
      )}

      {/* РЕЖИМ: скидка уже применена */}
      {hasAppliedDiscount && (
        <DiscountAppliedView
          appliedDiscountPct={appliedDiscountPct}
          totalDiscountAmount={totalDiscountAmount}
          discountHistory={discountHistory}
          discountedProfit={discountedProfit}
          discountedMargin={discountedMargin}
          isRealLoss={isRealLoss}
          accentColor={accentColor}
          applying={applying}
          effectiveMax={effectiveMax}
          fmt={fmt}
          onOpenModal={openModal}
          onResetDiscount={onResetDiscount}
          onUpdateDiscount={onUpdateDiscount}
        />
      )}

      {/* РЕЖИМ: скидка не применена (слайдер) */}
      {!hasAppliedDiscount && (
        <DiscountSliderView
          discount={discount}
          setDiscount={setDiscount}
          applying={applying}
          applied={applied}
          baseIncome={baseIncome}
          discountedIncome={discountedIncome}
          discountedProfit={discountedProfit}
          discountedMargin={discountedMargin}
          isRealLoss={isRealLoss}
          isOverMinMargin={isOverMinMargin}
          isNegative={isNegative}
          isWarning={isWarning}
          isOverMax={isOverMax}
          currentZone={currentZone}
          accentColor={accentColor}
          effectiveMax={effectiveMax}
          sliderMax={sliderMax}
          zoneLow={zoneLow}
          zoneMid={zoneMid}
          risk={risk}
          aiRisk={aiRisk}
          aiError={aiError}
          fmt={fmt}
          onOpenModal={openModal}
          onApplyDiscount={onApplyDiscount}
          setApplied={setApplied}
        />
      )}
    </div>
  );
}
