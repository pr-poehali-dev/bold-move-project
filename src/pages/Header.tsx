import Icon from "@/components/ui/icon";

interface Props {
  scrollY: number;
}

export default function Header({ scrollY }: Props) {
  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrollY > 60 ? "bg-[#08080d]/96 backdrop-blur-xl shadow-2xl shadow-black/50 py-3" : "py-4"}`}>
      <div className="max-w-7xl mx-auto px-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-rose-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <span className="font-montserrat font-black text-white text-sm">R</span>
          </div>
          <div>
            <span className="font-montserrat font-black text-base tracking-wide">MOS<span className="text-orange-400">POTOLKI</span></span>
            <div className="text-[10px] text-white/30 leading-none hidden sm:block">Натяжные потолки с 2009 года</div>
          </div>
        </div>
        <nav className="hidden lg:flex items-center gap-7 text-sm text-white/60">
          {[["#catalog", "Каталог"], ["#calc", "Калькулятор"], ["#portfolio", "Портфолио"], ["#ai-assistant", "AI"], ["#reviews", "Отзывы"], ["#faq", "FAQ"], ["#contact", "Контакты"]].map(([href, label]) => (
            <a key={href} href={href} className="hover:text-orange-400 transition-colors font-medium">{label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <a href="https://wa.me/79776068901" target="_blank" rel="noreferrer" className="hidden sm:flex items-center justify-center w-9 h-9 rounded-xl bg-green-500/20 border border-green-500/30 hover:bg-green-500/30 transition-colors">
            <Icon name="MessageCircle" size={16} className="text-green-400" />
          </a>
          <a href="tel:+79776068901" className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-sm font-montserrat font-bold px-4 py-2 rounded-xl hover:scale-105 transition-transform shadow-lg shadow-orange-500/20 animate-pulse-glow">
            <Icon name="Phone" size={14} />
            <span className="hidden sm:inline">+7 (977) 606-89-01</span>
            <span className="sm:hidden">Звонок</span>
          </a>
        </div>
      </div>
    </header>
  );
}
