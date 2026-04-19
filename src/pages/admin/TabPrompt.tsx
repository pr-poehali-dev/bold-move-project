import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { apiFetch } from "./api";

interface Props { token: string; }

interface PriceItem { category: string; name: string; price: number; unit: string; description: string; active: boolean; }
interface RuleItem { name: string; category: string; when_condition: string; when_not_condition: string; calc_rule: string; bundle: string; }
interface RuleType { id: number; name: string; label: string; }

const TEMPLATE_GENERAL = `Ты сметчик-технолог компании MosPotolki (натяжные потолки, Мытищи, с 2009г). Отвечай по-русски. Тел:+7(977)606-89-01.

КОМПАНИЯ: MosPotolki, Мытищи, с 2009г. Тел: +7(977)606-89-01. Ежедневно 8:00–22:00. Сайт: mospotolki.net`;

const TEMPLATE_SYSTEM = `ВАЖНО: \nВсе названия позиций и цены берёшь СТРОГО из блока "АКТУАЛЬНЫЙ ПРАЙС-ЛИСТ" ниже.\nВсе правила позиций берёшь СТРОГО из ПРАВИЛА ПО КАЖДОЙ ПОЗИЦИИ — смотри блок "ПРАВИЛА ПО ПОЗИЦИЯМ" ниже.\nКаждая запись содержит: условие добавления, исключения, формулу расчёта количества, что добавить вместе.\nСледуй этим правилам строго.

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
- НИКОГДА не рекомендуй сторонние сайты, студии или компании — только mospotolki.net
- НИКОГДА не пиши "предварительный расчёт" или "точную стоимость назовёт технолог"`;

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

export default function TabPrompt({ token }: Props) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([]);
  const [showPrices, setShowPrices] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "system" | "format">("general");
  const [dirty, setDirty] = useState(false);
  const contentRef = useRef(content);
  const dirtyRef = useRef(dirty);
  const savingRef = useRef(saving);

  contentRef.current = content;
  dirtyRef.current = dirty;
  savingRef.current = saving;

  useEffect(() => {
    apiFetch("prompt").then(r => r.ok && r.json().then(d => setContent(d.content)));
    apiFetch("prices").then(r => r.ok && r.json().then(d => setPrices(d.items.filter((p: PriceItem) => p.active))));
    apiFetch("prices").then(r => r.ok && r.json().then(d => setRules(d.items)));
    apiFetch("rule-types").then(r => r.ok && r.json().then(d => setRuleTypes(d.items)));
  }, []);

  const save = useCallback(async (contentToSave?: string) => {
    const val = contentToSave ?? contentRef.current;
    if (savingRef.current) return;
    setSaving(true); setMsg("");
    const r = await apiFetch("prompt", { method: "PUT", body: JSON.stringify({ content: val }) }, token);
    setMsg(r.ok ? "Сохранено" : "Ошибка");
    setDirty(false);
    setSaving(false);
    setTimeout(() => setMsg(""), 2000);
  }, [token]);

  // Автосохранение через 1.5с после последнего изменения
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleContentChange = (val: string) => {
    setContent(val);
    setDirty(true);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      if (dirtyRef.current) save(val);
    }, 1500);
  };

  // Сохранение при клике вне textarea (blur на документе)
  useEffect(() => {
    const onBlur = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" && dirtyRef.current && !savingRef.current) {
        save();
      }
    };
    document.addEventListener("focusout", onBlur);
    return () => document.removeEventListener("focusout", onBlur);
  }, [save]);

  const byCategory = prices.reduce<Record<string, PriceItem[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  const rulesByCategory = rules.reduce<Record<string, RuleItem[]>>((acc, r) => {
    if (r.when_condition || r.when_not_condition || r.calc_rule || (r.bundle && r.bundle !== "[]")) {
      (acc[r.category] ??= []).push(r);
    }
    return acc;
  }, {});

  const idToName = Object.fromEntries(rules.map(r => {
    const item = r as RuleItem & { id?: number };
    return [item.id, r.name];
  }));

  // Делим промпт на три части по маркерам
  const MARKER_SYSTEM = "ВАЖНО:";
  const MARKER_FORMAT = "ФОРМАТ КАЖДОЙ ПОЗИЦИИ";

  const idxSystem = content.indexOf(MARKER_SYSTEM);
  const idxFormat = content.indexOf(MARKER_FORMAT);

  const generalPart = idxSystem >= 0 ? content.slice(0, idxSystem).trimEnd() : content;
  const systemPart  = idxSystem >= 0 && idxFormat >= 0
    ? content.slice(idxSystem, idxFormat).trimEnd()
    : idxSystem >= 0 ? content.slice(idxSystem) : "";
  const formatPart  = idxFormat >= 0 ? content.slice(idxFormat) : "";

  const rebuildContent = (gen: string, sys: string, fmt: string) => {
    return [gen, sys, fmt].filter(Boolean).join("\n\n");
  };

  const handleGeneralChange = (val: string) => handleContentChange(rebuildContent(val, systemPart, formatPart));
  const handleSystemChange  = (val: string) => handleContentChange(rebuildContent(generalPart, val, formatPart));
  const handleFormatChange  = (val: string) => handleContentChange(rebuildContent(generalPart, systemPart, val));

  return (
    <div className="flex flex-col gap-6">

      {/* Редактор промпта — две вкладки */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-white font-medium text-sm">Инструкции для AI</p>
            <p className="text-white/40 text-xs mt-0.5">Прайс и правила расчёта подставляются автоматически — здесь только общие инструкции и формат.</p>
          </div>
          <div className="flex gap-1 bg-white/5 rounded-lg p-0.5 flex-shrink-0">
            <button onClick={() => setActiveTab("general")}
              className={`text-xs px-3 py-1.5 rounded-md transition ${activeTab === "general" ? "bg-violet-600 text-white" : "text-white/40 hover:text-white"}`}>
              Общее
            </button>
            <button onClick={() => setActiveTab("system")}
              className={`text-xs px-3 py-1.5 rounded-md transition ${activeTab === "system" ? "bg-violet-600 text-white" : "text-white/40 hover:text-white"}`}>
              Инструкции
            </button>
            <button onClick={() => setActiveTab("format")}
              className={`text-xs px-3 py-1.5 rounded-md transition ${activeTab === "format" ? "bg-violet-600 text-white" : "text-white/40 hover:text-white"}`}>
              Формат ответа
            </button>
          </div>
        </div>

        {activeTab === "general" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-white/30 text-xs">Роль бота, название компании, контакты, общее представление. Эта часть идёт первой в промпте.</p>
              <TemplateButton onApply={handleGeneralChange} template={TEMPLATE_GENERAL} />
            </div>
            <textarea
              value={generalPart}
              onChange={e => handleGeneralChange(e.target.value)}
              rows={18}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono resize-y outline-none focus:border-violet-500 transition"
            />
          </div>
        )}

        {activeTab === "system" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-white/30 text-xs">Общие принципы расчёта, ограничения. <span className="text-amber-400">Правила по конкретным позициям — во вкладке «Правила».</span></p>
              <TemplateButton onApply={handleSystemChange} template={TEMPLATE_SYSTEM} />
            </div>
            <textarea
              value={systemPart}
              onChange={e => handleSystemChange(e.target.value)}
              rows={18}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono resize-y outline-none focus:border-violet-500 transition"
            />
          </div>
        )}

        {activeTab === "format" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-white/30 text-xs">Формат каждой позиции, структура блоков ответа, итоговая стоимость.</p>
              <TemplateButton onApply={handleFormatChange} template={TEMPLATE_FORMAT} />
            </div>
            <textarea
              value={formatPart}
              onChange={e => handleFormatChange(e.target.value)}
              rows={18}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono resize-y outline-none focus:border-violet-500 transition"
            />
          </div>
        )}

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
            <span className="text-white/30 text-xs">Автосохранение через 1.5с...</span>
          )}
        </div>
      </div>

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