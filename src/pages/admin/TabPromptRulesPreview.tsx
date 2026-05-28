import { useState } from "react";
import Icon from "@/components/ui/icon";

interface RuleItem { name: string; category: string; when_condition: string; when_not_condition: string; calc_rule: string; bundle: string; client_changes: string; }
interface CategorySetting { category: string; is_material: boolean; category_rule: string; }

function parseBundleNames(bundle: string, nameMap: Record<number, string>): string {
  try {
    const ids = JSON.parse(bundle);
    if (Array.isArray(ids) && ids.length > 0) return ids.map((id: number) => nameMap[id] || `#${id}`).join(", ");
  } catch { /* */ }
  return "";
}

interface Props {
  rulesByCategory: Record<string, RuleItem[]>;
  categorySettings: CategorySetting[];
  idToName: Record<number, string>;
}

export default function TabPromptRulesPreview({ rulesByCategory, categorySettings, idToName }: Props) {
  const [showRules, setShowRules] = useState(false);
  const [showCatRules, setShowCatRules] = useState(false);

  return (
    <>
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
    </>
  );
}
