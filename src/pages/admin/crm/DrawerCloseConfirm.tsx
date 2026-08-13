import { useState } from "react";
import Icon from "@/components/ui/icon";
import { ThemeCtx } from "./themeContext";
import { DateTimePickerInner } from "./DateTimePicker";
import { stageDateRule } from "./stageDateRules";

// Какое поле комментария (из блока «Комментарий» карточки клиента) относится к
// текущему этапу воронки — чтобы менеджер мог сразу дописать пару слов по делу,
// не открывая отдельно карточку и не листая блоки.
const STAGE_COMMENT_FIELD: Record<string, { key: "comment_order" | "comment_measure" | "comment_install"; label: string }> = {
  new:                { key: "comment_order",   label: "Комментарий к заявке" },
  call:               { key: "comment_order",   label: "Комментарий к заявке" },
  measure:            { key: "comment_measure", label: "Комментарий к замеру" },
  measured:           { key: "comment_measure", label: "Комментарий к замеру" },
  contract:           { key: "comment_install", label: "Комментарий к монтажу" },
  prepaid:            { key: "comment_install", label: "Комментарий к монтажу" },
  install_scheduled:  { key: "comment_install", label: "Комментарий к монтажу" },
  install_done:       { key: "comment_install", label: "Комментарий к монтажу" },
  extra_paid:         { key: "comment_install", label: "Комментарий к монтажу" },
};

interface Props {
  t: ThemeCtx;
  /** Текущее значение даты следующего звонка — пикер откроется уже с ним */
  currentNextCall: string | null | undefined;
  currentNoCallNeeded: boolean | undefined;
  /** Текущий статус заявки — определяет, к какому этапу относится поле комментария ниже */
  currentStatus?: string;
  /** Текущий текст комментария нужного этапа — поле откроется уже с ним, можно дописать/отредактировать */
  currentStageComment?: string | null;
  /** Текущая дата этапа (замера/монтажа), если статус её требует. Пустая — закрыть карточку нельзя. */
  currentStageDate?: string | null;
  /** Сохранить выбор (next_call_date и/или no_call_needed, и опционально комментарий/дату этапа) и закрыть карточку */
  onConfirm: (patch: {
    next_call_date: string | null; no_call_needed: boolean;
    comment_order?: string; comment_measure?: string; comment_install?: string;
    measure_date?: string; install_date?: string;
  }) => void;
  onCancel: () => void;
}

// Модалка «когда позвоним клиенту в следующий раз» — показывается ПРИ КАЖДОЙ
// попытке закрыть карточку заявки (крестиком), чтобы менеджер каждый раз явно
// подтвердил или поправил дату следующего звонка (или отметил, что звонить не нужно).
// Кнопка «Сохранить и закрыть» доступна ВСЕГДА (даже без изменений) — по умолчанию
// сохраняется уже подставленное текущее значение даты/чекбокса.
export function DrawerCloseConfirm({ t, currentNextCall, currentNoCallNeeded, currentStatus, currentStageComment, currentStageDate, onConfirm, onCancel }: Props) {
  const [noCall, setNoCall] = useState(!!currentNoCallNeeded);
  const [nextCall, setNextCall] = useState<string | null>(currentNextCall ?? null);
  const [comment, setComment] = useState(currentStageComment || "");
  const [stageDate, setStageDate] = useState<string | null>(currentStageDate ?? null);

  const stageField = currentStatus ? STAGE_COMMENT_FIELD[currentStatus] : undefined;
  // Если заявка стоит на этапе «замер/монтаж назначен», а даты нет — закрыть
  // карточку нельзя, пока дату не поставят (то же правило и на сервере).
  const dateRule = stageDateRule(currentStatus);
  const dateMissing = !!dateRule && !stageDate;

  const handleSave = () => {
    if (dateMissing) return;
    const patch: {
      next_call_date: string | null; no_call_needed: boolean;
      comment_order?: string; comment_measure?: string; comment_install?: string;
      measure_date?: string; install_date?: string;
    } = {
      next_call_date: noCall ? null : nextCall,
      no_call_needed: noCall,
    };
    if (stageField && comment !== (currentStageComment || "")) {
      patch[stageField.key] = comment;
    }
    if (dateRule && stageDate && stageDate !== (currentStageDate || "")) {
      patch[dateRule.field] = stageDate;
    }
    onConfirm(patch);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[70] bg-black/60 p-4" onClick={onCancel}>
      <div className="rounded-2xl w-full max-w-[400px] shadow-2xl overflow-hidden"
        style={{ background: t.surface, border: "1px solid rgba(124,58,237,0.3)" }}
        onClick={e => e.stopPropagation()}>

        <div className="px-4 pt-4 pb-2 flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(124,58,237,0.15)" }}>
            <Icon name="PhoneCall" size={15} style={{ color: "#a78bfa" }} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold" style={{ color: t.text }}>Когда позвоним клиенту?</h3>
            <p className="text-[11px] mt-0.5" style={{ color: t.textMute }}>
              Подтвердите или измените дату следующего звонка
            </p>
          </div>
        </div>

        {/* Чекбокс «звонить не нужно» */}
        <div className="px-4 pb-1.5">
          <label className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg cursor-pointer transition"
            style={{ background: noCall ? "rgba(16,185,129,0.1)" : t.surface2, border: `1px solid ${noCall ? "rgba(16,185,129,0.35)" : t.border}` }}>
            <input type="checkbox" checked={noCall} onChange={e => setNoCall(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-emerald-500 flex-shrink-0" />
            <span className="text-xs font-semibold" style={{ color: noCall ? "#10b981" : t.textSub }}>
              Звонить клиенту не нужно
            </span>
          </label>
        </div>

        {/* Пикер даты/времени — активен только если чекбокс не отмечен */}
        <div className="px-4" style={{ opacity: noCall ? 0.35 : 1, pointerEvents: noCall ? "none" : "auto", transition: "opacity 0.15s" }}>
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
            <DateTimePickerInner value={nextCall} onChange={setNextCall} hideDelete compact />
          </div>
        </div>

        {/* Дата этапа (замер/монтаж) — обязательна, пока не заполнена, закрыть нельзя */}
        {dateRule && (
          <div className="px-4 pt-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon name={dateRule.icon} size={11} style={{ color: dateRule.color }} />
              <span className="text-xs font-semibold" style={{ color: dateRule.color }}>
                {dateRule.field === "measure_date" ? "Дата замера" : "Дата монтажа"}
              </span>
              {dateMissing && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: "#ef444422", color: "#ef4444" }}>
                  обязательно
                </span>
              )}
            </div>
            <div className="rounded-xl overflow-hidden"
              style={{ border: `1px solid ${dateMissing ? "#ef444470" : t.border}` }}>
              <DateTimePickerInner value={stageDate} onChange={setStageDate} hideDelete compact />
            </div>
          </div>
        )}

        {/* Комментарий к текущему этапу заявки — дозаполняется прямо тут, без похода в карточку клиента */}
        {stageField && (
          <div className="px-4 pt-2.5">
            <label className="text-xs mb-1 block" style={{ color: "#d4d4d4" }}>{stageField.label}</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Добавить комментарий..." rows={2}
              className="w-full rounded-lg px-2.5 py-1.5 text-xs focus:outline-none resize-none transition"
              style={{ background: t.surface2, border: `1px solid ${t.border}`, color: "#fff" }}
            />
          </div>
        )}

        {/* Кнопки. «Сохранить и закрыть» доступна всегда, кроме случая, когда
            этап требует даты (замер/монтаж), а она не заполнена. */}
        <div className="flex gap-2 px-4 pt-3 pb-4 mt-1">
          <button onClick={onCancel}
            className="flex-1 py-2 text-sm rounded-xl font-semibold transition"
            style={{ background: t.surface2, color: t.textSub }}>
            Отмена
          </button>
          <button onClick={handleSave} disabled={dateMissing}
            title={dateMissing ? "Сначала укажите дату этапа" : undefined}
            className="flex-1 py-2 text-sm rounded-xl font-bold transition disabled:opacity-40"
            style={{ background: "#7c3aed", color: "#fff" }}>
            Сохранить и закрыть
          </button>
        </div>
      </div>
    </div>
  );
}