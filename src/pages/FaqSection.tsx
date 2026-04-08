import { useState } from "react";
import Icon from "@/components/ui/icon";
import { FAQ } from "./data";

interface Props {
  faqRef: { ref: React.RefObject<HTMLDivElement>; inView: boolean };
}

export default function FaqSection({ faqRef }: Props) {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  return (
    <section id="faq" className="py-16 md:py-24 bg-gradient-to-b from-transparent via-white/2 to-transparent">
      <div ref={faqRef.ref} className="max-w-4xl mx-auto px-4">
        <div className={`mb-10 text-center transition-all duration-700 ${faqRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
          <div className="inline-flex items-center gap-2 text-orange-400 text-xs font-montserrat font-bold uppercase tracking-[0.2em] mb-4">
            <div className="w-8 h-px bg-orange-400" />Частые вопросы<div className="w-8 h-px bg-orange-400" />
          </div>
          <h2 className="font-montserrat font-black text-3xl md:text-5xl">
            Отвечаем на<br /><span className="text-white/30">ваши вопросы</span>
          </h2>
        </div>
        <div className="space-y-3">
          {FAQ.map((f, i) => (
            <div key={i}
              className={`rounded-2xl border transition-all duration-300 overflow-hidden ${activeFaq === i ? "border-orange-500/30 bg-orange-500/5" : "border-white/7 bg-white/2 hover:border-white/15"} ${faqRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
              style={{ transitionDelay: `${i * 60}ms` }}>
              <button className="w-full flex items-center justify-between p-5 text-left gap-4" onClick={() => setActiveFaq(activeFaq === i ? null : i)}>
                <span className="font-montserrat font-semibold text-sm text-white/85">{f.q}</span>
                <div className={`shrink-0 w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${activeFaq === i ? "bg-orange-500 border-orange-500 rotate-45" : "border-white/15 bg-white/5"}`}>
                  <Icon name="Plus" size={14} className="text-white" />
                </div>
              </button>
              {activeFaq === i && (
                <div className="px-5 pb-5 text-white/50 text-sm leading-relaxed border-t border-white/6 pt-4 animate-fade-in">{f.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}