import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import {
  RiskSettings, LS_KEY,
  loadRiskSettings, getTheme,
} from "./discountRiskTypes";
import DiscountRiskScale from "./DiscountRiskScale";
import DiscountRiskThresholds from "./DiscountRiskThresholds";
import DiscountRiskComplexity from "./DiscountRiskComplexity";

interface Props { isDark?: boolean; readOnly?: boolean; }

export default function TabDiscountRisk({ isDark = true, readOnly = false }: Props) {
  const [s,     setS]     = useState<RiskSettings>(loadRiskSettings);
  const [saved, setSaved] = useState(false);

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
    <div className="space-y-5 max-w-2xl">
      <DiscountRiskScale s={s} isDark={isDark} theme={theme} />
      <DiscountRiskThresholds s={s} isDark={isDark} theme={theme} readOnly={readOnly} update={update} />
      <DiscountRiskComplexity isDark={isDark} theme={theme} readOnly={readOnly} />

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
    </div>
  );
}
