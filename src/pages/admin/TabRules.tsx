import { useState, useCallback, useEffect } from "react";
import EditableCell from "./EditableCell";
import { apiFetch } from "./api";
import type { PriceItem } from "./types";

interface RuleItem extends PriceItem {
  calc_rule: string;
  bundle: string;
}

interface Props { token: string; }

export default function TabRules({ token }: Props) {
  const [items, setItems] = useState<RuleItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiFetch("prices");
    if (r.ok) { const d = await r.json(); setItems(d.items); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveField = async (item: RuleItem, field: "calc_rule" | "bundle", val: string) => {
    const updated = { ...item, [field]: val };
    await apiFetch("prices", { method: "PUT", body: JSON.stringify(updated) }, token, item.id);
    setItems(prev => prev.map(p => p.id === item.id ? updated : p));
  };

  const byCategory = items.reduce<Record<string, RuleItem[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  if (loading) return <p className="text-white/30 text-sm">Загрузка...</p>;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-white/50 text-sm">Нажмите на ячейку — редактируется как обычный текст, сохраняется мгновенно. Пишите инструкцию для AI в свободной форме.</p>

      {Object.entries(byCategory).map(([category, catItems]) => (
        <div key={category}>
          <h3 className="text-violet-300 text-xs font-semibold uppercase tracking-wider mb-2 px-1">{category}</h3>
          <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-white/30 font-normal px-4 py-2.5 w-[20%]">Позиция</th>
                  <th className="text-left text-white/30 font-normal px-4 py-2.5 w-[40%]">Если не указано количество — считать как</th>
                  <th className="text-left text-white/30 font-normal px-4 py-2.5">Логика привязки комплектов</th>
                </tr>
              </thead>
              <tbody>
                {catItems.map((item, idx) => (
                  <tr key={item.id}
                    className={`border-b border-white/5 last:border-0 ${!item.active ? "opacity-40" : ""} ${idx % 2 ? "bg-white/[0.01]" : ""}`}>
                    <td className="px-4 py-2.5 text-white/70 text-xs">{item.name}</td>
                    <td className="px-4 py-2.5 text-white/50 text-xs">
                      <EditableCell
                        value={item.calc_rule}
                        onSave={v => saveField(item, "calc_rule", v)}
                        placeholder="Например: взять 1/4 периметра"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-white/50 text-xs">
                      <EditableCell
                        value={item.bundle}
                        onSave={v => saveField(item, "bundle", v)}
                        placeholder="Например: добавить Лампа GX53 и Закладная под светильник"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
