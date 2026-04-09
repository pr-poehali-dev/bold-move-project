import { PORTFOLIO_ITEMS } from "./data/portfolio";

const ITEMS = PORTFOLIO_ITEMS.slice(0, 14);
const ROW1  = ITEMS.slice(0, 7);
const ROW2  = ITEMS.slice(7, 14);

function MarqueeRow({ items, reverse = false, duration = "32s" }: {
  items: typeof PORTFOLIO_ITEMS;
  reverse?: boolean;
  duration?: string;
}) {
  const doubled = [...items, ...items];
  return (
    <div className="relative flex overflow-hidden" style={{ "--marquee-gap": "0.75rem", "--marquee-duration": duration } as React.CSSProperties}>
      {/* fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#0b0b11] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#0b0b11] to-transparent" />

      <div
        className="animate-marquee flex shrink-0 gap-3"
        style={{ animationDirection: reverse ? "reverse" : "normal" }}
      >
        {doubled.map((item, i) => (
          <div key={i} className="group relative w-48 shrink-0 overflow-hidden rounded-2xl">
            <div className="aspect-[3/4] w-full overflow-hidden">
              <img
                src={item.img}
                alt={item.type}
                className="h-full w-full object-cover grayscale transition-all duration-500 group-hover:grayscale-0 group-hover:scale-105"
                loading="lazy"
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 rounded-b-2xl bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <p className="text-white text-xs font-semibold leading-tight">{item.type}</p>
              <p className="text-white/60 text-[10px]">{item.room} · {item.district} · {item.area} м²</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PortfolioMarquee() {
  return (
    <div className="w-full overflow-hidden py-3 space-y-3">
      <MarqueeRow items={ROW1} duration="35s" />
      <MarqueeRow items={ROW2} reverse duration="28s" />
    </div>
  );
}
