import { useState } from "react";
import { CATALOG } from "./data/catalog";
import { PORTFOLIO_ITEMS } from "./data/portfolio";
import { SharedPanelReviews, SharedPanelFaq } from "./sharedPanels";

// ─── sub-panels ──────────────────────────────────────────────────────────────

export function PanelCatalog() {
  return (
    <div className="h-full overflow-y-auto p-3 md:p-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {CATALOG.slice(0, 6).map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/15 transition-all group overflow-hidden cursor-pointer"
            onClick={() => alert(`${item.name}\n${item.desc}\n\nЦена: от ${item.price} ₽/м²`)}
          >
            <div className={`h-16 bg-gradient-to-br ${item.color} flex items-center justify-center text-2xl`}>
              🏠
            </div>
            <div className="p-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-white text-sm truncate">{item.name}</span>
                {item.popular && (
                  <span className="text-[9px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full shrink-0 ml-1">Хит</span>
                )}
              </div>
              <div className="text-xs text-white/40 mb-2 line-clamp-2 leading-relaxed">{item.desc.slice(0, 60)}…</div>
              <div className="flex items-center justify-between">
                <span className="text-orange-400 font-bold text-sm">от {item.price} ₽/м²</span>
                <button
                  className="text-[10px] bg-white/8 hover:bg-white/15 text-white/60 px-2 py-1 rounded-lg transition-colors"
                  onClick={(e) => { e.stopPropagation(); alert(`${item.name}\n${item.desc}\n\nЦена: от ${item.price} ₽/м²`); }}
                >
                  Подробнее
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PanelCalc() {
  const [area, setArea] = useState("");
  const [type, setType] = useState("matte");
  const [result, setResult] = useState<number | null>(null);

  const calc = () => {
    const a = parseFloat(area);
    if (!a || a <= 0) return;
    const item = CATALOG.find((c) => c.id === type) ?? CATALOG[1];
    const price = item.price;
    const montage = 350;
    setResult(Math.round(a * (price + montage)));
  };

  return (
    <div className="h-full flex items-start justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="text-2xl mb-1">🧮</div>
          <div className="text-white font-semibold text-sm mb-0.5">Быстрый расчёт</div>
          <div className="text-white/40 text-xs">Введите площадь и выберите тип потолка</div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-white/50 uppercase tracking-wider">Площадь, м²</label>
          <input
            type="number"
            value={area}
            onChange={(e) => { setArea(e.target.value); setResult(null); }}
            placeholder="Например: 18"
            className="w-full bg-white/5 border border-white/10 focus:border-violet-500/50 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors placeholder:text-white/25"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-white/50 uppercase tracking-wider">Тип потолка</label>
          <select
            value={type}
            onChange={(e) => { setType(e.target.value); setResult(null); }}
            className="w-full bg-white/5 border border-white/10 focus:border-violet-500/50 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors"
          >
            {CATALOG.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#1a1a2e]">
                {c.name} — от {c.price} ₽/м²
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={calc}
          className="w-full bg-gradient-to-r from-violet-600 to-orange-500 hover:from-violet-500 hover:to-orange-400 text-white font-semibold py-3 rounded-xl text-sm transition-all active:scale-95"
        >
          Рассчитать стоимость
        </button>

        {result !== null && (
          <div className="rounded-2xl border border-violet-500/30 bg-violet-500/8 p-4 text-center animate-fade-in">
            <div className="text-white/50 text-xs mb-1">Ориентировочная стоимость</div>
            <div className="text-3xl font-bold text-white mb-0.5">
              {result.toLocaleString("ru-RU")} ₽
            </div>
            <div className="text-white/35 text-xs">включая материал и монтаж</div>
            <div className="mt-3 text-[10px] text-white/25">
              Точную цену назовёт замерщик на бесплатном выезде
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function PanelPortfolio() {
  const items = PORTFOLIO_ITEMS.slice(0, 8);
  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="relative rounded-xl overflow-hidden aspect-square cursor-pointer group"
            onClick={() => alert(`${item.room} • ${item.district}\n${item.type} • ${item.area} м² • ${item.year}`)}
          >
            <img
              src={item.img}
              alt={item.room}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
              <div>
                <div className="text-white text-xs font-semibold leading-tight">{item.type}</div>
                <div className="text-white/60 text-[10px]">{item.district} · {item.area} м²</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PanelAiTips({ onAsk }: { onAsk: (q: string) => void }) {
  const tips = [
    { icon: "💡", label: "Сколько стоит потолок 20 м²?" },
    { icon: "🏠", label: "Какой потолок выбрать для ванной?" },
    { icon: "⚡", label: "Что входит в стоимость монтажа?" },
    { icon: "🌟", label: "Расскажи про звёздное небо" },
    { icon: "📅", label: "Сколько времени займёт установка?" },
    { icon: "🛡️", label: "Какая гарантия на потолки?" },
  ];
  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto">
      <div className="text-center mb-4">
        <div className="text-3xl mb-2">🤖</div>
        <div className="text-white font-semibold text-sm">Спросите AI-помощника</div>
        <div className="text-white/40 text-xs mt-1">Нажмите на вопрос — он отправится в чат выше</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {tips.map((t, i) => (
          <button
            key={i}
            onClick={() => onAsk(t.label)}
            className="flex items-center gap-3 bg-white/4 hover:bg-white/8 border border-white/8 hover:border-violet-500/30 rounded-xl px-4 py-3 text-left transition-all group"
          >
            <span className="text-lg shrink-0">{t.icon}</span>
            <span className="text-white/70 group-hover:text-white text-xs transition-colors leading-snug">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function PanelReviews() {
  return <SharedPanelReviews />;
}

export function PanelFaq() {
  return <SharedPanelFaq />;
}

export function PanelContacts({ onSent }: { onSent: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) { alert("Заполните имя и email"); return; }
    onSent();
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-md mx-auto space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: "📞", label: "Телефон", val: "+7 (977) 606-89-01", href: "tel:+79776068901" },
            { icon: "✉️", label: "Email",   val: "info@mospotolki.net", href: "mailto:info@mospotolki.net" },
            { icon: "📍", label: "Адрес",   val: "Мытищи, Пограничная 24", href: "#" },
            { icon: "🕐", label: "Часы",    val: "Пн–Вс 8:00–21:00", href: "#" },
          ].map((c, i) => (
            <a
              key={i}
              href={c.href}
              className="flex items-start gap-3 bg-white/4 hover:bg-white/7 border border-white/8 rounded-2xl p-3 transition-colors group"
            >
              <span className="text-xl">{c.icon}</span>
              <div>
                <div className="text-white/40 text-[10px] uppercase tracking-wider">{c.label}</div>
                <div className="text-white text-xs font-medium mt-0.5 group-hover:text-violet-300 transition-colors">{c.val}</div>
              </div>
            </a>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="text-xs text-white/40 uppercase tracking-wider pt-1">Обратная связь</div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ваше имя"
              className="w-full bg-white/5 border border-white/10 focus:border-violet-500/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none transition-colors placeholder:text-white/20"
            />
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full bg-white/5 border border-white/10 focus:border-violet-500/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none transition-colors placeholder:text-white/20"
            />
          </div>
          <textarea
            value={msg} onChange={(e) => setMsg(e.target.value)}
            placeholder="Ваш вопрос или комментарий"
            rows={3}
            className="w-full bg-white/5 border border-white/10 focus:border-violet-500/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none transition-colors placeholder:text-white/20 resize-none"
          />
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-violet-600 to-orange-500 hover:from-violet-500 hover:to-orange-400 text-white font-semibold py-3 rounded-xl text-sm transition-all active:scale-95"
          >
            Отправить сообщение
          </button>
        </form>
      </div>
    </div>
  );
}