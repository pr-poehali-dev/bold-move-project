import { useState } from "react";
import Icon from "@/components/ui/icon";
import { ThemeCtx } from "./themeContext";
import { DateTimePickerInner } from "./DateTimePicker";

interface Props {
  t: ThemeCtx;
  /** Текущее значение даты следующего звонка — пикер откроется уже с ним */
  currentNextCall: string | null | undefined;
  currentNoCallNeeded: boolean | undefined;
  /** Сохранить выбор (next_call_date и/или no_call_needed) и закрыть карточку */
  onConfirm: (patch: { next_call_date: string | null; no_call_needed: boolean }) => void;
  onCancel: () => void;
}

// Модалка «когда позвоним клиенту в следующий раз» — показывается ПРИ КАЖДОЙ
// попытке закрыть карточку заявки (крестиком), чтобы менеджер каждый раз явно
// подтвердил или поправил дату следующего звонка (или отметил, что звонить не нужно).
export function DrawerCloseConfirm({ t, currentNextCall, currentNoCallNeeded, onConfirm, onCancel }: Props) {
  const [noCall, setNoCall] = useState(!!currentNoCallNeeded);
  const [nextCall, setNextCall] = useState<string | null>(currentNextCall ?? null);

  const canSave = noCall || !!nextCall;

  const handleSave = () => {
    if (!canSave) return;
    onConfirm({
      next_call_date: noCall ? null : nextCall,
      no_call_needed: noCall,
    });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[70] bg-black/60 p-4" onClick={onCancel}>
      <div className="rounded-2xl w-full max-w-[400px] shadow-2xl overflow-hidden"
        style={{ background: t.surface, border: "1px solid rgba(124,58,237,0.3)" }}
        onClick={e => e.stopPropagation()}>

        <div className="px-5 pt-5 pb-3 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(124,58,237,0.15)" }}>
            <Icon name="PhoneCall" size={18} style={{ color: "#a78bfa" }} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold" style={{ color: t.text }}>Когда позвоним клиенту?</h3>
            <p className="text-xs mt-0.5" style={{ color: t.textMute }}>
              Подтвердите или измените дату следующего звонка
            </p>
          </div>
        </div>

        {/* Чекбокс «звонить не нужно» */}
        <div className="px-5 pb-2">
          <label className="flex items-center gap-2.5 py-2 px-3 rounded-xl cursor-pointer transition"
            style={{ background: noCall ? "rgba(16,185,129,0.1)" : t.surface2, border: `1px solid ${noCall ? "rgba(16,185,129,0.35)" : t.border}` }}>
            <input type="checkbox" checked={noCall} onChange={e => setNoCall(e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-500 flex-shrink-0" />
            <span className="text-xs font-semibold" style={{ color: noCall ? "#10b981" : t.textSub }}>
              Звонить клиенту не нужно
            </span>
          </label>
        </div>

        {/* Пикер даты/времени — активен только если чекбокс не отмечен */}
        <div className="px-5" style={{ opacity: noCall ? 0.35 : 1, pointerEvents: noCall ? "none" : "auto", transition: "opacity 0.15s" }}>
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
            <DateTimePickerInner value={nextCall} onChange={setNextCall} hideDelete />
          </div>
        </div>

        {/* Кнопки */}
        <div className="flex gap-2 px-5 py-4 mt-1">
          <button onClick={onCancel}
            className="flex-1 py-2.5 text-sm rounded-xl font-semibold transition"
            style={{ background: t.surface2, color: t.textSub }}>
            Отмена
          </button>
          <button onClick={handleSave} disabled={!canSave}
            className="flex-1 py-2.5 text-sm rounded-xl font-bold transition disabled:opacity-40"
            style={{ background: "#7c3aed", color: "#fff" }}>
            Сохранить и закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
