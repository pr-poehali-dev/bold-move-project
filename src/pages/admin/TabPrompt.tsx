import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "./api";
import TabPromptEditor, { buildTemplateGeneral, buildTemplateSystem, TEMPLATE_FORMAT, TEMPLATE_PLAN } from "./TabPromptEditor";
import TabPromptRulesPreview from "./TabPromptRulesPreview";
import TabPromptPricesPreview from "./TabPromptPricesPreview";

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
interface CategorySetting { category: string; is_material: boolean; category_rule: string; }

const SEP_G = "##GENERAL##";
const SEP_S = "##SYSTEM##";
const SEP_F = "##FORMAT##";
const SEP_P = "##PLAN##";
const rebuildContent = (gen: string, sys: string, fmt: string, plan: string) =>
  `${SEP_G}\n${gen}\n${SEP_S}\n${sys}\n${SEP_F}\n${fmt}\n${SEP_P}\n${plan}`;

export default function TabPrompt({ token, isDark = true, readOnly = false, user }: Props) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [categorySettings, setCategorySettings] = useState<CategorySetting[]>([]);
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
    apiFetch("rule-types", undefined, token);
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

  const partsRef = useRef({ generalPart, systemPart, formatPart, planPart });
  partsRef.current = { generalPart, systemPart, formatPart, planPart };

  const handleGeneralChange = useCallback((val: string) => {
    const { systemPart: s, formatPart: f, planPart: p } = partsRef.current;
    handleContentChange(rebuildContent(val, s, f, p));
  }, []);

  const handleSystemChange = useCallback((val: string) => {
    const { generalPart: g, formatPart: f, planPart: p } = partsRef.current;
    handleContentChange(rebuildContent(g, val, f, p));
  }, []);

  const handleFormatChange = useCallback((val: string) => {
    const { generalPart: g, systemPart: s, planPart: p } = partsRef.current;
    handleContentChange(rebuildContent(g, s, val, p));
  }, []);

  const handlePlanChange = useCallback((val: string) => {
    const { generalPart: g, systemPart: s, formatPart: f } = partsRef.current;
    handleContentChange(rebuildContent(g, s, f, val));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <TabPromptEditor
        isDark={isDark}
        readOnly={readOnly}
        saving={saving}
        msg={msg}
        dirty={dirty}
        generalPart={generalPart}
        systemPart={systemPart}
        formatPart={formatPart}
        planPart={planPart}
        user={user}
        onGeneralChange={handleGeneralChange}
        onSystemChange={handleSystemChange}
        onFormatChange={handleFormatChange}
        onPlanChange={handlePlanChange}
        onSave={save}
      />

      <TabPromptRulesPreview
        rulesByCategory={rulesByCategory}
        categorySettings={categorySettings}
        idToName={idToName}
      />

      <TabPromptPricesPreview
        byCategory={byCategory}
        totalCount={prices.length}
      />
    </div>
  );
}
