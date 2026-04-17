import { useState, useCallback, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { apiFetch } from "./api";
import type { PriceItem } from "./types";

interface Props { token: string; }

// Примеры правил для подсказки
const RULE_EXAMPLES = [
  { label: "× площадь", value: "area*1.0",         hint: "умножить на площадь (м²)" },
  { label: "× периметр", value: "perimeter*1.0",    hint: "умножить на периметр (пм)" },
  { label: "¼ периметра", value: "perimeter*0.25",  hint: "четверть периметра — дефолт для ниш" },
  { label: "½ периметра", value: "perimeter*0.5",   hint: "половина периметра" },
  { label: "Фиксировано", value: "const:1",          hint: "всегда 1 штука" },
  { label: "Фиксировано", value: "const:2",          hint: "всегда 2 штуки" },
];

function RuleRow({ item, allItems, token, onUpdate }: {
  item: PriceItem & { calc_rule: string; bundle: string };
  allItems: (PriceItem & { calc_rule: string; bundle: string })[];
  token: string;
  onUpdate: () => void;
}) {
  const [rule, setRule] = useState(item.calc_rule);
  const [bundleIds, setBundleIds] = useState<number[]>(() => {
    try { return JSON.parse(item.bundle || "[]"); } catch { return []; }
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    await apiFetch("prices", {
      method: "PUT",
      body: JSON.stringify({ ...item, calc_rule: rule, bundle: JSON.stringify(bundleIds) }),
    }, token, item.id);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onUpdate();
  };

  const toggleBundle = (id: number) => {
    setBundleIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const bundleNames = bundleIds
    .map(id => allItems.find(p => p.id === id)?.name)
    .filter(Boolean);

  const isDirty = rule !== item.calc_rule || JSON.stringify(bundleIds) !== (item.bundle || "[]");

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 flex flex-col gap-3">
      {/* Заголовок */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-white font-medium text-sm">{item.name}</span>
          <span className="text-white/30 text-xs ml-2">{item.category} · {item.price} ₽/{item.unit}</span>
        </div>
        {(isDirty || saved) && (
          <button onClick={save} disabled={saving}
            className={`text-xs px-3 py-1 rounded-lg transition flex-shrink-0 ${
              saved ? "bg-green-500/20 text-green-400" : "bg-violet-600 hover:bg-violet-700 text-white"
            }`}>
            {saving ? "…" : saved ? "✓ Сохранено" : "Сохранить"}
          </button>
        )}
      </div>

      {/* Правило расчёта */}
      <div>
        <label className="text-white/40 text-xs mb-1.5 block flex items-center gap-1">
          <Icon name="Calculator" size={12} />
          Если клиент не указал количество — считать как:
        </label>
        <div className="flex gap-1.5 flex-wrap mb-2">
          {RULE_EXAMPLES.map(ex => (
            <button key={ex.value}
              onClick={() => setRule(ex.value)}
              title={ex.hint}
              className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                rule === ex.value
                  ? "bg-violet-500/20 border-violet-500/50 text-violet-300"
                  : "border-white/10 text-white/40 hover:text-white/70 hover:border-white/20"
              }`}>
              {ex.label} ({ex.value})
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <input
            value={rule}
            onChange={e => setRule(e.target.value)}
            placeholder="Например: perimeter*0.25 или const:1 или area*1.3"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm font-mono outline-none focus:border-violet-500 transition"
          />
          {rule && (
            <button onClick={() => setRule("")} className="text-white/20 hover:text-white/50 transition">
              <Icon name="X" size={14} />
            </button>
          )}
        </div>
        <p className="text-white/25 text-xs mt-1">
          Доступные переменные: <code className="text-white/40">area</code> (площадь м²) · <code className="text-white/40">perimeter</code> (периметр пм) · <code className="text-white/40">const:N</code> (фиксированное число)
        </p>
      </div>

      {/* Комплект */}
      <div>
        <label className="text-white/40 text-xs mb-1.5 block flex items-center gap-1">
          <Icon name="Package" size={12} />
          Автоматически добавлять в смету:
          {bundleNames.length > 0 && (
            <span className="text-violet-300 ml-1">{bundleNames.join(", ")}</span>
          )}
        </label>
        <div className="flex gap-1.5 flex-wrap max-h-32 overflow-y-auto">
          {allItems.filter(p => p.id !== item.id && p.active).map(p => (
            <button key={p.id}
              onClick={() => toggleBundle(p.id)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                bundleIds.includes(p.id)
                  ? "bg-violet-500/20 border-violet-500/50 text-violet-300"
                  : "border-white/10 text-white/30 hover:text-white/60 hover:border-white/20"
              }`}>
              {p.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TabRules({ token }: Props) {
  const [items, setItems] = useState<(PriceItem & { calc_rule: string; bundle: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiFetch("prices");
    if (r.ok) { const d = await r.json(); setItems(d.items); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = ["all", ...Array.from(new Set(items.map(i => i.category)))];

  const filtered = items.filter(i => {
    if (filterCat !== "all" && i.category !== filterCat) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <p className="text-white/30 text-sm">Загрузка...</p>;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-white/50 text-sm">Правила для каждой позиции: что считать если клиент не указал количество, и что добавлять автоматически в комплект.</p>
        <div className="mt-2 text-white/30 text-xs space-y-0.5">
          <p><code className="text-violet-400">perimeter*0.25</code> — четверть периметра (дефолт для ниш)</p>
          <p><code className="text-violet-400">area*1.3</code> — площадь × коэффициент</p>
          <p><code className="text-violet-400">const:1</code> — фиксированное значение (1 штука)</p>
        </div>
      </div>

      {/* Фильтры */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск позиции..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-white text-sm outline-none focus:border-violet-500" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilterCat(cat)}
              className={`text-xs px-3 py-2 rounded-lg border transition ${
                filterCat === cat
                  ? "bg-violet-600/20 border-violet-500/50 text-violet-300"
                  : "border-white/10 text-white/40 hover:text-white/70"
              }`}>
              {cat === "all" ? "Все" : cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {filtered.length === 0 && (
          <p className="text-white/30 text-sm text-center py-8">Ничего не найдено</p>
        )}
        {filtered.map(item => (
          <RuleRow key={item.id} item={item} allItems={items} token={token} onUpdate={load} />
        ))}
      </div>
    </div>
  );
}
