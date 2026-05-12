import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { AiRisk, RiskSettings } from "./discountBlockTypes";
import { DiscountEntry } from "@/hooks/useDiscountHistory";
import { DiscountRiskPopup } from "./DiscountRiskPopup";

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
  onApplyDiscount: (pct?: number) => void;
  onResetDiscount: () => void;
  onUpdateDiscount: (newPct: number) => void;
  hasAppliedDiscount: boolean;
  appliedDiscountPct: number;
  discountHistory: DiscountEntry[];
  totalDiscountAmount: number;
  setApplied: (v: boolean) => void;
}

// ── Модалка ввода скидки ────────────────────────────────────────────────────
function DiscountInputModal({
  baseIncome, initialPct, initialAmt, isApplied, applying, effectiveMax,
  onConfirm, onClose,
  defaultFocus = "pct",
}: {
  baseIncome: number;
  initialPct: number;
  initialAmt: number;
  isApplied: boolean;
  applying: boolean;
  effectiveMax: number;
  onConfirm: (pct: number) => void;
  onClose: () => void;
  defaultFocus?: "pct" | "amt";
}) {
  const [pct, setPct] = useState(initialPct > 0 ? String(initialPct) : "");
  const [amt, setAmt] = useState(initialAmt > 0 ? String(initialAmt) : "");
  const [focus, setFocus] = useState<"pct" | "amt">(defaultFocus);

  const syncFromPct = (v: string) => {
    setPct(v);
    const n = parseFloat(v);
    if (!isNaN(n) && n > 0 && baseIncome > 0) {
      setAmt(String(Math.round(baseIncome * n / 100)));
    } else {
      setAmt("");
    }
  };
  const syncFromAmt = (v: string) => {
    setAmt(v);
    const n = parseFloat(v);
    if (!isNaN(n) && n > 0 && baseIncome > 0) {
      setPct(String(Math.round(n / baseIncome * 1000) / 10));
    } else {
      setPct("");
    }
  };

  const pctVal = parseFloat(pct) || 0;
  const amtVal = parseFloat(amt) || 0;
  const resultIncome = baseIncome - amtVal;
  const valid = pctVal > 0 && pctVal <= (effectiveMax || 99) && amtVal > 0 && amtVal < baseIncome;

  const handleConfirm = () => {
    if (!valid) return;
    onConfirm(pctVal);
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={onClose}>
      <div className="w-full sm:max-w-xs rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ background: "#0e0e1c", border: "1px solid rgba(245,158,11,0.25)" }}
        onClick={e => e.stopPropagation()}>

        {/* Хэндл мобильный */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Шапка */}
        <div className="flex items-center justify-between px-4 pt-3 pb-3">
          <div className="flex items-center gap-2">
            <Icon name="Tag" size={14} style={{ color: "#f59e0b" }} />
            <span className="text-sm font-black text-white">
              {isApplied ? "Изменить скидку" : "Задать скидку"}
            </span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition" style={{ color: "rgba(255,255,255,0.4)" }}>
            <Icon name="X" size={14} />
          </button>
        </div>

        <div className="px-4 pb-4 space-y-3">
          {/* Два поля */}
          <div className="grid grid-cols-2 gap-2">
            {/* % */}
            <div className={`rounded-xl p-3 transition cursor-text ${focus === "pct" ? "ring-2 ring-yellow-500/50" : ""}`}
              style={{ background: focus === "pct" ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(245,158,11,0.25)" }}
              onClick={() => { setFocus("pct"); }}>
              <div className="text-[9px] uppercase tracking-wider font-bold mb-2" style={{ color: "#f59e0b" }}>Скидка %</div>
              <div className="flex items-center gap-1">
                <input
                  type="number" inputMode="decimal" min={0.1} max={effectiveMax || 99} step={0.5}
                  value={pct}
                  onChange={e => syncFromPct(e.target.value)}
                  onFocus={() => setFocus("pct")}
                  autoFocus={defaultFocus === "pct"}
                  placeholder="0"
                  className="flex-1 w-full bg-transparent text-xl font-black focus:outline-none"
                  style={{ color: "#f59e0b" }}
                />
                <span className="text-sm font-bold" style={{ color: "rgba(245,158,11,0.5)" }}>%</span>
              </div>
            </div>

            {/* Сумма */}
            <div className={`rounded-xl p-3 transition cursor-text ${focus === "amt" ? "ring-2 ring-yellow-500/50" : ""}`}
              style={{ background: focus === "amt" ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(245,158,11,0.25)" }}
              onClick={() => { setFocus("amt"); }}>
              <div className="text-[9px] uppercase tracking-wider font-bold mb-2" style={{ color: "#f59e0b" }}>Сумма ₽</div>
              <div className="flex items-center gap-1">
                <input
                  type="number" inputMode="numeric" min={1} step={100}
                  value={amt}
                  onChange={e => syncFromAmt(e.target.value)}
                  onFocus={() => setFocus("amt")}
                  autoFocus={defaultFocus === "amt"}
                  placeholder="0"
                  className="flex-1 w-full bg-transparent text-xl font-black focus:outline-none"
                  style={{ color: "#f59e0b" }}
                />
                <span className="text-sm font-bold" style={{ color: "rgba(245,158,11,0.5)" }}>₽</span>
              </div>
            </div>
          </div>

          {/* Итог */}
          {valid && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="text-[11px] text-white/40">Итого клиент заплатит</span>
              <span className="text-[13px] font-black text-white">{resultIncome.toLocaleString("ru-RU")} ₽</span>
            </div>
          )}

          {/* Кнопка */}
          <button
            onClick={handleConfirm}
            disabled={!valid || applying}
            className="w-full py-3 rounded-xl text-[13px] font-black transition disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]"
            style={{ background: valid ? "#f59e0b" : "rgba(245,158,11,0.15)", color: valid ? "#000" : "#f59e0b" }}>
            {applying
              ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Применяем...</span>
              : isApplied ? "Сохранить изменения" : "Применить скидку"
            }
          </button>
        </div>
      </div>
    </div>
  );
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
  const t = useTheme();
  const [editingPct,   setEditingPct]   = useState<string>("");
  const [isEditing,    setIsEditing]    = useState(false);
  const [riskPopupOpen, setRiskPopupOpen] = useState(false);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [modalFocus,   setModalFocus]   = useState<"pct" | "amt">("pct");

  const aiLevelColor = aiRisk?.level === "low" ? "#10b981" : aiRisk?.level === "mid" ? "#f59e0b" : "#ef4444";
  const aiLevelLabel = aiRisk?.level === "low" ? "Низкая сложность" : aiRisk?.level === "mid" ? "Средняя сложность" : "Высокая сложность";

  const openModal = (focus: "pct" | "amt") => { setModalFocus(focus); setModalOpen(true); };

  const handleModalConfirm = (pct: number) => {
    if (hasAppliedDiscount) {
      onUpdateDiscount(pct);
    } else {
      setDiscount(pct);
      onApplyDiscount(pct);
    }
    setModalOpen(false);
  };

  const startEdit = () => {
    setEditingPct(String(appliedDiscountPct));
    setIsEditing(true);
  };
  const commitEdit = () => {
    const val = parseFloat(editingPct);
    if (!isNaN(val) && val > 0 && val !== appliedDiscountPct) {
      onUpdateDiscount(val);
    }
    setIsEditing(false);
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${borderColor}`, background: "#f59e0b08" }}>

      {/* Шапка */}
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${borderColor}` }}>
        <Icon name="Tag" size={13} style={{ color: "#f59e0b" }} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-yellow-400">
          Оценка риска скидки
        </span>
        {/* Кнопка настроек */}
        <button onClick={() => setRiskPopupOpen(true)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition hover:opacity-80"
          style={{ background: "rgba(139,92,246,0.1)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.25)" }}
          title="Настройки правил скидки">
          <Icon name="Settings2" size={11} />
        </button>
        {/* Кнопка 3-этапного анализа */}
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

      {/* ── РЕЖИМ: скидка уже применена ── */}
      {hasAppliedDiscount && discountHistory.length > 0 && (
        <div className="px-4 py-4 space-y-3">
          {/* Плитки с текущими значениями */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Плитка СКИДКА — кликабельная */}
            <button onClick={() => openModal("pct")}
              className="rounded-xl px-3 py-2.5 text-center transition hover:brightness-125 active:scale-[0.97] group"
              style={{ background: "#f59e0b18", border: "1px solid #f59e0b60", cursor: "pointer" }}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "#f59e0b" }}>Скидка</span>
                <Icon name="Pencil" size={9} style={{ color: "#f59e0b80" }} className="group-hover:opacity-100 opacity-60" />
              </div>
              <div className="text-base font-black" style={{ color: "#f59e0b" }}>{appliedDiscountPct}%</div>
            </button>
            {/* Плитка СУММА СКИДКИ — кликабельная */}
            <button onClick={() => openModal("amt")}
              className="rounded-xl px-3 py-2.5 text-center transition hover:brightness-125 active:scale-[0.97] group"
              style={{ background: "#ffffff08", border: `1px solid rgba(245,158,11,0.35)`, cursor: "pointer" }}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <span className="text-[9px] uppercase tracking-wider font-semibold text-white/40">Сумма скидки</span>
                <Icon name="Pencil" size={9} style={{ color: "rgba(245,158,11,0.5)" }} className="group-hover:opacity-100 opacity-60" />
              </div>
              <div className="text-sm font-black text-white/70 whitespace-nowrap">−{fmt(totalDiscountAmount)} ₽</div>
            </button>
            <div className="rounded-xl px-3 py-2.5 text-center"
              style={{ background: accentColor + "18", border: `1px solid ${accentColor}35` }}>
              <div className="text-[9px] uppercase tracking-wider font-semibold mb-1" style={{ color: accentColor }}>
                {isRealLoss ? "Убыток" : "Прибыль"}
              </div>
              <div className="text-sm font-black whitespace-nowrap" style={{ color: accentColor }}>
                {isRealLoss ? "" : "+"}{fmt(discountedProfit)} ₽
              </div>
            </div>
            <div className="rounded-xl px-3 py-2.5 text-center"
              style={{ background: accentColor + "18", border: `1px solid ${accentColor}35` }}>
              <div className="text-[9px] uppercase tracking-wider font-semibold mb-1" style={{ color: accentColor }}>Маржа</div>
              <div className="text-sm font-black" style={{ color: accentColor }}>
                {isRealLoss ? "—" : `${discountedMargin}%`}
              </div>
            </div>
          </div>

          {/* Редактор скидки */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #f59e0b30", background: "#f59e0b06" }}>
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <Icon name="Tag" size={14} style={{ color: "#f59e0b" }} />
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={0.5} max={effectiveMax || 99} step={0.5}
                      value={editingPct}
                      onChange={e => setEditingPct(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setIsEditing(false); }}
                      autoFocus
                      className="w-20 rounded-lg px-2 py-1 text-sm font-bold focus:outline-none"
                      style={{ background: "rgba(245,158,11,0.15)", border: "1px solid #f59e0b50", color: "#f59e0b" }}
                    />
                    <span className="text-sm font-bold text-yellow-400">%</span>
                    <button onClick={commitEdit} disabled={applying}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition disabled:opacity-50"
                      style={{ background: "#f59e0b20", color: "#f59e0b", border: "1px solid #f59e0b40" }}>
                      {applying ? <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" /> : <Icon name="Check" size={11} />}
                      Сохранить
                    </button>
                    <button onClick={() => setIsEditing(false)}
                      className="px-2 py-1 rounded-lg text-[10px] transition hover:opacity-80"
                      style={{ color: "rgba(255,255,255,0.3)" }}>
                      Отмена
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">Скидка {appliedDiscountPct}% применена</span>
                    <span className="text-xs text-white/40">−{fmt(totalDiscountAmount)} ₽</span>
                  </div>
                )}
              </div>
              {!isEditing && (
                <div className="flex items-center gap-2">
                  <button onClick={startEdit} disabled={applying}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition hover:opacity-80 disabled:opacity-40"
                    style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
                    <Icon name="Pencil" size={10} /> Изменить
                  </button>
                  <button onClick={onResetDiscount} disabled={applying}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition hover:opacity-80 disabled:opacity-40"
                    style={{ background: "#ef444415", color: "#ef4444", border: "1px solid #ef444430" }}>
                    {applying
                      ? <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                      : <Icon name="Trash2" size={10} />
                    }
                    Удалить
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── РЕЖИМ: скидка не применена (слайдер) ── */}
      {!hasAppliedDiscount && <div className="px-4 py-4 space-y-4">

        {/* 4 плитки */}
        <div className="grid grid-cols-4 gap-2">
          {/* Плитка СКИДКА — кликабельная */}
          <button onClick={() => openModal("pct")}
            className="rounded-xl px-3 py-2.5 text-center transition hover:brightness-125 active:scale-[0.97] group"
            style={{ background: discount > 0 ? accentColor + "18" : "#ffffff08", border: `1px solid ${discount > 0 ? accentColor + "60" : "rgba(245,158,11,0.4)"}`, cursor: "pointer" }}>
            <div className="flex items-center justify-center gap-1 mb-1">
              <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "#f59e0b" }}>Скидка</span>
              <Icon name="Pencil" size={9} style={{ color: "#f59e0b80" }} className="group-hover:opacity-100 opacity-60" />
            </div>
            <div className="text-base font-black" style={{ color: accentColor }}>{discount}%</div>
          </button>
          {/* Плитка СУММА СКИДКИ — кликабельная */}
          <button onClick={() => openModal("amt")}
            className="rounded-xl px-3 py-2.5 text-center transition hover:brightness-125 active:scale-[0.97] group"
            style={{ background: "#ffffff08", border: `1px solid rgba(245,158,11,0.35)`, cursor: "pointer" }}>
            <div className="flex items-center justify-center gap-1 mb-1">
              <span className="text-[9px] uppercase tracking-wider font-semibold text-white/40">Сумма скидки</span>
              <Icon name="Pencil" size={9} style={{ color: "rgba(245,158,11,0.5)" }} className="group-hover:opacity-100 opacity-60" />
            </div>
            <div className="text-sm font-black text-white/70">−{fmt(baseIncome * discount / 100)} ₽</div>
          </button>
          <div className="rounded-xl px-3 py-2.5 text-center"
            style={{ background: accentColor + "18", border: `1px solid ${accentColor}35` }}>
            <div className="text-[9px] uppercase tracking-wider font-semibold mb-1"
              style={{ color: accentColor }}>
              {isRealLoss ? "Убыток" : "Прибыль"}
            </div>
            <div className="text-sm font-black" style={{ color: accentColor }}>
              {isRealLoss ? "" : "+"}{fmt(discountedProfit)} ₽
            </div>
          </div>
          <div className="rounded-xl px-3 py-2.5 text-center"
            style={{ background: accentColor + "18", border: `1px solid ${accentColor}35` }}>
            <div className="text-[9px] uppercase tracking-wider font-semibold mb-1"
              style={{ color: accentColor }}>Маржа</div>
            <div className="text-sm font-black" style={{ color: accentColor }}>
              {isRealLoss ? "—" : `${discountedMargin}%`}
            </div>
          </div>
        </div>

        {/* Предупреждения */}
        {(isOverMax) && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl animate-pulse"
            style={{ background: "#ef444415", border: "1px solid #ef444435" }}>
            <Icon name="AlertTriangle" size={14} style={{ color: "#ef4444", flexShrink: 0 }} />
            <div>
              <div className="text-[11px] font-black uppercase tracking-wide text-red-400">Превышен лимит скидки</div>
              <div className="text-[10px] text-red-300/70">Максимум {effectiveMax}% для этого заказа</div>
            </div>
          </div>
        )}
        {isRealLoss && !isOverMax && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl animate-pulse"
            style={{ background: "#ef444415", border: "1px solid #ef444435" }}>
            <Icon name="AlertTriangle" size={14} style={{ color: "#ef4444", flexShrink: 0 }} />
            <div>
              <div className="text-[11px] font-black uppercase tracking-wide text-red-400">Нельзя давать такую скидку</div>
              <div className="text-[10px] text-red-300/70">Объект становится убыточным</div>
            </div>
          </div>
        )}
        {isOverMinMargin && !isRealLoss && !isOverMax && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: "#f59e0b15", border: "1px solid #f59e0b30" }}>
            <Icon name="AlertCircle" size={14} style={{ color: "#f59e0b", flexShrink: 0 }} />
            <div className="text-[10px] text-yellow-300/80">
              Маржа {discountedMargin}% ниже минимума {risk.min_margin}% — скидка рискованная
            </div>
          </div>
        )}
        {isWarning && !isNegative && !isOverMax && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: "#f59e0b15", border: "1px solid #f59e0b30" }}>
            <Icon name="AlertCircle" size={14} style={{ color: "#f59e0b", flexShrink: 0 }} />
            <div className="text-[10px] text-yellow-300/80">
              Маржа {discountedMargin}% ниже {risk.warn_margin}% — скидка рискованная
              {currentZone === "high" && " (высокий риск по правилам)"}
            </div>
          </div>
        )}
        {applied && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: "#10b98115", border: "1px solid #10b98130" }}>
            <Icon name="CheckCircle2" size={14} style={{ color: "#10b981", flexShrink: 0 }} />
            <div className="text-[10px] text-emerald-300">Скидка применена — смета и P&L обновлены</div>
          </div>
        )}
        {/* Шкала + слайдер */}
        <div className="space-y-1">
          {/* Цветная шкала */}
          {(() => {
            const max    = sliderMax || 1;
            const lowPct = Math.min(100, (zoneLow / max) * 100);
            const midPct = Math.min(100, (zoneMid / max) * 100);
            return (
              <div className="relative h-7 rounded-lg overflow-hidden"
                style={{ background: `linear-gradient(90deg, #16a34a 0%, #84cc16 ${lowPct * 0.6}%, #f59e0b ${lowPct}%, #f97316 ${midPct * 0.7}%, #ef4444 ${midPct}%, #dc2626 100%)` }}>
                <div className="absolute inset-0 flex">
                  <div style={{ width: `${lowPct}%` }} className="flex items-center justify-center">
                    {lowPct > 15 && <span className="text-[10px] font-black text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>Безопасно</span>}
                  </div>
                  <div style={{ width: `${midPct - lowPct}%` }} className="flex items-center justify-center">
                    {(midPct - lowPct) > 15 && <span className="text-[10px] font-black text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>Умеренно</span>}
                  </div>
                  <div style={{ width: `${100 - midPct}%` }} className="flex items-center justify-center">
                    {(100 - midPct) > 15 && <span className="text-[10px] font-black text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>Осторожно</span>}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Метки */}
          <div className="relative h-4 overflow-hidden">
            <span className="absolute left-0 text-[9px] text-white/30">0%</span>
            {sliderMax > 0 && (() => {
              const rawLow = (zoneLow / sliderMax) * 100;
              const rawMid = (zoneMid / sliderMax) * 100;
              // Зажимаем позиции чтобы не вылезали за края и не перекрывались
              const lowPct = Math.min(Math.max(rawLow, 5), 90);
              const midPct = Math.min(Math.max(rawMid, lowPct + 8), 92);
              const showLow = Math.abs(rawLow - rawMid) > 7;
              return (
                <>
                  {showLow && (
                    <span className="absolute text-[9px] font-bold whitespace-nowrap"
                      style={{ left: `${lowPct}%`, color: "#f59e0b", transform: "translateX(-50%)" }}>↑ {zoneLow}%</span>
                  )}
                  <span className="absolute text-[9px] font-bold whitespace-nowrap"
                    style={{ left: `${midPct}%`, color: "#ef4444", transform: "translateX(-50%)" }}>↑ {zoneMid}%</span>
                </>
              );
            })()}
            <span className="absolute right-0 text-[9px] text-white/30">{sliderMax}%</span>
          </div>

          {/* Слайдер */}
          <input
            type="range" min={0} max={sliderMax || 1} step={0.5} value={discount}
            onChange={e => { setDiscount(Number(e.target.value)); setApplied(false); }}
            className="w-full cursor-pointer"
            style={{
              accentColor: isRealLoss || isOverMax ? "#ef4444"
                : isOverMinMargin ? "#f59e0b"
                : currentZone === "low" ? "#10b981"
                : currentZone === "mid" ? "#f59e0b"
                : "#ef4444",
              height: 4,
            }}
          />

          {/* Легенда */}
          <div className="flex flex-wrap gap-3 pt-1">
            {[
              { color: "#10b981", label: "Низкий риск",    hint: "маржа в безопасной зоне", range: `0–${zoneLow}%` },
              { color: "#f59e0b", label: "Средний риск",   hint: "стоит взвесить",           range: `${zoneLow}–${zoneMid}%` },
              { color: "#ef4444", label: "Высокий риск",   hint: "маржа под угрозой",        range: `${zoneMid}–${sliderMax}%` },
            ].map(z => (
              <div key={z.color} className="flex items-center gap-1.5" title={z.hint}>
                <div className="w-2 h-2 rounded-full" style={{ background: z.color }} />
                <span className="text-[10px] font-semibold" style={{ color: z.color }}>{z.label}</span>
                <span className="text-[9px] text-white/25">{z.range}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Компактный результат AI */}
        {aiError && (
          <div className="text-[10px] text-red-400 px-1">{aiError}</div>
        )}
        {aiRisk && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: aiLevelColor + "12", border: `1px solid ${aiLevelColor}25` }}>
            <div className="w-2 h-2 rounded-full mt-0.5 flex-shrink-0" style={{ background: aiLevelColor }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[11px] font-bold" style={{ color: aiLevelColor }}>{aiLevelLabel}</span>
                <span className="text-[9px] text-white/30">→ скидка {aiRisk.recommended_discount}% выставлена</span>
              </div>
              <p className="text-[10px] text-white/55">{aiRisk.reason}</p>
              {aiRisk.items.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {aiRisk.items.map((item, i) => (
                    <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full"
                      style={{ background: aiLevelColor + "18", color: aiLevelColor }}>{item}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Футер: итог + кнопка */}
        <div className="flex flex-col gap-2">
          {discount > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between px-3 py-2 rounded-xl"
                style={{ background: "#ffffff06", border: `1px solid ${t.border}` }}>
                <span className="text-[10px] text-white/40 leading-tight">Стоимость<br/>со скидкой</span>
                <span className="text-[11px] font-bold text-white/70 whitespace-nowrap">{fmt(discountedIncome)} ₽</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 rounded-xl"
                style={{ background: accentColor + "15", border: `1px solid ${accentColor}35` }}>
                <span className="text-[10px] leading-tight whitespace-nowrap" style={{ color: accentColor }}>
                  {isRealLoss ? "Убыток" : "Заработаете"}
                </span>
                <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: accentColor }}>
                  {isRealLoss ? "" : "+"}{fmt(discountedProfit)} ₽
                </span>
              </div>
            </div>
          )}
          <button
            onClick={onApplyDiscount}
            disabled={discount === 0 || isRealLoss || isOverMax || applying}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80"
            style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
            {applying
              ? <><div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Применяем...</>
              : <><Icon name="Percent" size={12} /> Применить скидку</>
            }
          </button>
        </div>

      </div>}
    </div>
  );
}