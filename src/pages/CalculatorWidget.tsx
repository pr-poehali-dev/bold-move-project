import { useState } from "react";
import Icon from "@/components/ui/icon";
import { CATALOG, ROOMS } from "./data";

export default function CalculatorWidget() {
  const [room, setRoom] = useState(0);
  const [ceilType, setCeilType] = useState(0);
  const [area, setArea] = useState(ROOMS[0].avg);
  const [heat, setHeat] = useState(false);
  const [lights, setLights] = useState(0);

  const basePrice = heat ? CATALOG[ceilType].priceHeat : CATALOG[ceilType].price;
  const lightPrice = lights * 450;
  const total = Math.round(area * ROOMS[room].koef * basePrice + lightPrice);
  const totalWithDiscount = Math.round(total * 0.9);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/3 p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center">
          <Icon name="Calculator" size={20} className="text-white" />
        </div>
        <div>
          <h3 className="font-montserrat font-black text-xl">Калькулятор стоимости</h3>
          <p className="text-white/40 text-xs">Мгновенный расчёт онлайн</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-white/50 text-xs font-montserrat uppercase tracking-widest mb-3">Тип помещения</label>
          <div className="grid grid-cols-2 gap-2">
            {ROOMS.map((r, i) => (
              <button key={i} onClick={() => { setRoom(i); setArea(r.avg); }}
                className={`px-3 py-2 rounded-xl text-xs font-montserrat font-semibold transition-all ${room === i ? "bg-orange-500 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"}`}>
                {r.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-white/50 text-xs font-montserrat uppercase tracking-widest mb-3">Тип потолка</label>
          <div className="grid grid-cols-2 gap-2">
            {CATALOG.slice(0, 6).map((c, i) => (
              <button key={i} onClick={() => setCeilType(i)}
                className={`px-3 py-2 rounded-xl text-xs font-montserrat font-semibold transition-all text-left ${ceilType === i ? "bg-orange-500 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"}`}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="text-white/50 text-xs font-montserrat uppercase tracking-widest">Площадь</label>
          <span className="font-montserrat font-black text-2xl text-orange-400">{area} <span className="text-sm text-white/40">м²</span></span>
        </div>
        <input type="range" min={4} max={120} value={area} onChange={e => setArea(Number(e.target.value))}
          className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:cursor-pointer" />
        <div className="flex justify-between text-white/25 text-xs mt-1"><span>4 м²</span><span>120 м²</span></div>
      </div>
      <div className="flex flex-wrap gap-4 mb-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <div onClick={() => setHeat(!heat)}
            className={`w-5 h-5 rounded-md border transition-all flex items-center justify-center cursor-pointer ${heat ? "bg-orange-500 border-orange-500" : "border-white/20 bg-white/5"}`}>
            {heat && <Icon name="Check" size={12} className="text-white" />}
          </div>
          <span className="text-sm text-white/60">Тепловое ПВХ полотно (+15%)</span>
        </label>
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/60">Светильники:</span>
          <button onClick={() => setLights(Math.max(0, lights - 1))} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center">
            <Icon name="Minus" size={14} className="text-white" />
          </button>
          <span className="font-montserrat font-bold text-white w-6 text-center">{lights}</span>
          <button onClick={() => setLights(Math.min(20, lights + 1))} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center">
            <Icon name="Plus" size={14} className="text-white" />
          </button>
          <span className="text-white/40 text-xs">× 450 ₽</span>
        </div>
      </div>
      <div className="rounded-2xl bg-gradient-to-r from-orange-500/15 to-rose-500/15 border border-orange-500/25 p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="text-white/50 text-sm mb-1">Примерная стоимость</div>
            <div className="font-montserrat font-black text-4xl text-white">{total.toLocaleString("ru")} <span className="text-xl text-orange-400">₽</span></div>
            <div className="text-white/40 text-xs mt-1">Точный расчёт — при бесплатном замере</div>
          </div>
          <div className="text-right">
            <div className="text-white/40 text-xs mb-1">Акция: скидка 10% онлайн</div>
            <div className="font-montserrat font-black text-2xl text-orange-400">{totalWithDiscount.toLocaleString("ru")} ₽</div>
            <a href="#contact" className="inline-flex items-center gap-1 mt-2 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-xs font-montserrat font-bold px-4 py-2 rounded-xl hover:scale-105 transition-transform">
              Заказать со скидкой <Icon name="ArrowRight" size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
