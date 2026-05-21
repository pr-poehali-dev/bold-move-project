import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { apiFetch } from "./api";

interface UserProfile {
  company_name?: string | null;
  company_addr?: string | null;
  website?: string | null;
  brand?: {
    support_phone?: string | null;
    support_email?: string | null;
    working_hours?: string | null;
    telegram_url?:  string | null;
    bot_name?:      string | null;
  } | null;
}

interface Props { token: string; isDark?: boolean; readOnly?: boolean; user?: UserProfile | null; }

interface PriceItem { category: string; name: string; price: number; unit: string; description: string; active: boolean; }
interface RuleItem { name: string; category: string; when_condition: string; when_not_condition: string; calc_rule: string; bundle: string; client_changes: string; }
interface RuleType { id: number; name: string; label: string; }
interface CategorySetting { category: string; is_material: boolean; category_rule: string; }

function normalizeAddr(raw?: string | null): string {
  if (!raw) return "Мытищи";
  const l = raw.toLowerCase();
  if (l.includes("москв") || l.includes(" мо") || l.includes("московск")) return "Москва и МО";
  return raw.trim();
}

function buildTemplateGeneral(u?: UserProfile | null): string {
  const company  = u?.company_name  || "MosPotolki";
  const phone    = u?.brand?.support_phone || "+7(977)606-89-01";
  const addr     = normalizeAddr(u?.company_addr);
  const hours    = u?.brand?.working_hours || "Ежедневно 8:00–22:00";
  const site     = u?.website       || "mospotolki.net";
  const botName  = u?.brand?.bot_name || "сметчик-технолог";
  return `Ты ${botName} компании ${company} (натяжные потолки, ${addr}). Отвечай по-русски. Тел:${phone}.

Твоя задача правильно создать смету по натяжным потолкам используя все актуальные правила, названия позиций и цены.

КОМПАНИЯ: ${company}, ${addr}. Тел: ${phone}. ${hours}. Сайт: ${site}`;
}

function buildTemplateSystem(u?: UserProfile | null): string {
  const site = u?.website || "mospotolki.net";
  return `ВАЖНО: 
Все названия позиций и цены берёшь СТРОГО из блока "АКТУАЛЬНЫЙ ПРАЙС-ЛИСТ" ниже.
Все правила позиций берёшь СТРОГО из ПРАВИЛА ПО КАЖДОЙ ПОЗИЦИИ — смотри блок "ПРАВИЛА ПО ПОЗИЦИЯМ" ниже.
Каждая запись содержит: условие добавления, исключения, формулу расчёта количества, что добавить вместе.
Следуй этим правилам строго.

ОБЩИЕ ПРИНЦИПЫ (применяются всегда):
- Периметр = площадь × 1.3 если клиент не указал иное
- Если клиент указал P= или P- — использовать это значение напрямую, не вычислять
- Каждой позиции — свой монтаж в последнем блоке "Услуги монтажа"

ОГРАНИЧЕНИЯ:
- Не используй никакие другие цены кроме тех что в прайс-листе.
- Если позиции нет в прайс-листе — её не существует, не выдумывай.
- Не добавляй новые категории, если не понятно куда позиция должна попасть добавляй в категорию "Дополнительно" 
- СТРОГО: добавляй только позиции которые явно указал клиент или следуют из правил
- Не задавай уточняющих вопросов до расчёта — считай по данным
- Не пиши более 44 символов в одной строке
- Не показывай клиенту формулу расчёта периметра
- НИКОГДА не указывай ссылки, URL и гиперссылки
- НЕ добавляй стандартный и теневой профиль на одну и ту же длину
- "Без монтажа" = НЕ добавлять монтаж к этой позиции
- НИКОГДА не добавляй все виды закладных сразу — только нужный тип
- НИКОГДА не рекомендуй сторонние сайты, студии или компании — только ${site}
- НИКОГДА не пиши "предварительный расчёт" или "точную стоимость назовёт технолог"`;
}

const TEMPLATE_FORMAT = `ФОРМАТ КАЖДОЙ ПОЗИЦИИ — СТРОГО:
Название  КОЛ-ВО ЕД × ЦЕНА ₽ = ИТОГО ₽

ФОРМАТ ОТВЕТА — СТРОГО отдельными блоками:

1. Полотно:
[полотно + раскрой + огарпунивание — всё здесь]
2. Профиль:
[стандартный и/или теневой и/или парящий]
3. Закладные:   ← только если есть
4. Ниши:        ← только если есть
5. Освещение:   ← только если есть
6. Работы на высоте: ← только если есть

Последний блок ВСЕГДА:
7. Услуги монтажа:
[монтаж КАЖДОЙ позиции из всех блоков выше]

Итоговая стоимость — 3 варианта:
Econom:   X ₽  (Standard × 0.77)
Standard: X ₽  (сумма всех позиций)
Premium:  X ₽  (Standard × 1.27)

Финальная фраза ТОЛЬКО после создания сметы:
"На какой день вас записать на бесплатный замер?"`;

const SEP_G = "##GENERAL##";
const SEP_S = "##SYSTEM##";
const SEP_F = "##FORMAT##";
const SEP_P = "##PLAN##";
const rebuildContent = (gen: string, sys: string, fmt: string, plan: string) =>
  `${SEP_G}\n${gen}\n${SEP_S}\n${sys}\n${SEP_F}\n${fmt}\n${SEP_P}\n${plan}`;

const TEMPLATE_PLAN = `=== РЕЖИМ ПОСТРОИТЕЛЯ ===
Получишь данные помещения (площадь, периметр, стены с длинами) и голосовой запрос монтажника.
Верни ТОЛЬКО валидный JSON без пояснений и без markdown:
{"items":[{"name":"...","qty":1,"unit":"м","price":0}]}
Используй ТОЧНЫЕ названия из прайса. qty — метры для профилей, м² для полотна, шт для штучных.
НЕ добавляй монтаж — только материалы и закладные.
Количество бери из данных помещения (периметр, площадь, длины стен), а не придумывай.

=== ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА ===

ПРАВИЛО 1 — СВЕТИЛЬНИКИ (КРИТИЧНО):
Если упомянут «светильник», «точечный», «споты», «GX53», «точки» —
ОБЯЗАТЕЛЬНО добавить ВСЕ ТРИ позиции с одинаковым qty:
  1. «Светильник GX-53» qty=N шт
  2. «Лампа GX-53» qty=N шт
  3. «Под светильник ∅90» qty=N шт

ПРАВИЛО 2 — ЛЮСТРА (КРИТИЧНО, НЕЛЬЗЯ ПРОПУСКАТЬ):
Слово «люстра» в любой форме → добавить «Под люстру планка» qty=кол-во люстр шт.
«одна люстра» → qty=1. «две люстры» → qty=2.

ПРАВИЛО 3 — ТЕНЕВОЙ ПРОФИЛЬ:
• «теневой» без уточнения → «EuroKRAAB стеновой»
• «еврокраб», «краб» → «EuroKRAAB стеновой»
• «потолочный еврокраб» → «EuroKRAAB потолочный»
• «теневой классик», «классика», «KLASSIKA» → «Теневой классик (Flexy KLASSIKA 140)»
Количество = длина указанных стен. Если не уточнил — весь периметр.

ПРАВИЛО 4 — ПАРЯЩИЙ ПРОФИЛЬ:
• «парящий» без уточнения → «Flexy FLY 02  с рассеивателем»
• «ПК-6», «без рассеивателя» → «Парящий ПК-6 без рассеивателя»
• «FLY 01» → «Flexy FLY 01 без рассеивателем»
НИКОГДА не добавляй два вида парящего одновременно.
Количество = длина указанных стен. Если не уточнил — весь периметр.

ПРАВИЛО 5 — СТЕНОВОЙ ПРОФИЛЬ:
ВСЕГДА добавлять «Стеновой алюминиевый» даже если есть теневой и парящий.
Количество = периметр МИНУС длина теневого МИНУС длина парящего.

ПРАВИЛО 6 — НИШИ ДЛЯ ШТОР:
• «ПК-14» → «Ниша ПК-14 (2 ряда)»
• «ПК-12» → «Ниша ПК-12 (3 ряда)»
• «ПК-15» → «Ниша ПК-15 (2 ряда)»
• «без перегиба» → «Ниша без перегиба»
• «с перегибом» → «Ниша с перегибом»
Количество = длина стены где указано.

РАСЧЁТ ДЛИН:
• «слева», «левая» → длина левой стены из данных помещения
• «справа», «правая» → длина правой стены
• «сверху», «верхняя» → длина верхней стены
• «снизу», «нижняя» → длина нижней стены
• «по одной стене» → периметр ÷ 4
• «по двум стенам» → периметр ÷ 2
• «по всему периметру» / без уточнения → весь периметр`;


function TemplateButton({ template, onApply }: { template: string; onApply: (val: string) => void }) {
  const [confirm, setConfirm] = useState(false);
  return confirm ? (
    <div className="flex items-center gap-2 flex-shrink-0">
      <span className="text-white/40 text-xs">Заменить текущий текст шаблоном?</span>
      <button onClick={() => { onApply(template); setConfirm(false); }}
        className="text-xs bg-violet-600 hover:bg-violet-700 text-white px-2.5 py-1 rounded-lg transition">Да</button>
      <button onClick={() => setConfirm(false)}
        className="text-xs text-white/40 hover:text-white/70 px-2 py-1 transition">Нет</button>
    </div>
  ) : (
    <button onClick={() => setConfirm(true)}
      className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 bg-violet-600/15 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-xs rounded-lg transition">
      <span className="text-[10px] font-bold">AI</span>
      Заполнить шаблоном
    </button>
  );
}

function parseBundleNames(bundle: string, nameMap: Record<number, string>): string {
  try {
    const ids = JSON.parse(bundle);
    if (Array.isArray(ids) && ids.length > 0) return ids.map((id: number) => nameMap[id] || `#${id}`).join(", ");
  } catch { /* */ }
  return "";
}

export default function TabPrompt({ token, isDark = true, readOnly = false, user }: Props) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([]);
  const [categorySettings, setCategorySettings] = useState<CategorySetting[]>([]);
  const [showPrices, setShowPrices] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showCatRules, setShowCatRules] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "system" | "format" | "plan">("general");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    apiFetch("prompt", undefined, token).then(r => r.ok && r.json().then(d => {
      const loaded = d.content || "";
      if (!loaded.trim()) {
        const auto = rebuildContent(
          buildTemplateGeneral(user),
          buildTemplateSystem(user),
          TEMPLATE_FORMAT,
          TEMPLATE_PLAN,
        );
        setContent(auto);
        setDirty(true);
      } else {
        // Если в старом промпте нет ##PLAN## — добавляем шаблон автоматически
        if (!loaded.includes(SEP_P)) {
          setContent(loaded + `\n${SEP_P}\n${TEMPLATE_PLAN}`);
          setDirty(true);
        } else {
          setContent(loaded);
        }
      }
    }));
    apiFetch("prices", undefined, token).then(r => r.ok && r.json().then(d => setPrices(d.items.filter((p: PriceItem) => p.active))));
    apiFetch("prices", undefined, token).then(r => r.ok && r.json().then(d => setRules(d.items)));
    apiFetch("rule-types", undefined, token).then(r => r.ok && r.json().then(d => setRuleTypes(d.items)));
    apiFetch("category_settings", undefined, token).then(r => r.ok && r.json().then(d => setCategorySettings(d.items)));
  }, [token]);

  const save = useCallback(async (contentToSave?: string) => {
    const val = contentToSave ?? content;
    setSaving(true); setMsg("");
    const r = await apiFetch("prompt", { method: "PUT", body: JSON.stringify({ content: val }) }, token);
    setMsg(r.ok ? "Сохранено" : "Ошибка");
    setDirty(false);
    setSaving(false);
    setTimeout(() => setMsg(""), 2000);
  }, [token, content]);

  const handleContentChange = (val: string) => {
    setContent(val);
    setDirty(true);
  };

  const byCategory = prices.reduce<Record<string, PriceItem[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  const rulesByCategory = rules.reduce<Record<string, RuleItem[]>>((acc, r) => {
    if (r.when_condition || r.when_not_condition || r.calc_rule || r.client_changes || (r.bundle && r.bundle !== "[]")) {
      (acc[r.category] ??= []).push(r);
    }
    return acc;
  }, {});

  const idToName = Object.fromEntries(rules.map(r => {
    const item = r as RuleItem & { id?: number };
    return [item.id, r.name];
  }));

  // Делим промпт на четыре части по уникальным маркерам
  const idxG = content.indexOf(SEP_G);
  const idxS = content.indexOf(SEP_S);
  const idxF = content.indexOf(SEP_F);
  const idxP = content.indexOf(SEP_P);

  const generalPart = idxS >= 0
    ? content.slice(idxG >= 0 ? idxG + SEP_G.length : 0, idxS).trim()
    : content.slice(idxG >= 0 ? idxG + SEP_G.length : 0).trim();
  const systemPart  = idxS >= 0
    ? content.slice(idxS + SEP_S.length, idxF >= 0 ? idxF : idxP >= 0 ? idxP : undefined).trim()
    : "";
  const formatPart  = idxF >= 0
    ? content.slice(idxF + SEP_F.length, idxP >= 0 ? idxP : undefined).trim()
    : "";
  const planPart    = idxP >= 0
    ? content.slice(idxP + SEP_P.length).trim()
    : "";

  // Используем ref чтобы handlers всегда видели актуальные части
  const partsRef = useRef({ generalPart, systemPart, formatPart, planPart });
  partsRef.current = { generalPart, systemPart, formatPart, planPart };

  const handleGeneralChange = useCallback((val: string) => {
    const { systemPart: s, formatPart: f, planPart: p } = partsRef.current;
    handleContentChange(rebuildContent(val, s, f, p));
  }, [handleContentChange]);

  const handleSystemChange = useCallback((val: string) => {
    const { generalPart: g, formatPart: f, planPart: p } = partsRef.current;
    handleContentChange(rebuildContent(g, val, f, p));
  }, [handleContentChange]);

  const handleFormatChange = useCallback((val: string) => {
    const { generalPart: g, systemPart: s, planPart: p } = partsRef.current;
    handleContentChange(rebuildContent(g, s, val, p));
  }, [handleContentChange]);

  const handlePlanChange = useCallback((val: string) => {
    const { generalPart: g, systemPart: s, formatPart: f } = partsRef.current;
    handleContentChange(rebuildContent(g, s, f, val));
  }, [handleContentChange]);

  return (
    <div className="flex flex-col gap-6">

      {/* Редактор промпта — две вкладки */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <div>
            <p className={`${isDark ? "text-white" : "text-gray-900"} font-medium text-sm`}>Инструкции для AI</p>
            <p className={`${isDark ? "text-white/40" : "text-gray-400"} text-xs mt-0.5`}>Прайс и правила расчёта подставляются автоматически — здесь только общие инструкции и формат.</p>
          </div>
          <div className={`flex gap-1 ${isDark ? "bg-white/5" : "bg-gray-100"} rounded-lg p-0.5 w-full`}>
            <button onClick={() => setActiveTab("general")}
              className={`flex-1 text-xs px-2 py-1.5 rounded-md transition ${activeTab === "general" ? "bg-violet-600 text-white" : isDark ? "text-white/40 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}>
              Общее
            </button>
            <button onClick={() => setActiveTab("system")}
              className={`flex-1 text-xs px-2 py-1.5 rounded-md transition ${activeTab === "system" ? "bg-violet-600 text-white" : isDark ? "text-white/40 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}>
              Инструкции
            </button>
            <button onClick={() => setActiveTab("format")}
              className={`flex-1 text-xs px-2 py-1.5 rounded-md transition ${activeTab === "format" ? "bg-violet-600 text-white" : isDark ? "text-white/40 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}>
              Формат ответа
            </button>
            <button onClick={() => setActiveTab("plan")}
              className={`flex-1 text-xs px-2 py-1.5 rounded-md transition ${activeTab === "plan" ? "bg-violet-600 text-white" : isDark ? "text-white/40 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}>
              Построитель
            </button>
          </div>
        </div>

        {activeTab === "general" && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className={`${isDark ? "text-white/30" : "text-gray-400"} text-xs flex-1 min-w-0`}>Роль бота, название компании, контакты, общее представление. Эта часть идёт первой в промпте.</p>
              <TemplateButton onApply={handleGeneralChange} template={buildTemplateGeneral(user)} />
            </div>
            <textarea
              value={generalPart}
              onChange={e => handleGeneralChange(e.target.value)}
              readOnly={readOnly}
              rows={18}
              className={`w-full ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-200 text-gray-900"} border rounded-xl px-4 py-3 text-sm font-mono resize-y outline-none focus:border-violet-500 transition`}
            />
          </div>
        )}

        {activeTab === "system" && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className={`${isDark ? "text-white/30" : "text-gray-400"} text-xs flex-1 min-w-0`}>Общие принципы расчёта, ограничения. <span className="text-amber-500">Правила по конкретным позициям — во вкладке «Правила».</span></p>
              <TemplateButton onApply={handleSystemChange} template={buildTemplateSystem(user)} />
            </div>
            <textarea
              value={systemPart}
              onChange={e => handleSystemChange(e.target.value)}
              readOnly={readOnly}
              rows={18}
              className={`w-full ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-200 text-gray-900"} border rounded-xl px-4 py-3 text-sm font-mono resize-y outline-none focus:border-violet-500 transition`}
            />
          </div>
        )}

        {activeTab === "format" && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className={`${isDark ? "text-white/30" : "text-gray-400"} text-xs flex-1 min-w-0`}>Формат каждой позиции, структура блоков ответа, итоговая стоимость.</p>
              <TemplateButton onApply={handleFormatChange} template={TEMPLATE_FORMAT} />
            </div>
            <textarea
              value={formatPart}
              onChange={e => handleFormatChange(e.target.value)}
              readOnly={readOnly}
              rows={18}
              className={`w-full ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-200 text-gray-900"} border rounded-xl px-4 py-3 text-sm font-mono resize-y outline-none focus:border-violet-500 transition`}
            />
          </div>
        )}

        {activeTab === "plan" && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className={`${isDark ? "text-white/30" : "text-gray-400"} text-xs flex-1 min-w-0`}>
                Инструкции для голосового построителя планов. Используется вместо «Формата ответа» — возвращает JSON, а не текст. Количества берутся из данных помещения.
              </p>
              <TemplateButton onApply={handlePlanChange} template={TEMPLATE_PLAN} />
            </div>
            <textarea
              value={planPart}
              onChange={e => handlePlanChange(e.target.value)}
              readOnly={readOnly}
              rows={22}
              className={`w-full ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-200 text-gray-900"} border rounded-xl px-4 py-3 text-sm font-mono resize-y outline-none focus:border-violet-500 transition`}
            />
          </div>
        )}

        {!readOnly && (
          <div className="flex items-center gap-3">
            <button onClick={() => save()} disabled={saving}
              className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg px-6 py-2 font-medium transition flex items-center gap-2">
              {saving ? <><Icon name="Loader" size={14} className="animate-spin" /> Сохраняю...</> : "Сохранить"}
            </button>
            {msg && (
              <span className={`text-sm flex items-center gap-1 ${msg.includes("Ошибка") ? "text-red-400" : "text-green-400"}`}>
                {!msg.includes("Ошибка") && <Icon name="Check" size={13} />}
                {msg}
              </span>
            )}
            {dirty && !saving && !msg && (
              <span className="text-white/30 text-xs">Есть несохранённые изменения</span>
            )}
          </div>
        )}
      </div>

      {/* Превью правил по категориям */}
      {categorySettings.some(c => c.category_rule) && (
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowCatRules(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition">
            <div className="flex items-center gap-2">
              <Icon name="FolderOpen" size={15} className="text-teal-400" />
              <span className="text-white/70 text-sm font-medium">Правила по категориям — подставляются в AI автоматически</span>
              <span className="text-white/30 text-xs">
                ({categorySettings.filter(c => c.category_rule).length} категорий)
              </span>
            </div>
            <Icon name={showCatRules ? "ChevronUp" : "ChevronDown"} size={15} className="text-white/30" />
          </button>
          {showCatRules && (
            <div className="border-t border-white/10 px-4 py-3 flex flex-col gap-2">
              <p className="text-white/30 text-xs mb-1">Редактируется во вкладке «Правила к категориям».</p>
              {categorySettings.filter(c => c.category_rule).map(c => (
                <div key={c.category} className="bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2 text-xs">
                  <span className="text-teal-300 font-semibold">{c.category}:</span>{" "}
                  <span className="text-white/50">{c.category_rule.replace(/\n/g, " · ")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Превью правил — что видит LLM */}
      <div className="border border-white/10 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowRules(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition">
          <div className="flex items-center gap-2">
            <Icon name="BookOpen" size={15} className="text-amber-400" />
            <span className="text-white/70 text-sm font-medium">Правила по позициям — подставляются в AI автоматически</span>
            <span className="text-white/30 text-xs">
              ({Object.values(rulesByCategory).reduce((s, arr) => s + arr.length, 0)} позиций с правилами)
            </span>
          </div>
          <Icon name={showRules ? "ChevronUp" : "ChevronDown"} size={15} className="text-white/30" />
        </button>

        {showRules && (
          <div className="border-t border-white/10 px-4 py-3 flex flex-col gap-5 max-h-[600px] overflow-y-auto">
            <p className="text-white/30 text-xs">Редактируется во вкладке «Правила». Именно это видит AI при каждом запросе.</p>
            {Object.entries(rulesByCategory).map(([cat, items]) => (
              <div key={cat}>
                <p className="text-violet-300 text-xs font-semibold uppercase tracking-wider mb-2">{cat}</p>
                <div className="flex flex-col gap-2">
                  {items.map(item => (
                    <div key={item.name} className="bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2 text-xs flex flex-col gap-1">
                      <span className="text-white/80 font-medium">{item.name}</span>
                      {item.when_condition && (
                        <span className="text-white/40">
                          <span className="text-green-400/70">добавляется если:</span> {item.when_condition}
                        </span>
                      )}
                      {item.when_not_condition && (
                        <span className="text-white/40">
                          <span className="text-red-400/70">НЕ добавляется если:</span> {item.when_not_condition}
                        </span>
                      )}
                      {item.calc_rule && (
                        <span className="text-white/40">
                          <span className="text-violet-400/70">количество:</span> {item.calc_rule}
                        </span>
                      )}
                      {parseBundleNames(item.bundle, idToName) && (
                        <span className="text-white/40">
                          <span className="text-amber-400/70">вместе добавить:</span> {parseBundleNames(item.bundle, idToName)}
                        </span>
                      )}
                      {item.client_changes && (
                        <span className="text-white/40">
                          <span className="text-orange-400/70">изменения клиента:</span> {item.client_changes}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Прайс из БД — превью */}
      <div className="border border-white/10 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowPrices(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition">
          <div className="flex items-center gap-2">
            <Icon name="Tag" size={15} className="text-violet-400" />
            <span className="text-white/70 text-sm font-medium">Актуальный прайс — подставляется в AI автоматически</span>
            <span className="text-white/30 text-xs">({prices.length} позиций)</span>
          </div>
          <Icon name={showPrices ? "ChevronUp" : "ChevronDown"} size={15} className="text-white/30" />
        </button>

        {showPrices && (
          <div className="border-t border-white/10 px-4 py-3 flex flex-col gap-4 max-h-[500px] overflow-y-auto">
            <p className="text-white/30 text-xs">Редактируется во вкладке «Цены». Здесь только просмотр.</p>
            {Object.entries(byCategory).map(([cat, items]) => (
              <div key={cat}>
                <p className="text-violet-300 text-xs font-semibold uppercase tracking-wider mb-1.5">{cat}</p>
                <div className="flex flex-col gap-0.5">
                  {items.map(item => (
                    <div key={item.name} className="flex items-baseline gap-2 text-xs">
                      <span className="text-white/60 flex-1">{item.name}</span>
                      <span className="text-green-400 font-mono flex-shrink-0">{item.price} ₽/{item.unit}</span>
                      {item.description && <span className="text-white/25 flex-shrink-0 max-w-[240px] truncate">{item.description}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}