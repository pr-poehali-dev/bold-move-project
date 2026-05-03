import { useState } from "react";
import Icon from "@/components/ui/icon";
import {
  RiskSettings, ThemeClasses,
  AI_PROMPT_KEY, DEFAULT_AI_PROMPT,
  loadAiPrompt, saveAiPrompt,
} from "./discountRiskTypes";

interface Props {
  s: RiskSettings;
  isDark: boolean;
  theme: ThemeClasses;
  readOnly: boolean;
  update: (patch: Partial<RiskSettings>) => void;
}

export default function DiscountRiskThresholds({ s, isDark, theme, readOnly, update }: Props) {
  const [aiPrompt,    setAiPrompt]   = useState(loadAiPrompt);
  const [promptSaved, setPromptSaved] = useState(false);
  const [promptOpen,  setPromptOpen]  = useState(false);

  const savePrompt = () => {
    saveAiPrompt(aiPrompt);
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 2000);
  };

  const resetPrompt = () => {
    setAiPrompt(DEFAULT_AI_PROMPT);
  };

  // Синхронизация если промт изменился снаружи
  const handleAiPromptChange = (val: string) => {
    setAiPrompt(val);
    setPromptSaved(false);
    void AI_PROMPT_KEY; // keep import used
  };

  return (
    <>
      {/* Настройки порогов */}
      <div className={`rounded-2xl p-4 ${theme.bg} border ${theme.border} space-y-4`}>
        <div className="flex items-center gap-2 mb-1">
          <Icon name="Sliders" size={14} style={{ color: "#8b5cf6" }} />
          <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-violet-300" : "text-violet-600"}`}>
            Пороги скидки
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "#ef4444" }}>
              Максимум (абсолютный запрет)
            </label>
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={99} disabled={readOnly}
                value={s.max_discount} onChange={e => update({ max_discount: Number(e.target.value) })}
                className={theme.inputCls} style={{ borderColor: "#ef444440" }} />
              <span className={`text-sm font-bold ${theme.sub}`}>%</span>
            </div>
            <p className={`text-[10px] mt-1 ${theme.sub}`}>Выше этой скидки система заблокирует применение</p>
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "#f59e0b" }}>
              Порог среднего риска
            </label>
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={s.max_discount - 1} disabled={readOnly}
                value={s.mid_risk_threshold} onChange={e => update({ mid_risk_threshold: Number(e.target.value) })}
                className={theme.inputCls} style={{ borderColor: "#f59e0b40" }} />
              <span className={`text-sm font-bold ${theme.sub}`}>%</span>
            </div>
            <p className={`text-[10px] mt-1 ${theme.sub}`}>Выше — высокий риск (красная зона)</p>
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "#10b981" }}>
              Порог низкого риска
            </label>
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={s.mid_risk_threshold - 1} disabled={readOnly}
                value={s.low_risk_threshold} onChange={e => update({ low_risk_threshold: Number(e.target.value) })}
                className={theme.inputCls} style={{ borderColor: "#10b98140" }} />
              <span className={`text-sm font-bold ${theme.sub}`}>%</span>
            </div>
            <p className={`text-[10px] mt-1 ${theme.sub}`}>До этого значения — безопасная зона</p>
          </div>
        </div>
      </div>

      {/* Настройки маржи */}
      <div className={`rounded-2xl p-4 ${theme.bg} border ${theme.border} space-y-4`}>
        <div className="flex items-center gap-2 mb-1">
          <Icon name="TrendingDown" size={14} style={{ color: "#8b5cf6" }} />
          <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-violet-300" : "text-violet-600"}`}>
            Защита маржи
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 block ${theme.text}`}>
              Минимальная маржа (стоп)
            </label>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={50} disabled={readOnly}
                value={s.min_margin} onChange={e => update({ min_margin: Number(e.target.value) })}
                className={theme.inputCls} />
              <span className={`text-sm font-bold ${theme.sub}`}>%</span>
            </div>
            <p className={`text-[10px] mt-1 ${theme.sub}`}>Скидка не применится если маржа упадёт ниже</p>
          </div>
          <div>
            <label className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 block ${theme.text}`}>
              Маржа — порог предупреждения
            </label>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={50} disabled={readOnly}
                value={s.warn_margin} onChange={e => update({ warn_margin: Number(e.target.value) })}
                className={theme.inputCls} />
              <span className={`text-sm font-bold ${theme.sub}`}>%</span>
            </div>
            <p className={`text-[10px] mt-1 ${theme.sub}`}>Ниже этого значения — жёлтое предупреждение в блоке</p>
          </div>
        </div>

        {/* Переключатели */}
        <div className="space-y-3 pt-1">
          {[
            { key: "allow_zero_margin" as const, label: "Разрешить скидки вплоть до нулевой маржи", desc: "Если выключено — скидки до нуля заблокированы", color: "#f59e0b" },
            { key: "require_approval" as const,  label: "Требовать одобрение для высокого риска",   desc: "Скидки в красной зоне потребуют подтверждения", color: "#ef4444" },
          ].map(row => (
            <div key={row.key} className="flex items-start gap-3">
              <button disabled={readOnly} onClick={() => update({ [row.key]: !s[row.key] })}
                className={`flex-shrink-0 w-9 h-5 rounded-full transition relative ${s[row.key] ? "bg-violet-500" : isDark ? "bg-white/10" : "bg-gray-200"}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${s[row.key] ? "left-4" : "left-0.5"}`} />
              </button>
              <div>
                <div className={`text-xs font-semibold ${theme.text}`}>{row.label}</div>
                <div className={`text-[10px] mt-0.5 ${theme.sub}`}>{row.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Комментарий для одобрения */}
      {s.require_approval && (
        <div className={`rounded-2xl p-4 ${theme.bg} border ${theme.border}`}>
          <label className={`text-[10px] font-semibold uppercase tracking-wider mb-2 block ${theme.text}`}>
            Сообщение при запросе одобрения
          </label>
          <textarea disabled={readOnly} rows={2}
            value={s.approval_note} onChange={e => update({ approval_note: e.target.value })}
            className={`${theme.inputCls} resize-none`}
            placeholder="Текст который увидит менеджер при запросе одобрения скидки..." />
        </div>
      )}

      {/* Управление логикой AI */}
      <div className={`rounded-2xl overflow-hidden ${theme.bg} border ${theme.border}`}>
        <button
          onClick={() => setPromptOpen(v => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 text-left transition hover:bg-white/[0.02]">
          <Icon name="Sparkles" size={14} style={{ color: "#a78bfa" }} />
          <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-violet-300" : "text-violet-600"} flex-1`}>
            Управление логикой AI
          </span>
          <span className={`text-[9px] ${theme.sub} mr-2`}>Промт для оценки риска скидки</span>
          <Icon name={promptOpen ? "ChevronUp" : "ChevronDown"} size={13} style={{ color: isDark ? "rgba(255,255,255,0.3)" : "#9ca3af" }} />
        </button>

        {promptOpen && (
          <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb"}` }}>
            <p className={`text-[10px] mt-3 ${theme.sub}`}>
              Этот промт отправляется в AI при нажатии "Оценить AI" в блоке оценки риска скидки.
              AI получит этот текст + список позиций сметы + максимальную скидку.
            </p>
            <textarea
              disabled={readOnly}
              rows={10}
              value={aiPrompt}
              onChange={e => handleAiPromptChange(e.target.value)}
              className={`w-full rounded-xl px-3 py-2.5 text-xs font-mono outline-none transition resize-none ${
                isDark
                  ? "bg-white/[0.04] border border-white/10 text-white/75 focus:border-violet-500/50"
                  : "bg-gray-50 border border-gray-200 text-gray-700 focus:border-violet-400"
              }`}
              placeholder="Промт для AI оценки риска..."
            />
            {!readOnly && (
              <div className="flex items-center gap-2">
                <button onClick={savePrompt}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition hover:opacity-80"
                  style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
                  <Icon name={promptSaved ? "Check" : "Save"} size={12} />
                  {promptSaved ? "Сохранено" : "Сохранить промт"}
                </button>
                <button onClick={resetPrompt}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition hover:opacity-80 ${theme.sub}`}
                  style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb"}` }}>
                  <Icon name="RotateCcw" size={12} />
                  Сбросить к дефолту
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
