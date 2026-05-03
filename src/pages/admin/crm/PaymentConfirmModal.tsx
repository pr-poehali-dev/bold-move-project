import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { uploadFile } from "./crmApi";

// ── Типы ─────────────────────────────────────────────────────────────────────
export interface PaymentFact {
  confirmed: boolean;
  amount: number;        // фактическая сумма
  receiptUrl: string | null; // URL чека
  confirmedAt: string;   // ISO дата
}

// ── localStorage helpers ──────────────────────────────────────────────────────
const LS_PREFIX = "crm_payment_fact_";

export function loadPaymentFact(clientId: number, field: "prepayment" | "extra_payment"): PaymentFact | null {
  try {
    const s = localStorage.getItem(`${LS_PREFIX}${clientId}_${field}`);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function savePaymentFact(clientId: number, field: "prepayment" | "extra_payment", fact: PaymentFact) {
  localStorage.setItem(`${LS_PREFIX}${clientId}_${field}`, JSON.stringify(fact));
}

export function clearPaymentFact(clientId: number, field: "prepayment" | "extra_payment") {
  localStorage.removeItem(`${LS_PREFIX}${clientId}_${field}`);
}

// ── Кнопка-индикатор рядом со строкой ────────────────────────────────────────
export function PaymentStatusBadge({
  clientId,
  field,
  plannedAmount,
  label,
  onConfirmed,
}: {
  clientId: number;
  field: "prepayment" | "extra_payment";
  plannedAmount: number | null | undefined;
  label: string;
  onConfirmed?: (fact: PaymentFact) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [fact, setFact] = useState<PaymentFact | null>(() => loadPaymentFact(clientId, field));

  const handleConfirmed = (newFact: PaymentFact) => {
    savePaymentFact(clientId, field, newFact);
    setFact(newFact);
    onConfirmed?.(newFact);
    setModalOpen(false);
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearPaymentFact(clientId, field);
    setFact(null);
  };

  if (fact?.confirmed) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded-md transition hover:opacity-80 flex-shrink-0"
          style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}
          title="Оплата подтверждена — нажмите чтобы изменить">
          <Icon name="CheckCircle2" size={11} style={{ color: "#10b981" }} />
          <span className="text-[10px] font-bold" style={{ color: "#10b981" }}>
            {fact.amount > 0 ? Math.round(fact.amount).toLocaleString("ru-RU") + " ₽" : "Получено"}
          </span>
          {fact.receiptUrl && (
            <Icon name="Paperclip" size={10} style={{ color: "#10b981" }} />
          )}
        </button>
        <button onClick={handleReset} className="p-0.5 rounded hover:bg-white/10 transition flex-shrink-0"
          title="Сбросить подтверждение" style={{ color: "rgba(255,255,255,0.2)" }}>
          <Icon name="X" size={10} />
        </button>
        {modalOpen && (
          <PaymentConfirmModal
            label={label}
            plannedAmount={plannedAmount}
            existingFact={fact}
            onConfirm={handleConfirmed}
            onClose={() => setModalOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-md transition hover:opacity-80 flex-shrink-0"
        style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)" }}
        title={plannedAmount ? `Подтвердить получение ${Math.round(plannedAmount).toLocaleString("ru-RU")} ₽` : "Подтвердить получение"}>
        <Icon name="CircleDollarSign" size={11} style={{ color: "#f59e0b" }} />
        <span className="text-[10px] font-semibold" style={{ color: "#f59e0b" }}>Получено?</span>
      </button>
      {modalOpen && (
        <PaymentConfirmModal
          label={label}
          plannedAmount={plannedAmount}
          existingFact={null}
          onConfirm={handleConfirmed}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

// ── Модальное окно подтверждения ──────────────────────────────────────────────
function PaymentConfirmModal({
  label,
  plannedAmount,
  existingFact,
  onConfirm,
  onClose,
}: {
  label: string;
  plannedAmount: number | null | undefined;
  existingFact: PaymentFact | null;
  onConfirm: (fact: PaymentFact) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const [amount,    setAmount]    = useState<string>(
    existingFact?.amount
      ? String(Math.round(existingFact.amount))
      : plannedAmount ? String(Math.round(plannedAmount)) : ""
  );
  const [receiptUrl, setReceiptUrl] = useState<string | null>(existingFact?.receiptUrl ?? null);
  const [uploading,  setUploading]  = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isImage = (u: string) => /\.(jpg|jpeg|png|webp|gif)$/i.test(u);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file);
      setReceiptUrl(url);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleConfirm = () => {
    const numAmount = parseFloat(amount) || 0;
    onConfirm({
      confirmed: true,
      amount: numAmount,
      receiptUrl,
      confirmedAt: new Date().toISOString(),
    });
  };

  const diffAmount = plannedAmount && parseFloat(amount)
    ? parseFloat(amount) - plannedAmount
    : null;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div className="w-full max-w-sm rounded-2xl overflow-hidden flex flex-col"
        style={{ background: t.surface, border: `1px solid ${t.border}`, maxHeight: "90dvh" }}>

        {/* Шапка */}
        <div className="flex items-center gap-2.5 px-5 py-4"
          style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(16,185,129,0.15)" }}>
            <Icon name="Wallet" size={16} style={{ color: "#10b981" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold" style={{ color: t.text }}>Подтверждение оплаты</div>
            <div className="text-xs mt-0.5" style={{ color: t.textMute }}>{label}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition"
            style={{ color: t.textMute }}>
            <Icon name="X" size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">

          {/* Сумма */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block"
              style={{ color: t.textMute }}>
              Фактически получено
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number" min={0}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                autoFocus
                className="flex-1 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none transition"
                style={{
                  background: t.surface2,
                  border: `1px solid ${t.border}`,
                  color: t.text,
                  fontSize: 16,
                }}
                placeholder="0"
              />
              <span className="text-sm font-bold flex-shrink-0" style={{ color: t.textMute }}>₽</span>
            </div>

            {/* Плановая сумма и расхождение */}
            {plannedAmount != null && plannedAmount > 0 && (
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[11px]" style={{ color: t.textMute }}>
                  Плановая: {Math.round(plannedAmount).toLocaleString("ru-RU")} ₽
                </span>
                {diffAmount !== null && diffAmount !== 0 && (
                  <span className="text-[11px] font-semibold"
                    style={{ color: diffAmount > 0 ? "#10b981" : "#ef4444" }}>
                    {diffAmount > 0 ? "+" : ""}{Math.round(diffAmount).toLocaleString("ru-RU")} ₽
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Загрузка чека */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block"
              style={{ color: t.textMute }}>
              Чек / подтверждение
            </label>

            {receiptUrl ? (
              <div className="space-y-2">
                {isImage(receiptUrl) ? (
                  <div className="relative group">
                    <img src={receiptUrl} alt="чек"
                      className="w-full rounded-xl object-cover cursor-pointer hover:opacity-90 transition"
                      style={{ maxHeight: 200, border: `1px solid ${t.border}` }}
                      onClick={() => window.open(receiptUrl!, "_blank")} />
                    <button
                      onClick={() => setReceiptUrl(null)}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                      style={{ background: "rgba(0,0,0,0.6)" }}>
                      <Icon name="X" size={12} style={{ color: "#fff" }} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                    style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
                    <Icon name="FileText" size={14} style={{ color: "#a78bfa" }} />
                    <a href={receiptUrl} target="_blank" rel="noreferrer"
                      className="text-xs text-violet-400 underline truncate flex-1 hover:text-violet-300 transition">
                      {receiptUrl.split("/").pop()}
                    </a>
                    <button onClick={() => setReceiptUrl(null)}
                      className="p-0.5 rounded hover:text-red-400 transition flex-shrink-0"
                      style={{ color: t.textMute }}>
                      <Icon name="X" size={12} />
                    </button>
                  </div>
                )}
                <button onClick={() => fileRef.current?.click()}
                  className="text-xs underline transition hover:opacity-70 flex items-center gap-1"
                  style={{ color: t.textMute }}>
                  <Icon name="RefreshCw" size={11} />
                  Заменить файл
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full flex flex-col items-center gap-2 py-6 rounded-xl border-2 border-dashed transition hover:border-emerald-500/50 hover:bg-emerald-500/5 disabled:opacity-50"
                style={{ borderColor: "rgba(255,255,255,0.12)" }}>
                {uploading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                    <span className="text-xs" style={{ color: t.textMute }}>Загрузка...</span>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(16,185,129,0.1)" }}>
                      <Icon name="Upload" size={18} style={{ color: "#10b981" }} />
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-semibold" style={{ color: "#10b981" }}>Загрузить чек</div>
                      <div className="text-[10px] mt-0.5" style={{ color: t.textMute }}>
                        Фото, скриншот или PDF
                      </div>
                    </div>
                  </>
                )}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />
          </div>

        </div>

        {/* Кнопки */}
        <div className="flex gap-2 px-5 pb-5 pt-3 flex-shrink-0"
          style={{ borderTop: `1px solid ${t.border}` }}>
          <button
            onClick={handleConfirm}
            disabled={!amount || parseFloat(amount) <= 0}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: "#10b981" }}>
            <Icon name="CheckCircle2" size={15} />
            Подтвердить получение
          </button>
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm transition"
            style={{ background: t.surface2, color: t.textMute }}>
            Отмена
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
