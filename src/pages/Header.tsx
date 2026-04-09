import { useState } from "react";
import Icon from "@/components/ui/icon";

interface Props {
  scrollY: number;
}

const NAV_LINKS = [
  ["#catalog", "Каталог"],
  ["#calc", "Калькулятор"],
  ["#portfolio", "Портфолио"],
  ["#ai-assistant", "AI-помощник"],
  ["#reviews", "Отзывы"],
  ["#faq", "FAQ"],
  ["#contact", "Контакты"],
];

export default function Header({ scrollY }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrollY > 60 ? "bg-[#08080d]/96 backdrop-blur-xl shadow-2xl shadow-black/50 py-3" : "py-4"}`}>
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <img
              src="https://cdn.poehali.dev/files/7105828c-c33e-48f9-ac90-02134e3cd4d7.png"
              alt="MOSPOTOLKI PRO"
              className="h-10 w-auto object-contain"
              style={{ mixBlendMode: "screen" }}
            />
            <div>
              <span className="font-montserrat font-black text-base tracking-wide">MOS<span className="text-orange-400">POTOLKI</span></span>
              <div className="text-[10px] text-white/30 leading-none hidden sm:block">Натяжные потолки с 2009 года</div>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-7 text-sm text-white/60">
            {NAV_LINKS.map(([href, label]) => (
              <a key={href} href={href} className="hover:text-orange-400 transition-colors font-medium">{label}</a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a href="https://wa.me/79776068901" target="_blank" rel="noreferrer" className="hidden sm:flex items-center justify-center w-9 h-9 rounded-xl bg-green-500/20 border border-green-500/30 hover:bg-green-500/30 transition-colors">
              <Icon name="MessageCircle" size={16} className="text-green-400" />
            </a>
            <a href="tel:+79776068901" className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-sm font-montserrat font-bold px-4 py-2 rounded-xl hover:scale-105 transition-transform shadow-lg shadow-orange-500/20">
              <Icon name="Phone" size={14} />
              <span className="hidden sm:inline">+7 (977) 606-89-01</span>
              <span className="sm:hidden">Звонок</span>
            </a>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden w-9 h-9 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center hover:bg-white/15 transition-colors"
              aria-label="Меню"
            >
              <Icon name={menuOpen ? "X" : "Menu"} size={18} className="text-white" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="absolute top-0 right-0 w-72 h-full bg-[#0c0c14] border-l border-white/10 flex flex-col pt-20 pb-6 px-5"
            onClick={e => e.stopPropagation()}
          >
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-white/70 hover:text-white hover:bg-white/6 transition-all font-medium text-base"
                >
                  {label}
                </a>
              ))}
            </nav>
            <div className="mt-auto space-y-3 pt-6 border-t border-white/8">
              <a href="tel:+79776068901" className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-orange-500 to-rose-500 text-white font-montserrat font-bold py-3.5 rounded-xl text-sm">
                <Icon name="Phone" size={16} /> +7 (977) 606-89-01
              </a>
              <a href="https://wa.me/79776068901" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full bg-green-500/20 border border-green-500/30 text-green-300 font-montserrat font-bold py-3.5 rounded-xl text-sm">
                <Icon name="MessageCircle" size={16} /> WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}