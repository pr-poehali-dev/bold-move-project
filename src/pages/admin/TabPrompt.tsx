import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { apiFetch } from "./api";

interface Props { token: string; }

interface PriceItem { category: string; name: string; price: number; unit: string; description: string; active: boolean; }
interface RuleItem { name: string; category: string; when_condition: string; when_not_condition: string; calc_rule: string; bundle: string; }
interface RuleType { id: number; name: string; label: string; }

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

  useEffect(() => {
    apiFetch("prompt").then(r => r.ok && r.json().then(d => setContent(d.content)));
    apiFetch("prices").then(r => r.ok && r.json().then(d => setPrices(d.items.filter((p: PriceItem) => p.active))));
    apiFetch("prices").then(r => r.ok && r.json().then(d => setRules(d.items)));
    apiFetch("rule-types").then(r => r.ok && r.json().then(d => setRuleTypes(d.items)));
  }, []);

  const save = async () => {
    setSaving(true); setMsg("");
    const r = await apiFetch("prompt", { method: "PUT", body: JSON.stringify({ content }) }, token);
    setMsg(r.ok ? "Сохранено!" : "Ошибка сохранения");
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  };

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

  const handleGeneralChange = (val: string) => setContent(rebuildContent(val, systemPart, formatPart));
  const handleSystemChange  = (val: string) => setContent(rebuildContent(generalPart, val, formatPart));
  const handleFormatChange  = (val: string) => setContent(rebuildContent(generalPart, systemPart, val));

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
            <p className="text-white/30 text-xs">Роль бота, название компании, контакты, общее представление. Эта часть идёт первой в промпте.</p>
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
            <p className="text-white/30 text-xs">Общие принципы расчёта, ограничения. <span className="text-amber-400">Правила по конкретным позициям — во вкладке «Правила».</span></p>
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
            <p className="text-white/30 text-xs">Формат каждой позиции, структура блоков ответа, итоговая стоимость.</p>
            <textarea
              value={formatPart}
              onChange={e => handleFormatChange(e.target.value)}
              rows={18}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono resize-y outline-none focus:border-violet-500 transition"
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving}
            className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg px-6 py-2 font-medium transition flex items-center gap-2">
            {saving ? <><Icon name="Loader" size={14} className="animate-spin" /> Сохраняю...</> : "Сохранить"}
          </button>
          {msg && <span className={`text-sm ${msg.includes("Ошибка") ? "text-red-400" : "text-green-400"}`}>{msg}</span>}
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