import { useState } from "react";
import { REVIEWS, FAQ } from "./data/content";

// ─── SharedPanelReviews ───────────────────────────────────────────────────────
// Shared reviews panel (AiHub style, no PanelHeader, no onClose)
export function SharedPanelReviews() {
  return (
    <div className="h-full overflow-y-auto p-3 md:p-4">
      <div className="space-y-3">
        {REVIEWS.slice(0, 4).map((r, i) => (
          <div key={i} className="rounded-2xl border border-white/8 bg-white/3 p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {r.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-white font-semibold text-sm truncate">{r.name}</span>
                  <span className="text-white/30 text-xs shrink-0">{r.date}</span>
                </div>
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: r.rating }).map((_, s) => (
                    <span key={s} className="text-amber-400 text-xs">★</span>
                  ))}
                  <span className="text-white/30 text-xs ml-1">{r.city}</span>
                </div>
                <p className="text-white/60 text-xs leading-relaxed">{r.text}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 bg-white/5 rounded-lg px-2.5 py-1">
                  <span className="text-orange-400 text-[10px]">🏠</span>
                  <span className="text-white/40 text-[10px]">{r.type} · {r.area} м²</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SharedPanelFaq ───────────────────────────────────────────────────────────
// Shared FAQ panel (AiHub style, no PanelHeader, no onClose)
export function SharedPanelFaq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="h-full overflow-y-auto p-3 md:p-4">
      <div className="space-y-2">
        {FAQ.map((item, i) => (
          <div key={i} className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-white/4 transition-colors"
            >
              <span className="text-white text-sm font-medium leading-snug">{item.q}</span>
              <span className={`text-white/40 text-lg shrink-0 transition-transform duration-200 ${open === i ? "rotate-45" : ""}`}>+</span>
            </button>
            <div className={`overflow-hidden transition-all duration-200 ${open === i ? "max-h-48" : "max-h-0"}`}>
              <p className="px-4 pb-4 text-white/55 text-xs leading-relaxed">{item.a}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
