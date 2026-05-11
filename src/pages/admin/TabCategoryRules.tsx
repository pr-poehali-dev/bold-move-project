import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { apiFetch } from "./api";

interface CategorySetting {
  category: string;
  is_material: boolean;
  category_rule: string;
}

interface Props { token: string; isDark?: boolean; readOnly?: boolean; }

// Парсим правило-строку в массив отдельных пунктов (по \n)
function parseRules(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw
    .split("\n")
    .map(s => s.trim().replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

function joinRules(rules: string[]): string {
  return rules.filter(Boolean).join("\n");
}

export default function TabCategoryRules({ token, isDark = true, readOnly = false }: Props) {
  const [items, setItems]       = useState<CategorySetting[]>([]);
  const [loading, setLoading]   = useState(true);
  // rules: распарсенные массивы для каждой категории
  const [rules, setRules]       = useState<Record<string, string[]>>({});
  const [saving, setSaving]     = useState<string | null>(null);
  const [saved, setSaved]       = useState<string | null>(null);
  // открытые категории
  const [open, setOpen]         = useState<Record<string, boolean>>({});
  // редактируемый пункт: {cat, idx} или null
  const [editing, setEditing]   = useState<{ cat: string; idx: number } | null>(null);
  const [editVal, setEditVal]   = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch("category_settings", undefined, token).then(r => r.ok && r.json().then(d => {
      setItems(d.items);
      const initRules: Record<string, string[]> = {};
      const initOpen:  Record<string, boolean>  = {};
      for (const it of d.items) {
        initRules[it.category] = parseRules(it.category_rule || "");
        initOpen[it.category]  = false;
      }
      setRules(initRules);
      setOpen(initOpen);
      setLoading(false);
    }));
  }, [token]);

  useEffect(() => {
    if (editing) editRef.current?.focus();
  }, [editing]);

  const saveCategory = async (cat: CategorySetting, newRules: string[]) => {
    setSaving(cat.category);
    const joined = joinRules(newRules);
    await apiFetch("category_settings", {
      method: "PUT",
      body: JSON.stringify({ category: cat.category, is_material: cat.is_material, category_rule: joined }),
    }, token);
    setItems(prev => prev.map(it => it.category === cat.category ? { ...it, category_rule: joined } : it));
    setSaving(null);
    setSaved(cat.category);
    setTimeout(() => setSaved(null), 2000);
  };

  const addRule = (cat: CategorySetting) => {
    const newRules = [...(rules[cat.category] || []), ""];
    setRules(prev => ({ ...prev, [cat.category]: newRules }));
    setEditing({ cat: cat.category, idx: newRules.length - 1 });
    setEditVal("");
  };

  const startEdit = (cat: string, idx: number, val: string) => {
    setEditing({ cat, idx });
    setEditVal(val);
  };

  const commitEdit = (cat: CategorySetting) => {
    if (!editing || editing.cat !== cat.category) return;
    const val = editVal.trim();
    const current = [...(rules[cat.category] || [])];
    if (!val) {
      // пустое — удаляем
      current.splice(editing.idx, 1);
    } else {
      current[editing.idx] = val;
    }
    setRules(prev => ({ ...prev, [cat.category]: current }));
    setEditing(null);
    setEditVal("");
    saveCategory(cat, current);
  };

  const deleteRule = (cat: CategorySetting, idx: number) => {
    const current = [...(rules[cat.category] || [])];
    current.splice(idx, 1);
    setRules(prev => ({ ...prev, [cat.category]: current }));
    if (editing?.cat === cat.category && editing.idx === idx) setEditing(null);
    saveCategory(cat, current);
  };

  const toggleOpen = (category: string) => setOpen(prev => ({ ...prev, [category]: !prev[category] }));

  const bd = isDark ? "border-white/[0.07]" : "border-gray-200";
  const text = isDark ? "text-white/85" : "text-gray-800";
  const sub  = isDark ? "text-white/35"  : "text-gray-400";

  if (loading) return (
    <div className="flex items-center gap-2 text-white/30 text-sm py-8">
      <Icon name="Loader" size={15} className="animate-spin" /> Загрузка...
    </div>
  );
  if (!items.length) return (
    <div className={`text-sm ${sub} py-8`}>Категории не найдены. Сначала добавьте позиции в прайс.</div>
  );

  return (
    <div className="flex flex-col gap-2">
      <p className={`text-xs ${sub} mb-1`}>
        Правило категории — общая инструкция для AI по всем позициям этой категории. Подставляется в промт автоматически.
      </p>

      {items.map(cat => {
        const catRules = rules[cat.category] || [];
        const isOpen   = !!open[cat.category];
        const isSaving = saving === cat.category;
        const isSaved  = saved === cat.category;
        const hasRules = catRules.length > 0;

        return (
          <div key={cat.category}
            className={`rounded-xl border ${bd} overflow-hidden transition-all`}
            style={{ background: isDark ? "rgba(255,255,255,0.025)" : "#f9f9fb" }}>

            {/* Заголовок категории — кликабельный */}
            <button
              className="w-full flex items-center justify-between px-4 py-3 gap-3 text-left transition hover:bg-white/[0.03]"
              onClick={() => toggleOpen(cat.category)}>
              <div className="flex items-center gap-2 min-w-0">
                <Icon name={isOpen ? "FolderOpen" : "Folder"} size={14}
                  className={hasRules ? "text-violet-400" : sub} />
                <span className={`font-semibold text-sm ${text}`}>{cat.category}</span>
                {!cat.is_material && <span className={`text-xs ${sub} italic`}>услуга</span>}
                {hasRules && !isOpen && (
                  <span className={`text-xs ${sub}`}>· {catRules.length} {catRules.length === 1 ? "правило" : catRules.length < 5 ? "правила" : "правил"}</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isSaving && <Icon name="Loader" size={12} className="animate-spin text-violet-400" />}
                {isSaved && !isSaving && <span className="text-green-400 text-xs flex items-center gap-1"><Icon name="Check" size={11} />Сохранено</span>}
                <Icon name={isOpen ? "ChevronUp" : "ChevronDown"} size={14} className={sub} />
              </div>
            </button>

            {/* Тело — только когда открыто */}
            {isOpen && (
              <div className={`border-t ${bd} px-4 py-3 flex flex-col gap-1`}>

                {/* Список правил */}
                {catRules.map((rule, idx) => {
                  const isEditingThis = editing?.cat === cat.category && editing.idx === idx;
                  return (
                    <div key={idx}
                      className={`group flex items-start gap-2 rounded-lg px-3 py-2 transition ${
                        isDark ? "hover:bg-white/[0.04]" : "hover:bg-gray-100"
                      }`}>
                      <span className={`text-xs mt-0.5 flex-shrink-0 font-mono ${sub}`}>{idx + 1}.</span>

                      {isEditingThis ? (
                        <input
                          ref={editRef}
                          value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onBlur={() => commitEdit(cat)}
                          onKeyDown={e => {
                            if (e.key === "Enter") { e.preventDefault(); commitEdit(cat); }
                            if (e.key === "Escape") { setEditing(null); setEditVal(""); }
                          }}
                          className={`flex-1 text-sm rounded-md px-2 py-0.5 outline-none border transition ${
                            isDark
                              ? "bg-white/10 border-violet-500 text-white"
                              : "bg-white border-violet-400 text-gray-900"
                          }`}
                        />
                      ) : (
                        <span
                          className={`flex-1 text-sm ${text} cursor-pointer`}
                          onClick={() => !readOnly && startEdit(cat.category, idx, rule)}>
                          {rule}
                        </span>
                      )}

                      {!readOnly && !isEditingThis && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                          <button onClick={() => startEdit(cat.category, idx, rule)}
                            className={`p-1 rounded transition ${isDark ? "hover:bg-white/10 text-white/40 hover:text-white/70" : "hover:bg-gray-200 text-gray-400 hover:text-gray-700"}`}>
                            <Icon name="Pencil" size={11} />
                          </button>
                          <button onClick={() => deleteRule(cat, idx)}
                            className="p-1 rounded transition hover:bg-red-500/15 text-white/30 hover:text-red-400">
                            <Icon name="X" size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Кнопка добавить правило */}
                {!readOnly && (
                  <button
                    onClick={() => addRule(cat)}
                    className={`flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-lg text-xs transition ${
                      isDark
                        ? "text-violet-400/70 hover:text-violet-300 hover:bg-violet-500/10"
                        : "text-violet-600/70 hover:text-violet-700 hover:bg-violet-50"
                    }`}>
                    <Icon name="Plus" size={12} />
                    Добавить правило
                  </button>
                )}

                {catRules.length === 0 && readOnly && (
                  <p className={`text-xs ${sub} px-3 py-2`}>Правила не заданы</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}