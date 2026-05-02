import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

const LS_KEY              = "discount_risk_settings";
const AI_PROMPT_KEY       = "discount_risk_ai_prompt";
const COMPLEXITY_LS_KEY   = "discount_complexity_settings";
const COMPLEXITY_PROMPTS_KEY = "discount_complexity_prompts";
const COMPLEXITY_FORMULA_KEY = "discount_complexity_formula";

const DEFAULT_AI_PROMPT = `Ты эксперт по монтажу натяжных потолков. Оцени сложность монтажа по позициям сметы и рекомендуй оптимальную скидку клиенту.

Критерии оценки:
- Простой объект (прямоугольник, одно полотно, без ниш) → низкий риск, скидка ближе к максимуму
- Средний объект (несколько полотен, 1-2 ниши, парящий потолок) → средний риск
- Сложный объект (многоуровневый, сложные ниши, много закладных, большая площадь) → высокий риск, минимальная скидка

Чем сложнее монтаж → тем выше риск непредвиденных затрат → тем меньше можно давать скидку.`;

function loadAiPrompt(): string {
  return localStorage.getItem(AI_PROMPT_KEY) || DEFAULT_AI_PROMPT;
}

function saveAiPrompt(p: string) {
  localStorage.setItem(AI_PROMPT_KEY, p);
  window.dispatchEvent(new StorageEvent("storage", { key: AI_PROMPT_KEY, newValue: p }));
}

interface RiskSettings {
  max_discount: number;        // Максимально допустимая скидка (абсолютный потолок)
  low_risk_threshold: number;  // До этого % — низкий риск (зелёная зона)
  mid_risk_threshold: number;  // До этого % — средний риск (жёлтая), выше — высокий (красный)
  min_margin: number;          // Минимальная маржа которую нельзя пробивать
  warn_margin: number;         // При марже ниже этого — предупреждение
  allow_zero_margin: boolean;  // Разрешить скидки до нулевой маржи
  require_approval: boolean;   // Скидки выше mid_risk требуют одобрения
  approval_note: string;       // Комментарий для менеджера при запросе одобрения
}

const DEFAULT: RiskSettings = {
  max_discount: 30,
  low_risk_threshold: 10,
  mid_risk_threshold: 20,
  min_margin: 5,
  warn_margin: 15,
  allow_zero_margin: false,
  require_approval: false,
  approval_note: "Для скидки выше среднего порога требуется одобрение руководителя",
};

function load(): RiskSettings {
  try {
    const s = localStorage.getItem(LS_KEY);
    return s ? { ...DEFAULT, ...JSON.parse(s) } : DEFAULT;
  } catch { return DEFAULT; }
}

// ---- Сложность позиций ----
interface PriceItem {
  id: number;
  name: string;
  unit: string;
  category: string;
}

interface ComplexityItem {
  priceId: number;
  complexity: number; // 1-10
  weight: number;     // 1-10
}

interface ComplexityPrompts {
  math: string;
  semantic: string;
  combine: string;
}

const DEFAULT_FORMULA = "Σ(сложность × вес × кол-во) / Σ(вес × кол-во)";

const DEFAULT_COMPLEXITY_PROMPTS: ComplexityPrompts = {
  math: `Ты аналитик. Тебе дан список позиций монтажа с их удельным весом сложности (число от 1 до 10, посчитанное по формуле взвешенного среднего).
Итоговая математическая оценка сложности объекта: {math_score}/10.
Дай краткий вывод: что означает эта цифра для данного объекта, какие позиции доминируют. Только факты, без рекомендаций по скидке.`,
  semantic: `Ты эксперт по монтажу натяжных потолков. Тебе дан список позиций сметы:
{items}
Оцени семантически: насколько сложен этот объект с точки зрения монтажа? Есть ли рискованные комбинации позиций? Что может пойти не так? Дай вывод от 1 до 10 и объяснение.`,
  combine: `Ты руководитель производства. У тебя два независимых анализа объекта:

МАТЕМАТИЧЕСКИЙ АНАЛИЗ:
{math_result}

СЕМАНТИЧЕСКИЙ АНАЛИЗ AI:
{semantic_result}

На основе обоих анализов:
1. Дай итоговую оценку сложности объекта от 1 до 10
2. Рекомендуй скидку от 0 до {max_discount}% (чем сложнее — тем меньше скидка)
3. Дай краткое объяснение для менеджера (2-3 предложения)

Ответь строго в JSON: {"score": 7, "recommended_discount": 5, "level": "high", "summary": "текст"}`,
};

function loadComplexityItems(): Record<number, ComplexityItem> {
  try {
    const s = localStorage.getItem(COMPLEXITY_LS_KEY);
    return s ? JSON.parse(s) : {};
  } catch { return {}; }
}

function saveComplexityItems(items: Record<number, ComplexityItem>) {
  localStorage.setItem(COMPLEXITY_LS_KEY, JSON.stringify(items));
}

function loadComplexityPrompts(): ComplexityPrompts {
  try {
    const s = localStorage.getItem(COMPLEXITY_PROMPTS_KEY);
    return s ? { ...DEFAULT_COMPLEXITY_PROMPTS, ...JSON.parse(s) } : DEFAULT_COMPLEXITY_PROMPTS;
  } catch { return DEFAULT_COMPLEXITY_PROMPTS; }
}

function loadFormula(): string {
  return localStorage.getItem(COMPLEXITY_FORMULA_KEY) || DEFAULT_FORMULA;
}

interface Props { isDark?: boolean; readOnly?: boolean; }

export default function TabDiscountRisk({ isDark = true, readOnly = false }: Props) {
  const [s,           setS]          = useState<RiskSettings>(load);
  const [saved,       setSaved]      = useState(false);
  const [aiPrompt,    setAiPrompt]   = useState(loadAiPrompt);
  const [promptSaved, setPromptSaved] = useState(false);
  const [promptOpen,  setPromptOpen]  = useState(false);

  // Сложность позиций
  const [complexityOpen,    setComplexityOpen]    = useState(false);
  const [prices,            setPrices]            = useState<PriceItem[]>([]);
  const [pricesLoading,     setPricesLoading]     = useState(false);
  const [complexityItems,   setComplexityItems]   = useState<Record<number, ComplexityItem>>(loadComplexityItems);
  const [complexityPrompts, setComplexityPrompts] = useState<ComplexityPrompts>(loadComplexityPrompts);
  const [formula,           setFormula]           = useState(loadFormula);
  const [complexitySaved,   setComplexitySaved]   = useState(false);
  const [activePromptTab,   setActivePromptTab]   = useState<"math" | "semantic" | "combine">("math");
  const [categoryFilter,    setCategoryFilter]    = useState<string>("all");

  const loadPrices = useCallback(async () => {
    if (prices.length > 0) return;
    setPricesLoading(true);
    try {
      const func2url = await import("@/../../backend/func2url.json");
      const url = (func2url as Record<string, string>)["get-prices"];
      const res = await fetch(url).then(r => r.json());
      setPrices(res.prices || []);
    } catch {
      setPrices([]);
    } finally {
      setPricesLoading(false);
    }
  }, [prices.length]);

  useEffect(() => {
    if (complexityOpen) loadPrices();
  }, [complexityOpen, loadPrices]);

  const getItem = (id: number): ComplexityItem =>
    complexityItems[id] || { priceId: id, complexity: 5, weight: 5 };

  const updateItem = (id: number, patch: Partial<ComplexityItem>) => {
    setComplexityItems(prev => {
      const next = { ...prev, [id]: { ...getItem(id), ...patch } };
      saveComplexityItems(next);
      return next;
    });
  };

  const saveComplexity = () => {
    localStorage.setItem(COMPLEXITY_PROMPTS_KEY, JSON.stringify(complexityPrompts));
    localStorage.setItem(COMPLEXITY_FORMULA_KEY, formula);
    window.dispatchEvent(new StorageEvent("storage", { key: COMPLEXITY_LS_KEY }));
    setComplexitySaved(true);
    setTimeout(() => setComplexitySaved(false), 2000);
  };

  const categories = ["all", ...Array.from(new Set(prices.map(p => p.category).filter(Boolean)))];
  const filteredPrices = categoryFilter === "all" ? prices : prices.filter(p => p.category === categoryFilter);

  useEffect(() => { setSaved(false); }, [s]);

  const update = (patch: Partial<RiskSettings>) => setS(prev => ({ ...prev, ...patch }));

  const savePrompt = () => {
    saveAiPrompt(aiPrompt);
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 2000);
  };

  const resetPrompt = () => {
    setAiPrompt(DEFAULT_AI_PROMPT);
  };

  const save = () => {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
    // Уведомляем другие компоненты об изменении (storage event не срабатывает в той же вкладке)
    window.dispatchEvent(new StorageEvent("storage", { key: LS_KEY, newValue: JSON.stringify(s) }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const border   = isDark ? "border-white/10"   : "border-gray-200";
  const bg       = isDark ? "bg-white/[0.03]"   : "bg-white";
  const text     = isDark ? "text-white/80"      : "text-gray-800";
  const sub      = isDark ? "text-white/40"      : "text-gray-500";
  const inputCls = `w-full rounded-lg px-3 py-2 text-sm outline-none transition ${isDark ? "bg-white/[0.06] border border-white/10 text-white/80 focus:border-violet-500/50" : "bg-gray-50 border border-gray-200 text-gray-800 focus:border-violet-400"}`;

  // Визуализация зон риска
  const total = s.max_discount || 1;
  const greenPct  = Math.min(100, (s.low_risk_threshold / total) * 100);
  const yellowPct = Math.min(100 - greenPct, ((s.mid_risk_threshold - s.low_risk_threshold) / total) * 100);
  const redPct    = 100 - greenPct - yellowPct;

  return (
    <div className="space-y-5 max-w-2xl">

      {/* Визуальная шкала */}
      <div className={`rounded-2xl p-4 ${bg} border ${border}`}>
        <div className="flex items-center gap-2 mb-3">
          <Icon name="BarChart3" size={14} style={{ color: "#8b5cf6" }} />
          <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-violet-300" : "text-violet-600"}`}>
            Шкала риска скидки
          </span>
        </div>
        <div className="relative h-8 rounded-xl overflow-hidden flex mb-2">
          <div style={{ width: `${greenPct}%`, background: "linear-gradient(90deg,#10b981,#84cc16)" }}
            className="flex items-center justify-center">
            {greenPct > 12 && <span className="text-[10px] font-bold text-white/90">Низкий</span>}
          </div>
          <div style={{ width: `${yellowPct}%`, background: "linear-gradient(90deg,#f59e0b,#f97316)" }}
            className="flex items-center justify-center">
            {yellowPct > 12 && <span className="text-[10px] font-bold text-white/90">Средний</span>}
          </div>
          <div style={{ width: `${redPct}%`, background: "linear-gradient(90deg,#ef4444,#dc2626)" }}
            className="flex items-center justify-center">
            {redPct > 12 && <span className="text-[10px] font-bold text-white/90">Высокий</span>}
          </div>
        </div>
        <div className="flex justify-between text-[10px]" style={{ color: isDark ? "rgba(255,255,255,0.3)" : "#9ca3af" }}>
          <span>0%</span>
          <span style={{ color: "#10b981" }}>↑ {s.low_risk_threshold}%</span>
          <span style={{ color: "#f59e0b" }}>↑ {s.mid_risk_threshold}%</span>
          <span style={{ color: "#ef4444" }}>max {s.max_discount}%</span>
        </div>
        {/* Легенда */}
        <div className="flex gap-4 mt-3">
          {[
            { color: "#10b981", label: "Низкий риск",    range: `0–${s.low_risk_threshold}%` },
            { color: "#f59e0b", label: "Средний риск",   range: `${s.low_risk_threshold}–${s.mid_risk_threshold}%` },
            { color: "#ef4444", label: "Высокий риск",   range: `${s.mid_risk_threshold}–${s.max_discount}%` },
          ].map(z => (
            <div key={z.color} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: z.color }} />
              <div>
                <div className="text-[10px] font-semibold" style={{ color: z.color }}>{z.label}</div>
                <div className="text-[9px]" style={{ color: isDark ? "rgba(255,255,255,0.3)" : "#9ca3af" }}>{z.range}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Настройки порогов */}
      <div className={`rounded-2xl p-4 ${bg} border ${border} space-y-4`}>
        <div className="flex items-center gap-2 mb-1">
          <Icon name="Sliders" size={14} style={{ color: "#8b5cf6" }} />
          <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-violet-300" : "text-violet-600"}`}>
            Пороги скидки
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Максимальная скидка */}
          <div>
            <label className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 block`} style={{ color: "#ef4444" }}>
              Максимум (абсолютный запрет)
            </label>
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={99} disabled={readOnly}
                value={s.max_discount} onChange={e => update({ max_discount: Number(e.target.value) })}
                className={inputCls} style={{ borderColor: "#ef444440" }} />
              <span className={`text-sm font-bold ${sub}`}>%</span>
            </div>
            <p className={`text-[10px] mt-1 ${sub}`}>Выше этой скидки система заблокирует применение</p>
          </div>

          {/* Порог среднего риска */}
          <div>
            <label className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 block`} style={{ color: "#f59e0b" }}>
              Порог среднего риска
            </label>
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={s.max_discount - 1} disabled={readOnly}
                value={s.mid_risk_threshold} onChange={e => update({ mid_risk_threshold: Number(e.target.value) })}
                className={inputCls} style={{ borderColor: "#f59e0b40" }} />
              <span className={`text-sm font-bold ${sub}`}>%</span>
            </div>
            <p className={`text-[10px] mt-1 ${sub}`}>Выше — высокий риск (красная зона)</p>
          </div>

          {/* Порог низкого риска */}
          <div>
            <label className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 block`} style={{ color: "#10b981" }}>
              Порог низкого риска
            </label>
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={s.mid_risk_threshold - 1} disabled={readOnly}
                value={s.low_risk_threshold} onChange={e => update({ low_risk_threshold: Number(e.target.value) })}
                className={inputCls} style={{ borderColor: "#10b98140" }} />
              <span className={`text-sm font-bold ${sub}`}>%</span>
            </div>
            <p className={`text-[10px] mt-1 ${sub}`}>До этого значения — безопасная зона</p>
          </div>
        </div>
      </div>

      {/* Настройки маржи */}
      <div className={`rounded-2xl p-4 ${bg} border ${border} space-y-4`}>
        <div className="flex items-center gap-2 mb-1">
          <Icon name="TrendingDown" size={14} style={{ color: "#8b5cf6" }} />
          <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-violet-300" : "text-violet-600"}`}>
            Защита маржи
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 block ${text}`}>
              Минимальная маржа (стоп)
            </label>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={50} disabled={readOnly}
                value={s.min_margin} onChange={e => update({ min_margin: Number(e.target.value) })}
                className={inputCls} />
              <span className={`text-sm font-bold ${sub}`}>%</span>
            </div>
            <p className={`text-[10px] mt-1 ${sub}`}>Скидка не применится если маржа упадёт ниже</p>
          </div>
          <div>
            <label className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 block ${text}`}>
              Маржа — порог предупреждения
            </label>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={50} disabled={readOnly}
                value={s.warn_margin} onChange={e => update({ warn_margin: Number(e.target.value) })}
                className={inputCls} />
              <span className={`text-sm font-bold ${sub}`}>%</span>
            </div>
            <p className={`text-[10px] mt-1 ${sub}`}>Ниже этого значения — жёлтое предупреждение в блоке</p>
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
                className={`flex-shrink-0 w-9 h-5 rounded-full transition relative ${s[row.key] ? "bg-violet-600" : isDark ? "bg-white/10" : "bg-gray-200"}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${s[row.key] ? "left-4" : "left-0.5"}`} />
              </button>
              <div>
                <div className={`text-xs font-semibold ${text}`}>{row.label}</div>
                <div className={`text-[10px] mt-0.5 ${sub}`}>{row.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Комментарий для одобрения */}
      {s.require_approval && (
        <div className={`rounded-2xl p-4 ${bg} border ${border}`}>
          <label className={`text-[10px] font-semibold uppercase tracking-wider mb-2 block ${text}`}>
            Сообщение при запросе одобрения
          </label>
          <textarea disabled={readOnly} rows={2}
            value={s.approval_note} onChange={e => update({ approval_note: e.target.value })}
            className={`${inputCls} resize-none`}
            placeholder="Текст который увидит менеджер при запросе одобрения скидки..." />
        </div>
      )}

      {/* Управление логикой AI */}
      <div className={`rounded-2xl overflow-hidden ${bg} border ${border}`}>
        <button
          onClick={() => setPromptOpen(v => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 text-left transition hover:bg-white/[0.02]">
          <Icon name="Sparkles" size={14} style={{ color: "#a78bfa" }} />
          <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-violet-300" : "text-violet-600"} flex-1`}>
            Управление логикой AI
          </span>
          <span className={`text-[9px] ${sub} mr-2`}>Промт для оценки риска скидки</span>
          <Icon name={promptOpen ? "ChevronUp" : "ChevronDown"} size={13} style={{ color: isDark ? "rgba(255,255,255,0.3)" : "#9ca3af" }} />
        </button>

        {promptOpen && (
          <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb"}` }}>
            <p className={`text-[10px] mt-3 ${sub}`}>
              Этот промт отправляется в AI при нажатии "Оценить AI" в блоке оценки риска скидки.
              AI получит этот текст + список позиций сметы + максимальную скидку.
            </p>
            <textarea
              disabled={readOnly}
              rows={10}
              value={aiPrompt}
              onChange={e => { setAiPrompt(e.target.value); setPromptSaved(false); }}
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition hover:opacity-80 ${sub}`}
                  style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb"}` }}>
                  <Icon name="RotateCcw" size={12} />
                  Сбросить к дефолту
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Сложность позиций */}
      <div className={`rounded-2xl overflow-hidden ${bg} border ${border}`}>
        <button
          onClick={() => setComplexityOpen(v => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 text-left transition hover:bg-white/[0.02]">
          <Icon name="Layers" size={14} style={{ color: "#a78bfa" }} />
          <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-violet-300" : "text-violet-600"} flex-1`}>
            Сложность позиций прайса
          </span>
          <span className={`text-[9px] ${sub} mr-2`}>Вес и сложность для AI-анализа</span>
          <Icon name={complexityOpen ? "ChevronUp" : "ChevronDown"} size={13} style={{ color: isDark ? "rgba(255,255,255,0.3)" : "#9ca3af" }} />
        </button>

        {complexityOpen && (
          <div className="px-4 pb-4 space-y-4" style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb"}` }}>

            {/* Формула */}
            <div className="pt-3">
              <label className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 block`} style={{ color: "#a78bfa" }}>
                Формула расчёта удельного веса
              </label>
              <input
                type="text"
                value={formula}
                onChange={e => setFormula(e.target.value)}
                disabled={readOnly}
                className={`w-full rounded-lg px-3 py-2 text-xs font-mono outline-none transition ${isDark ? "bg-white/[0.06] border border-white/10 text-white/80 focus:border-violet-500/50" : "bg-gray-50 border border-gray-200 text-gray-800 focus:border-violet-400"}`}
                placeholder="Σ(сложность × вес × кол-во) / Σ(вес × кол-во)"
              />
              <p className={`text-[10px] mt-1 ${sub}`}>Описание формулы — передаётся в AI как контекст расчёта</p>
            </div>

            {/* Фильтр по категории */}
            {categories.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {categories.map(cat => (
                  <button key={cat} onClick={() => setCategoryFilter(cat)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition"
                    style={{
                      background: categoryFilter === cat ? "rgba(139,92,246,0.2)" : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                      color: categoryFilter === cat ? "#a78bfa" : isDark ? "rgba(255,255,255,0.5)" : "#6b7280",
                      border: `1px solid ${categoryFilter === cat ? "rgba(139,92,246,0.4)" : "transparent"}`,
                    }}>
                    {cat === "all" ? "Все категории" : cat}
                  </button>
                ))}
              </div>
            )}

            {/* Таблица позиций */}
            {pricesLoading ? (
              <div className="flex items-center gap-2 py-6 justify-center">
                <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                <span className={`text-xs ${sub}`}>Загрузка прайса...</span>
              </div>
            ) : filteredPrices.length === 0 ? (
              <p className={`text-xs ${sub} py-4 text-center`}>Позиции прайса не найдены</p>
            ) : (
              <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb"}` }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#f9fafb" }}>
                      <th className={`text-left px-3 py-2.5 font-semibold ${sub} w-1/2`}>Позиция</th>
                      <th className={`text-center px-3 py-2.5 font-semibold w-28`} style={{ color: "#f59e0b" }}>Сложность</th>
                      <th className={`text-center px-3 py-2.5 font-semibold w-28`} style={{ color: "#8b5cf6" }}>Вес</th>
                      <th className={`text-center px-3 py-2.5 font-semibold w-20 ${sub}`}>Итог</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPrices.map((price, idx) => {
                      const item = getItem(price.id);
                      const score = Math.round((item.complexity * item.weight) / 10 * 10) / 10;
                      const scoreColor = score <= 3 ? "#10b981" : score <= 6 ? "#f59e0b" : "#ef4444";
                      return (
                        <tr key={price.id}
                          style={{ borderTop: idx === 0 ? "none" : `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "#f3f4f6"}` }}>
                          <td className="px-3 py-2">
                            <div className={`font-medium ${text}`}>{price.name}</div>
                            {price.unit && <div className={`text-[10px] ${sub}`}>{price.unit}</div>}
                          </td>
                          {/* Слайдер Сложность */}
                          <td className="px-3 py-2">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[11px] font-bold" style={{ color: "#f59e0b" }}>{item.complexity}</span>
                              <input type="range" min={1} max={10} step={1}
                                value={item.complexity}
                                disabled={readOnly}
                                onChange={e => updateItem(price.id, { complexity: Number(e.target.value) })}
                                className="w-20 accent-amber-400 cursor-pointer"
                              />
                            </div>
                          </td>
                          {/* Слайдер Вес */}
                          <td className="px-3 py-2">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[11px] font-bold" style={{ color: "#8b5cf6" }}>{item.weight}</span>
                              <input type="range" min={1} max={10} step={1}
                                value={item.weight}
                                disabled={readOnly}
                                onChange={e => updateItem(price.id, { weight: Number(e.target.value) })}
                                className="w-20 accent-violet-500 cursor-pointer"
                              />
                            </div>
                          </td>
                          {/* Итоговый балл позиции */}
                          <td className="px-3 py-2 text-center">
                            <span className="text-xs font-bold" style={{ color: scoreColor }}>{score}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Три промпта AI */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2">
                <Icon name="Sparkles" size={13} style={{ color: "#a78bfa" }} />
                <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-violet-300" : "text-violet-600"}`}>
                  AI промпты анализа
                </span>
              </div>

              {/* Табы промптов */}
              <div className="flex gap-1">
                {([
                  { key: "math",     label: "1. Математика",  color: "#10b981" },
                  { key: "semantic", label: "2. Семантика",   color: "#f59e0b" },
                  { key: "combine",  label: "3. Объединение", color: "#8b5cf6" },
                ] as const).map(tab => (
                  <button key={tab.key} onClick={() => setActivePromptTab(tab.key)}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition"
                    style={{
                      background: activePromptTab === tab.key ? `${tab.color}20` : isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                      color: activePromptTab === tab.key ? tab.color : isDark ? "rgba(255,255,255,0.4)" : "#9ca3af",
                      border: `1px solid ${activePromptTab === tab.key ? `${tab.color}40` : "transparent"}`,
                    }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Описания промптов */}
              <p className={`text-[10px] ${sub}`}>
                {activePromptTab === "math" && "Получает математическую оценку (число). Объясняет что означает итоговый балл по формуле."}
                {activePromptTab === "semantic" && "Получает список позиций сметы. Оценивает объект семантически — риски, комбинации, нестандартные ситуации."}
                {activePromptTab === "combine" && "Получает результаты этапов 1 и 2. Выдаёт итоговую оценку, рекомендуемую скидку и вывод для менеджера в JSON."}
              </p>

              <textarea
                disabled={readOnly}
                rows={8}
                value={complexityPrompts[activePromptTab]}
                onChange={e => setComplexityPrompts(prev => ({ ...prev, [activePromptTab]: e.target.value }))}
                className={`w-full rounded-xl px-3 py-2.5 text-xs font-mono outline-none transition resize-none ${
                  isDark
                    ? "bg-white/[0.04] border border-white/10 text-white/75 focus:border-violet-500/50"
                    : "bg-gray-50 border border-gray-200 text-gray-700 focus:border-violet-400"
                }`}
              />

              <div className={`text-[10px] p-2.5 rounded-lg ${isDark ? "bg-white/[0.03]" : "bg-gray-50"}`} style={{ border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb"}` }}>
                <span className={`font-semibold ${isDark ? "text-white/60" : "text-gray-600"}`}>Доступные переменные: </span>
                <span className={sub}>
                  {activePromptTab === "math" && "{math_score} — итоговый балл, {items_breakdown} — таблица позиций с баллами"}
                  {activePromptTab === "semantic" && "{items} — список позиций сметы"}
                  {activePromptTab === "combine" && "{math_result} — вывод этапа 1, {semantic_result} — вывод этапа 2, {max_discount} — макс. скидка"}
                </span>
              </div>
            </div>

            {/* Кнопка сохранения сложности */}
            {!readOnly && (
              <div className="flex items-center gap-2 pt-1">
                <button onClick={saveComplexity}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition hover:opacity-80"
                  style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
                  <Icon name={complexitySaved ? "Check" : "Save"} size={12} />
                  {complexitySaved ? "Сохранено" : "Сохранить промпты и формулу"}
                </button>
                <button onClick={() => setComplexityPrompts(DEFAULT_COMPLEXITY_PROMPTS)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition hover:opacity-80 ${sub}`}
                  style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb"}` }}>
                  <Icon name="RotateCcw" size={12} />
                  Сбросить промпты
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Кнопка сохранения */}
      {!readOnly && (
        <div className="flex items-center gap-3">
          <button onClick={save}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition hover:opacity-80"
            style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
            <Icon name={saved ? "Check" : "Save"} size={14} />
            {saved ? "Сохранено" : "Сохранить настройки"}
          </button>
          <span className={`text-[10px] ${sub}`}>Настройки сохраняются локально</span>
        </div>
      )}
    </div>
  );
}