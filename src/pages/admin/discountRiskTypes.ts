// ── Константы localStorage ────────────────────────────────────────────────
export const LS_KEY               = "discount_risk_settings";
export const AI_PROMPT_KEY        = "discount_risk_ai_prompt";
export const COMPLEXITY_LS_KEY    = "discount_complexity_settings";
export const COMPLEXITY_PROMPTS_KEY = "discount_complexity_prompts";
export const COMPLEXITY_FORMULA_KEY = "discount_complexity_formula";

// ── Промт AI (старый — для блока оценки риска) ────────────────────────────
export const DEFAULT_AI_PROMPT = `Ты эксперт по монтажу натяжных потолков. Оцени сложность монтажа по позициям сметы и рекомендуй оптимальную скидку клиенту.

Критерии оценки:
- Простой объект (прямоугольник, одно полотно, без ниш) → низкий риск, скидка ближе к максимуму
- Средний объект (несколько полотен, 1-2 ниши, парящий потолок) → средний риск
- Сложный объект (многоуровневый, сложные ниши, много закладных, большая площадь) → высокий риск, минимальная скидка

Чем сложнее монтаж → тем выше риск непредвиденных затрат → тем меньше можно давать скидку.`;

export function loadAiPrompt(): string {
  return localStorage.getItem(AI_PROMPT_KEY) || DEFAULT_AI_PROMPT;
}

export function saveAiPrompt(p: string) {
  localStorage.setItem(AI_PROMPT_KEY, p);
  window.dispatchEvent(new StorageEvent("storage", { key: AI_PROMPT_KEY, newValue: p }));
}

// ── Типы настроек риска ───────────────────────────────────────────────────
export interface RiskSettings {
  max_discount: number;
  low_risk_threshold: number;
  mid_risk_threshold: number;
  min_margin: number;
  warn_margin: number;
  allow_zero_margin: boolean;
  require_approval: boolean;
  approval_note: string;
}

export const DEFAULT_RISK: RiskSettings = {
  max_discount: 30,
  low_risk_threshold: 10,
  mid_risk_threshold: 20,
  min_margin: 5,
  warn_margin: 15,
  allow_zero_margin: false,
  require_approval: false,
  approval_note: "Для скидки выше среднего порога требуется одобрение руководителя",
};

export function loadRiskSettings(): RiskSettings {
  try {
    const s = localStorage.getItem(LS_KEY);
    return s ? { ...DEFAULT_RISK, ...JSON.parse(s) } : DEFAULT_RISK;
  } catch { return DEFAULT_RISK; }
}

// ── Типы сложности позиций ────────────────────────────────────────────────
export interface PriceItem {
  id: number;
  name: string;
  unit: string;
  category: string;
  price?: number;
  purchase_price?: number;
  active?: boolean;
}

export interface ComplexityItem {
  priceId: number;
  complexity: number;      // 1-10 (текущее значение слайдера)
  weight: number;          // 1-10 (текущее значение слайдера)
  reason?: string;         // объяснение AI — сложность
  weight_reason?: string;  // объяснение AI — влияние на скидку
  ai_complexity?: number;  // оценка AI (не меняется при ручном редактировании)
  ai_weight?: number;      // оценка AI (не меняется при ручном редактировании)
}

export interface ComplexityPrompts {
  math: string;
  semantic: string;
  combine: string;
}

export const DEFAULT_FORMULA = "Σ(сложность × вес × кол-во) / Σ(вес × кол-во)";

export const DEFAULT_COMPLEXITY_PROMPTS: ComplexityPrompts = {
  math: `Ты аналитик монтажных работ. Тебе дана математическая оценка сложности объекта по формуле взвешенного среднего:

Итоговый балл: {math_score}/10
Детализация по позициям: {items_breakdown}

Шкала интерпретации:
- 1-3: простой объект (прямоугольные комнаты, одно полотно, стандартный монтаж)
- 4-6: средний объект (несколько полотен, ниши, парящий потолок)
- 7-10: сложный объект (многоуровневый, радиусы, закладные, большая площадь)

Дай ТОЛЬКО фактический вывод: что означает балл {math_score}, какие позиции дают наибольший вклад в сложность. Без рекомендаций по скидке. Максимум 3 предложения.`,

  semantic: `Ты эксперт по монтажу натяжных потолков с 10-летним опытом. Тебе дан список позиций сметы:
{items}

Задача: оцени СЕМАНТИЧЕСКУЮ сложность этого объекта. Учти:
- Комбинации позиций (многоуровневый + закладные = сложнее)
- Нестандартные элементы (радиусы, фотопечать, сложные формы)
- Риски при монтаже (вероятность переделки, сложность подготовки)
- Масштаб работ

Дай оценку от 1 до 10 (целое число) и 2-3 предложения пояснения. Формат: "Оценка: X/10. [Пояснение]"`,

  combine: `Ты коммерческий директор компании натяжных потолков. Твоя задача — рекомендовать ТОЧНУЮ скидку клиенту.

АНАЛИЗ ОБЪЕКТА:
Математическая оценка сложности: {math_result}
Семантическая оценка: {semantic_result}
Максимально допустимая скидка: {max_discount}%

ПРАВИЛА РАСЧЁТА СКИДКИ (строго соблюдай):
- Сложность 1-3 (простой объект) → скидка 70-100% от максимума (т.е. при max={max_discount}% → {max_discount}*0.7 до {max_discount}%)
- Сложность 4-6 (средний объект) → скидка 40-70% от максимума
- Сложность 7-8 (сложный объект) → скидка 15-40% от максимума
- Сложность 9-10 (очень сложный) → скидка 0-15% от максимума

ВАЖНО: рекомендуй КОНКРЕТНОЕ число, не диапазон. Округляй до 0.5%.

Определи уровень: "low" (сложность 1-4), "mid" (5-7), "high" (8-10).

Ответь СТРОГО в JSON без пояснений вне JSON:
{"score": 5, "recommended_discount": 12.5, "level": "mid", "summary": "Объект средней сложности: два полотна, парящий потолок. Скидка 12.5% безопасна для маржи."}`,
};

// ── Текстовые подсказки по значению слайдера ─────────────────────────────
export function getComplexityHint(v: number): string {
  if (v <= 2) return "Очень простая операция, минимальные трудозатраты.";
  if (v <= 4) return "Несложная позиция, выполняется быстро и без рисков.";
  if (v <= 6) return "Средняя сложность, требует внимательности и опыта.";
  if (v <= 8) return "Сложная позиция, высокий риск ошибок при монтаже.";
  return "Очень сложная операция, требует максимальной квалификации.";
}

export function getWeightHint(v: number): string {
  if (v <= 2) return "Почти не влияет на риск — позиция с низкой маржинальностью.";
  if (v <= 4) return "Слабое влияние на скидку, риск минимален.";
  if (v <= 6) return "Умеренное влияние — скидка может снизить рентабельность.";
  if (v <= 8) return "Высокое влияние на риск, скидка нежелательна.";
  return "Критическое влияние — скидка по этой позиции крайне рискованна.";
}

export function loadComplexityItems(): Record<number, ComplexityItem> {
  try {
    const s = localStorage.getItem(COMPLEXITY_LS_KEY);
    if (!s) return {};
    const raw = JSON.parse(s);
    // Нормализуем ключи в числа (JSON.parse делает их строками)
    const result: Record<number, ComplexityItem> = {};
    for (const key of Object.keys(raw)) {
      result[Number(key)] = raw[key];
    }
    return result;
  } catch { return {}; }
}

export function saveComplexityItems(items: Record<number, ComplexityItem>) {
  localStorage.setItem(COMPLEXITY_LS_KEY, JSON.stringify(items));
}

export function loadComplexityPrompts(): ComplexityPrompts {
  try {
    const s = localStorage.getItem(COMPLEXITY_PROMPTS_KEY);
    return s ? { ...DEFAULT_COMPLEXITY_PROMPTS, ...JSON.parse(s) } : DEFAULT_COMPLEXITY_PROMPTS;
  } catch { return DEFAULT_COMPLEXITY_PROMPTS; }
}

export function loadFormula(): string {
  return localStorage.getItem(COMPLEXITY_FORMULA_KEY) || DEFAULT_FORMULA;
}

// ── Общие стили (theme helpers) ───────────────────────────────────────────
export interface ThemeClasses {
  border: string;
  bg: string;
  text: string;
  sub: string;
  inputCls: string;
}

export function getTheme(isDark: boolean): ThemeClasses {
  return {
    border:   isDark ? "border-white/10" : "border-gray-200",
    bg:       isDark ? "bg-white/[0.03]" : "bg-white",
    text:     isDark ? "text-white/80"   : "text-gray-800",
    sub:      isDark ? "text-white/40"   : "text-gray-500",
    inputCls: `w-full rounded-lg px-3 py-2 text-sm outline-none transition ${isDark ? "bg-white/[0.06] border border-white/10 text-white/80 focus:border-violet-500/50" : "bg-gray-50 border border-gray-200 text-gray-800 focus:border-violet-400"}`,
  };
}