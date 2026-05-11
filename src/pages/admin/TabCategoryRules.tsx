import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { apiFetch } from "./api";

interface CategorySetting {
  category: string;
  is_material: boolean;
  category_rule: string;
}

interface Props { token: string; isDark?: boolean; readOnly?: boolean; }

export default function TabCategoryRules({ token, isDark = true, readOnly = false }: Props) {
  const [items, setItems] = useState<CategorySetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("category_settings").then(r => r.ok && r.json().then(d => {
      setItems(d.items);
      const init: Record<string, string> = {};
      for (const it of d.items) init[it.category] = it.category_rule || "";
      setDrafts(init);
      setLoading(false);
    }));
  }, []);

  const handleSave = async (cat: CategorySetting) => {
    if (readOnly) return;
    setSaving(cat.category);
    await apiFetch("category_settings", {
      method: "PUT",
      body: JSON.stringify({
        category: cat.category,
        is_material: cat.is_material,
        category_rule: drafts[cat.category] ?? "",
      }),
    }, token);
    setSaving(null);
    setSaved(cat.category);
    setTimeout(() => setSaved(null), 2000);
    setItems(prev => prev.map(it =>
      it.category === cat.category ? { ...it, category_rule: drafts[cat.category] ?? "" } : it
    ));
  };

  const border = isDark ? "border-white/8" : "border-gray-200";
  const bg     = isDark ? "bg-white/[0.03]" : "bg-gray-50";
  const text   = isDark ? "text-white/80" : "text-gray-800";
  const subtext = isDark ? "text-white/35" : "text-gray-400";
  const inputCls = `w-full resize-none rounded-xl border px-3 py-2.5 text-sm font-mono outline-none transition ${
    isDark
      ? "bg-white/5 border-white/10 text-white placeholder-white/20 focus:border-violet-500"
      : "bg-white border-gray-200 text-gray-900 placeholder-gray-300 focus:border-violet-400"
  }`;

  if (loading) return (
    <div className="flex items-center gap-2 text-white/30 text-sm py-8">
      <Icon name="Loader" size={15} className="animate-spin" /> Загрузка...
    </div>
  );

  if (!items.length) return (
    <div className={`text-sm ${subtext} py-8`}>Категории не найдены. Сначала добавьте позиции в прайс.</div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className={`text-xs ${subtext} -mt-1`}>
        Правило категории — общая инструкция для AI по всем позициям этой категории. Подставляется в промт автоматически.
      </div>

      <div className="flex flex-col gap-3">
        {items.map(cat => {
          const draft = drafts[cat.category] ?? "";
          const isDirty = draft !== (cat.category_rule || "");
          const isSaving = saving === cat.category;
          const isSaved = saved === cat.category;

          return (
            <div key={cat.category}
              className={`rounded-xl border ${border} ${bg} px-4 py-3 flex flex-col gap-2`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon name="FolderOpen" size={13} className="text-violet-400 flex-shrink-0" />
                  <span className={`font-semibold text-sm ${text}`}>{cat.category}</span>
                  {!cat.is_material && (
                    <span className={`text-xs ${subtext} italic`}>услуга</span>
                  )}
                </div>
                {!readOnly && (
                  <button
                    onClick={() => handleSave(cat)}
                    disabled={isSaving || !isDirty}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition disabled:opacity-40"
                    style={{
                      background: isSaved ? "rgba(34,197,94,0.15)" : isDirty ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.04)",
                      color: isSaved ? "#4ade80" : isDirty ? "#c4b5fd" : (isDark ? "rgba(255,255,255,0.25)" : "#9ca3af"),
                    }}>
                    {isSaving
                      ? <><Icon name="Loader" size={11} className="animate-spin" /> Сохраняю</>
                      : isSaved
                        ? <><Icon name="Check" size={11} /> Сохранено</>
                        : isDirty
                          ? <><Icon name="Save" size={11} /> Сохранить</>
                          : <><Icon name="Check" size={11} /> Актуально</>
                    }
                  </button>
                )}
              </div>

              <textarea
                value={draft}
                onChange={e => setDrafts(prev => ({ ...prev, [cat.category]: e.target.value }))}
                readOnly={readOnly}
                rows={3}
                placeholder={`Правило для категории «${cat.category}»... например: "всегда предлагать вместе с монтажом"`}
                className={inputCls}
              />

              {draft && (
                <div className={`text-xs ${subtext} flex items-center gap-1`}>
                  <Icon name="Bot" size={11} />
                  AI увидит: «{cat.category}: {draft.slice(0, 80)}{draft.length > 80 ? "…" : ""}»
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
