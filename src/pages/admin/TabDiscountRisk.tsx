import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import {
  RiskSettings, LS_KEY, ComplexityPrompts,
  loadRiskSettings, getTheme,
  loadComplexityPrompts, loadFormula,
  COMPLEXITY_PROMPTS_KEY, COMPLEXITY_FORMULA_KEY,
  DEFAULT_COMPLEXITY_PROMPTS,
} from "./discountRiskTypes";
import DiscountRiskScale from "./DiscountRiskScale";
import DiscountRiskThresholds from "./DiscountRiskThresholds";
import DiscountRiskComplexity from "./DiscountRiskComplexity";
import ComplexityAiPrompts from "./ComplexityAiPrompts";

interface Props { isDark?: boolean; readOnly?: boolean; }

type SubTab = "general" | "complexity" | "prompts";

export default function TabDiscountRisk({ isDark = true, readOnly = false }: Props) {
  const [subTab, setSubTab] = useState<SubTab>("general");
  const [s,      setS]      = useState<RiskSettings>(loadRiskSettings);
  const [saved,  setSaved]  = useState(false);

  // Стейт AI промптов (вкладка «AI промпты»)
  const [complexityPrompts, setComplexityPrompts] = useState<ComplexityPrompts>(loadComplexityPrompts);
  const [formula,           setFormula]           = useState(loadFormula);
  const [activePromptTab,   setActivePromptTab]   = useState<"math" | "semantic" | "combine">("math");
  const [savedPrompts,      setSavedPrompts]      = useState(false);
  const [improvedPrompts,   setImprovedPrompts]   = useState(false);

  const handleSavePrompts = () => {
    localStorage.setItem(COMPLEXITY_PROMPTS_KEY, JSON.stringify(complexityPrompts));
    localStorage.setItem(COMPLEXITY_FORMULA_KEY, formula);
    setSavedPrompts(true);
    setTimeout(() => setSavedPrompts(false), 2000);
  };

  const handleImprovePrompts = () => {
    setComplexityPrompts(DEFAULT_COMPLEXITY_PROMPTS);
    localStorage.setItem(COMPLEXITY_PROMPTS_KEY, JSON.stringify(DEFAULT_COMPLEXITY_PROMPTS));
    localStorage.setItem(COMPLEXITY_FORMULA_KEY, formula);
    setImprovedPrompts(true);
    setActivePromptTab("combine");
    setTimeout(() => setImprovedPrompts(false), 3000);
  };

  useEffect(() => { setSaved(false); }, [s]);

  const update = (patch: Partial<RiskSettings>) => setS(prev => ({ ...prev, ...patch }));

  const save = () => {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
    window.dispatchEvent(new StorageEvent("storage", { key: LS_KEY, newValue: JSON.stringify(s) }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const theme = getTheme(isDark);

  return (
    <div className="space-y-5">

      {/* Переключатель вкладок */}
      <div className="flex gap-1 p-1 rounded-xl"
        style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", maxWidth: 640 }}>
        {([
          { key: "general",    label: "Общие правила",           icon: "Sliders" },
          { key: "complexity", label: "Сложность позиций прайса", icon: "Layers" },
          { key: "prompts",    label: "AI промпты",               icon: "Sparkles" },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setSubTab(tab.key)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition"
            style={{
              background: subTab === tab.key
                ? isDark ? "rgba(139,92,246,0.2)" : "rgba(139,92,246,0.12)"
                : "transparent",
              color: subTab === tab.key ? "#a78bfa" : isDark ? "rgba(255,255,255,0.4)" : "#9ca3af",
              border: subTab === tab.key ? "1px solid rgba(139,92,246,0.35)" : "1px solid transparent",
            }}>
            <Icon name={tab.icon} size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Общие правила */}
      {subTab === "general" && (
        <>
          <DiscountRiskScale s={s} isDark={isDark} theme={theme} />
          <DiscountRiskThresholds s={s} isDark={isDark} theme={theme} readOnly={readOnly} update={update} />
          {!readOnly && (
            <div className="flex items-center gap-3">
              <button onClick={save}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition hover:opacity-80"
                style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
                <Icon name={saved ? "Check" : "Save"} size={14} />
                {saved ? "Сохранено" : "Сохранить настройки"}
              </button>
              <span className={`text-[10px] ${theme.sub}`}>Настройки сохраняются локально</span>
            </div>
          )}
        </>
      )}

      {/* Сложность позиций прайса */}
      {subTab === "complexity" && (
        <DiscountRiskComplexity isDark={isDark} theme={theme} readOnly={readOnly} hidePrompts />
      )}

      {/* AI промпты */}
      {subTab === "prompts" && (
        <ComplexityAiPrompts
          isDark={isDark}
          theme={theme}
          readOnly={readOnly}
          formula={formula}
          setFormula={setFormula}
          complexityPrompts={complexityPrompts}
          setComplexityPrompts={setComplexityPrompts}
          activePromptTab={activePromptTab}
          setActivePromptTab={setActivePromptTab}
          savedPrompts={savedPrompts}
          onSavePrompts={handleSavePrompts}
          onImprovePrompts={handleImprovePrompts}
          improvedPrompts={improvedPrompts}
        />
      )}

    </div>
  );
}