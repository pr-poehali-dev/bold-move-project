import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { apiFetch } from "./api";

interface Props { token: string; }

interface PriceItem { category: string; name: string; price: number; unit: string; description: string; active: boolean; }

export default function TabPrompt({ token }: Props) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [showPrices, setShowPrices] = useState(false);

  useEffect(() => {
    const cp = sessionStorage.getItem("adm_prompt");
    if (cp) { setContent(cp); } else {
      apiFetch("prompt").then(r => r.ok && r.json().then(d => { setContent(d.content); sessionStorage.setItem("adm_prompt", d.content); }));
    }
    const cpr = sessionStorage.getItem("adm_prices");
    if (cpr) { setPrices(JSON.parse(cpr).filter((p: PriceItem) => p.active)); } else {
      apiFetch("prices").then(r => r.ok && r.json().then(d => setPrices(d.items.filter((p: PriceItem) => p.active))));
    }
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

  return (
    <div className="flex flex-col gap-6">

      {/* Инструкции для AI */}
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-white font-medium text-sm">Инструкции для AI</p>
          <p className="text-white/40 text-xs mt-0.5">Правила расчёта, ограничения, формат ответа. Прайс подставляется автоматически из вкладки «Цены» — его здесь писать не нужно.</p>
        </div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={22}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono resize-y outline-none focus:border-violet-500 transition"
        />
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving}
            className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg px-6 py-2 font-medium transition">
            {saving ? "Сохраняю..." : "Сохранить"}
          </button>
          {msg && <span className={`text-sm ${msg.includes("Ошибка") ? "text-red-400" : "text-green-400"}`}>{msg}</span>}
        </div>
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
            <p className="text-white/30 text-xs">Редактируется во вкладке «Цены». Здесь только просмотр — именно это видит AI при каждом запросе.</p>
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