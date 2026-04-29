import Icon from "@/components/ui/icon";
import { PACKAGES } from "./pricingData";

interface Props {
  selected: string | null;
  onSelect: (id: string) => void;
}

export default function PricingPackages({ selected, onSelect }: Props) {
  return (
    <section className="max-w-6xl mx-auto px-5 pb-14">

      {/* ── МОБИЛЕ: вертикальный список на всю ширину ── */}
      <div className="flex flex-col gap-3 sm:hidden">
        {PACKAGES.map(pkg => {
          const isSelected = selected === pkg.id;
          return (
            <div key={pkg.id}
              onClick={() => onSelect(pkg.id)}
              className="relative rounded-2xl cursor-pointer transition-all active:scale-[0.99]"
              style={{
                background: isSelected ? `linear-gradient(135deg, ${pkg.glow}, rgba(8,8,15,0.95))` : "rgba(255,255,255,0.03)",
                border: `1.5px solid ${isSelected ? pkg.color : "rgba(255,255,255,0.07)"}`,
              }}>

              {pkg.badge && (
                <div className="absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider"
                  style={{ background: pkg.color, color: "#0a0a14" }}>
                  {pkg.badge}
                </div>
              )}

              <div className="flex items-center gap-4 px-4 py-4">
                {/* Левая часть: название + цена */}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: pkg.color }}>
                    {pkg.name}
                  </div>
                  <div className="flex items-baseline gap-1 mb-0.5">
                    <span className="text-2xl font-black text-white">{pkg.price.toLocaleString("ru-RU")}</span>
                    <span className="text-sm text-white/30">₽</span>
                  </div>
                  <div className="text-[10px] text-white/35">{pkg.perEstimate} ₽ за одну смету</div>
                </div>

                {/* Правая часть: смет на балансе + кнопка */}
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                    style={{ background: pkg.glow }}>
                    <Icon name="Calculator" size={12} style={{ color: pkg.color }} />
                    <span className="text-xs font-bold whitespace-nowrap" style={{ color: pkg.color }}>
                      {pkg.estimates} смет
                    </span>
                  </div>
                  <button
                    className="px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap"
                    style={{
                      background: isSelected ? pkg.color : "rgba(255,255,255,0.07)",
                      color: isSelected ? "#0a0a14" : "#fff",
                      border: `1px solid ${isSelected ? pkg.color : "rgba(255,255,255,0.1)"}`,
                    }}>
                    {isSelected ? "✓ Выбран" : "Выбрать"}
                  </button>
                </div>
              </div>

              {/* Фичи — одна колонка */}
              <div className="px-4 pb-3 flex flex-col gap-1">
                {pkg.features.map(f => (
                  <div key={f} className="flex items-center gap-1.5 text-[11px] text-white/45">
                    <Icon name="Check" size={10} style={{ color: pkg.color, flexShrink: 0 }} />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── ДЕСКТОП: сетка 4 колонки ── */}
      <div id="packages-grid" className="hidden sm:grid md:grid-cols-2 lg:grid-cols-4 gap-4 scroll-mt-10">
        {PACKAGES.map(pkg => {
          const isSelected = selected === pkg.id;
          const isPopular  = pkg.badge === "Популярный";
          return (
            <div key={pkg.id}
              onClick={() => onSelect(pkg.id)}
              className={`relative rounded-3xl p-5 cursor-pointer transition-all hover:-translate-y-1 ${isPopular ? "md:scale-[1.03]" : ""}`}
              style={{
                background: isSelected ? `linear-gradient(180deg, ${pkg.glow}, rgba(8,8,15,0.9))` : "rgba(255,255,255,0.025)",
                border: `1.5px solid ${isSelected ? pkg.color : "rgba(255,255,255,0.06)"}`,
                boxShadow: isPopular ? `0 0 40px ${pkg.glow}` : "none",
              }}>

              {pkg.badge && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider whitespace-nowrap"
                  style={{ background: pkg.color, color: "#0a0a14" }}>
                  {pkg.badge}
                </div>
              )}

              <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: pkg.color }}>
                {pkg.name}
              </div>
              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="text-3xl font-black">{pkg.price.toLocaleString("ru-RU")}</span>
                <span className="text-sm text-white/30">₽</span>
              </div>
              <div className="text-[10px] text-white/35 mb-4">
                {pkg.perEstimate} ₽ за одну смету
              </div>

              <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4"
                style={{ background: pkg.glow }}>
                <Icon name="Calculator" size={13} style={{ color: pkg.color }} />
                <span className="text-xs font-bold" style={{ color: pkg.color }}>
                  {pkg.estimates} смет на балансе
                </span>
              </div>

              <ul className="space-y-1.5 mb-5">
                {pkg.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-[11px] text-white/55 leading-snug">
                    <Icon name="Check" size={11} style={{ color: pkg.color, marginTop: 3 }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                className="w-full py-2.5 rounded-xl text-xs font-bold transition"
                style={{
                  background: isSelected ? pkg.color : "rgba(255,255,255,0.05)",
                  color: isSelected ? "#0a0a14" : "#fff",
                  border: `1px solid ${isSelected ? pkg.color : "rgba(255,255,255,0.08)"}`,
                }}>
                {isSelected ? "✓ Выбран" : "Выбрать"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end mt-3">
        <div className="flex items-center gap-1.5 text-[11px] text-white/30">
          <Icon name="Info" size={11} />
          1 смета = 1 объект (квартира, офис, дом — любой замер)
        </div>
      </div>
    </section>
  );
}