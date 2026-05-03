import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { uploadFile, crmFetch, Client } from "./crmApi";

export type PaymentField = "prepayment" | "extra_payment";

// ── Определяем поля confirmed по типу ────────────────────────────────────────
const CONFIRMED_FIELDS: Record<PaymentField, {
  confirmed: keyof Client;
  confirmed_at: keyof Client;
  fact: keyof Client;
}> = {
  prepayment: {
    confirmed:    "prepayment_confirmed",
    confirmed_at: "prepayment_confirmed_at",
    fact:         "prepayment_fact",
  },
  extra_payment: {
    confirmed:    "extra_payment_confirmed",
    confirmed_at: "extra_payment_confirmed_at",
    fact:         "extra_payment_fact",
  },
};

// ── Кнопка-индикатор рядом со строкой ────────────────────────────────────────
export function PaymentStatusBadge({
  client,
  field,
  plannedAmount,
  label,
  onConfirmed,
}: {
  client: Client;
  field: PaymentField;
  plannedAmount: number | null | undefined;
  label: string;
  onConfirmed?: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const fields = CONFIRMED_FIELDS[field];

  const isConfirmed = !!client[fields.confirmed];
  const factAmount  = Number(client[fields.fact]) || 0;
  const receiptUrl  = null; // чек пока только в модале

  const handleConfirmed = async (amount: number, receipt: string | null) => {
    setSaving(true);
    try {
      await crmFetch("clients", {
        method: "PUT",
        body: JSON.stringify({
          [fields.confirmed]:    true,
          [fields.confirmed_at]: new Date().toISOString(),
          [fields.fact]:         amount,
        }),
      }, { id: String(client.id) });
      onConfirmed?.();
    } finally {
      setSaving(false);
      setModalOpen(false);
    }
  };

  const handleReset = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    try {
      await crmFetch("clients", {
        method: "PUT",
        body: JSON.stringify({
          [fields.confirmed]:    false,
          [fields.confirmed_at]: null,
          [fields.fact]:         null,
        }),
      }, { id: String(client.id) });
      onConfirmed?.();
    } finally {
      setSaving(false);
    }
  };

  if (isConfirmed) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          disabled={saving}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded-md transition hover:opacity-80 flex-shrink-0"
          style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}
          title="Оплата подтверждена — нажмите чтобы изменить">
          <Icon name="CheckCircle2" size={11} style={{ color: "#10b981" }} />
          <span className="text-[10px] font-bold" style={{ color: "#10b981" }}>
            {factAmount > 0 ? Math.round(factAmount).toLocaleString("ru-RU") + " ₽" : "Получено"}
          </span>
        </button>
        <button onClick={handleReset} disabled={saving}
          className="p-0.5 rounded hover:bg-white/10 transition flex-shrink-0"
          title="Сбросить подтверждение" style={{ color: "rgba(255,255,255,0.2)" }}>
          <Icon name="X" size={10} />
        </button>
        {modalOpen && (
          <PaymentConfirmModal
            label={label}
            plannedAmount={plannedAmount}
            existingAmount={factAmount}
            existingReceipt={receiptUrl}
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
        disabled={saving}
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
          existingAmount={null}
          existingReceipt={null}
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
  existingAmount,
  existingReceipt,
  onConfirm,
  onClose,
}: {
  label: string;
  plannedAmount: number | null | undefined;
  existingAmount: number | null;
  existingReceipt: string | null;
  onConfirm: (amount: number, receipt: string | null) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const [amount,     setAmount]     = useState<string>(
    existingAmount ? String(Math.round(existingAmount))
    : plannedAmount ? String(Math.round(plannedAmount)) : ""
  );
  const [receiptUrl, setReceiptUrl] = useState<string | null>(existingReceipt);
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
                style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text, fontSize: 16 }}
                placeholder="0"
              />
              <span className="text-sm font-bold flex-shrink-0" style={{ color: t.textMute }}>₽</span>
            </div>
            {plannedAmount != null && plannedAmount > 0 && (
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[11px]" style={{ color: t.textMute }}>
                  Плановая: {Math.round(plannedAmount).toLocaleString("ru-RU")} ₽
                </span>
                {diffAmount !== null && Math.abs(diffAmount) > 0 && (
                  <span className="text-[11px] font-bold"
                    style={{ color: diffAmount > 0 ? "#10b981" : "#ef4444" }}>
                    {diffAmount > 0 ? "+" : ""}{Math.round(diffAmount).toLocaleString("ru-RU")} ₽
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Чек */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block"
              style={{ color: t.textMute }}>
              Квитанция / чек (необязательно)
            </label>
            {receiptUrl ? (
              <div className="relative rounded-xl overflow-hidden"
                style={{ border: `1px solid ${t.border}` }}>
                {isImage(receiptUrl) ? (
                  <img src={receiptUrl} alt="Чек" className="w-full max-h-40 object-cover" />
                ) : (
                  <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2.5 hover:opacity-80 transition"
                    style={{ color: "#60a5fa" }}>
                    <Icon name="FileText" size={14} />
                    <span className="text-xs font-medium truncate">Открыть документ</span>
                  </a>
                )}
                <button onClick={() => setReceiptUrl(null)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center hover:opacity-80 transition"
                  style={{ background: "rgba(0,0,0,0.6)" }}>
                  <Icon name="X" size={12} style={{ color: "#fff" }} />
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition hover:opacity-80 disabled:opacity-50"
                style={{ background: t.surface2, border: `1px dashed ${t.border}`, color: t.textMute }}>
                {uploading
                  ? <><div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Загрузка...</>
                  : <><Icon name="Upload" size={14} /> Прикрепить чек</>
                }
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />
          </div>
        </div>

        {/* Футер */}
        <div className="px-5 py-4 flex gap-2" style={{ borderTop: `1px solid ${t.border}` }}>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition hover:opacity-80"
            style={{ background: t.surface2, color: t.textMute }}>
            Отмена
          </button>
          <button
            onClick={() => onConfirm(parseFloat(amount) || 0, receiptUrl)}
            disabled={!amount || parseFloat(amount) <= 0}
            className="flex-2 flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold transition hover:opacity-90 disabled:opacity-40"
            style={{ background: "#10b981", color: "#fff", flex: 2 }}>
            <Icon name="CheckCircle2" size={14} />
            Подтвердить получение
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Кнопка «Получено?» для кастомных строк (localStorage) ────────────────────
const LS_CUSTOM = "crm_custom_payment_fact_";

interface CustomFact { confirmed: boolean; amount: number; confirmedAt: string; }

function loadCustomFact(clientId: number, key: string): CustomFact | null {
  try { return JSON.parse(localStorage.getItem(`${LS_CUSTOM}${clientId}_${key}`) || "null"); } catch { return null; }
}
function saveCustomFact(clientId: number, key: string, f: CustomFact) {
  localStorage.setItem(`${LS_CUSTOM}${clientId}_${key}`, JSON.stringify(f));
}
function clearCustomFact(clientId: number, key: string) {
  localStorage.removeItem(`${LS_CUSTOM}${clientId}_${key}`);
}

export function CustomPaymentBadge({ clientId, rowKey, plannedAmount, label }: {
  clientId: number;
  rowKey: string;
  plannedAmount?: number | null;
  label: string;
}) {
  const [fact, setFact]         = useState<CustomFact | null>(() => loadCustomFact(clientId, rowKey));
  const [modalOpen, setModalOpen] = useState(false);

  const handleConfirm = (amount: number) => {
    const f: CustomFact = { confirmed: true, amount, confirmedAt: new Date().toISOString() };
    saveCustomFact(clientId, rowKey, f);
    setFact(f);
    setModalOpen(false);
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearCustomFact(clientId, rowKey);
    setFact(null);
  };

  if (fact?.confirmed) {
    return (
      <>
        <button onClick={() => setModalOpen(true)}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded-md transition hover:opacity-80 flex-shrink-0"
          style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>
          <Icon name="CheckCircle2" size={11} style={{ color: "#10b981" }} />
          <span className="text-[10px] font-bold" style={{ color: "#10b981" }}>
            {fact.amount > 0 ? Math.round(fact.amount).toLocaleString("ru-RU") + " ₽" : "Получено"}
          </span>
        </button>
        <button onClick={handleReset} className="p-0.5 rounded hover:bg-white/10 transition flex-shrink-0"
          style={{ color: "rgba(255,255,255,0.2)" }}>
          <Icon name="X" size={10} />
        </button>
        {modalOpen && (
          <PaymentConfirmModal label={label} plannedAmount={plannedAmount}
            existingAmount={fact.amount} existingReceipt={null}
            onConfirm={handleConfirm} onClose={() => setModalOpen(false)} />
        )}
      </>
    );
  }

  return (
    <>
      <button onClick={() => setModalOpen(true)}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-md transition hover:opacity-80 flex-shrink-0"
        style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)" }}>
        <Icon name="CircleDollarSign" size={11} style={{ color: "#f59e0b" }} />
        <span className="text-[10px] font-semibold" style={{ color: "#f59e0b" }}>Получено?</span>
      </button>
      {modalOpen && (
        <PaymentConfirmModal label={label} plannedAmount={plannedAmount}
          existingAmount={null} existingReceipt={null}
          onConfirm={handleConfirm} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}