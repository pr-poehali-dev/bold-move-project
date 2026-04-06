import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

// ─── UTILS ────────────────────────────────────────────────────────────────────
function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// ─── DATA ─────────────────────────────────────────────────────────────────────
const CATALOG = [
  { id: "gloss", name: "Глянцевый", tag: "Хит продаж", price: 299, priceHeat: 349, desc: "Зеркальный эффект, визуально увеличивает комнату на 20–30%. Идеален для гостиных и коридоров.", features: ["Зеркальный эффект", "60+ цветов", "Влагостойкий", "Мойка любым раствором"], popular: true, color: "from-blue-600 to-cyan-500" },
  { id: "matte", name: "Матовый", tag: "Классика", price: 249, priceHeat: 299, desc: "Мягкий рассеянный свет, скрывает неровности бетонных перекрытий. Подходит для любой комнаты.", features: ["150+ оттенков", "Скрывает швы", "Без бликов", "Лёгкая уборка"], popular: false, color: "from-slate-600 to-zinc-500" },
  { id: "satin", name: "Сатиновый", tag: "Премиум", price: 349, priceHeat: 399, desc: "Шёлковый блеск без зеркального отражения. Золотая середина между матовым и глянцем.", features: ["Шёлковый блеск", "Термостойкий", "80+ цветов", "До 10 м ширина"], popular: false, color: "from-amber-600 to-yellow-500" },
  { id: "fabric", name: "Тканевый", tag: "Экология", price: 399, priceHeat: 449, desc: "Дышащий материал, не накапливает конденсат. Идеален для деревянных домов и дач.", features: ["Паропроницаемый", "Экологичный", "Не провисает", "Морозостойкий"], popular: false, color: "from-emerald-600 to-teal-500" },
  { id: "stars", name: "Звёздное небо", tag: "Wow-эффект", price: 1200, priceHeat: 1400, desc: "Оптоволоконные нити создают эффект настоящего ночного неба. Уникальность гарантирована.", features: ["500–5000 звёзд", "RGB-подсветка", "Диммер в комплекте", "Пожизненная яркость"], popular: false, color: "from-violet-700 to-indigo-600" },
  { id: "photo", name: "Фотопечать", tag: "Уникальный", price: 699, priceHeat: 799, desc: "Печатаем любой рисунок, фото, логотип в высоком разрешении. Дизайн-проект бесплатно.", features: ["Любой рисунок", "Дизайн бесплатно", "4К разрешение", "Водостойкая краска"], popular: false, color: "from-rose-600 to-pink-500" },
  { id: "multilevel", name: "Двухуровневый", tag: "Дизайнерский", price: 499, priceHeat: 599, desc: "Сложные конструкции с подсветкой. Зонируют пространство без стен. Любые формы.", features: ["Любые формы", "LED в конструкции", "Зонирование", "Подсветка в подарок"], popular: false, color: "from-orange-600 to-red-500" },
  { id: "stretch3d", name: "3D-потолок", tag: "Инновация", price: 899, priceHeat: 999, desc: "Фотопечать + объёмный эффект. Создаёт иллюзию бесконечного пространства.", features: ["Объёмный эффект", "Любой сюжет", "Подсветка", "Глянц/матт основа"], popular: false, color: "from-fuchsia-600 to-purple-600" },
] as const;

const ROOMS = [
  { name: "Гостиная", koef: 1.0, avg: 24 },
  { name: "Спальня", koef: 0.9, avg: 16 },
  { name: "Кухня", koef: 0.85, avg: 10 },
  { name: "Детская", koef: 0.9, avg: 12 },
  { name: "Ванная", koef: 1.1, avg: 5 },
  { name: "Коридор", koef: 0.8, avg: 8 },
  { name: "Офис", koef: 1.0, avg: 35 },
];

const PORTFOLIO_ITEMS = [
  { room: "Гостиная", district: "Выхино", type: "Двухуровневый глянец", area: 32, color: "#1e3a5f", accent: "#3b82f6", year: 2025 },
  { room: "Спальня", district: "Красногорск", type: "Звёздное небо", area: 18, color: "#1a1535", accent: "#7c3aed", year: 2025 },
  { room: "Кухня", district: "Домодедово", type: "Матовый белый", area: 11, color: "#2d2018", accent: "#f59e0b", year: 2026 },
  { room: "Детская", district: "Одинцово", type: "Фотопечать «Космос»", area: 15, color: "#0f2027", accent: "#06b6d4", year: 2026 },
  { room: "Гостиная+кухня", district: "Строгино", type: "Тканевый кремовый", area: 42, color: "#1c1a14", accent: "#84cc16", year: 2025 },
  { room: "Офис", district: "Видное", type: "Глянец белый", area: 65, color: "#0f1923", accent: "#f97316", year: 2026 },
  { room: "Ванная", district: "Щёлково", type: "Влагостойкий глянец", area: 6, color: "#0c2032", accent: "#22d3ee", year: 2026 },
  { room: "Спальня", district: "Балашиха", type: "Сатин сиреневый", area: 20, color: "#1f1030", accent: "#e879f9", year: 2025 },
];

const REVIEWS = [
  { name: "Ирина Соловьёва", city: "Выхино", rating: 5, date: "Март 2026", text: "Оформила двухуровневый потолок с подсветкой в гостиной. Мастера работали аккуратно, всё убрали. Результат превзошёл все ожидания — потолок просто шикарный! Рекомендую всем без исключения.", type: "Двухуровневый", area: 28 },
  { name: "Алексей Морозов", city: "Красногорск", rating: 5, date: "Февраль 2026", text: "Делали звёздное небо в спальне. Цена оказалась ниже, чем у конкурентов, а качество намного лучше. Установили за один день, как и обещали. Теперь каждый вечер как в планетарии.", type: "Звёздное небо", area: 16 },
  { name: "Наталья Кузнецова", city: "Домодедово", rating: 5, date: "Январь 2026", text: "Заказала глянцевый потолок в кухню. Всё прошло быстро и без пыли. Особенно понравилось, что дали скидку и сделали бесплатную 3D-визуализацию до замера. Очень довольна!", type: "Глянцевый", area: 12 },
  { name: "Дмитрий Павлов", city: "Одинцово", rating: 5, date: "Март 2026", text: "Заказывал матовые потолки сразу в 3 комнаты. Дали хорошую скидку за объём. Работали два мастера, управились за день. Качество отличное, никаких швов и провисаний.", type: "Матовый 3 комнаты", area: 54 },
  { name: "Светлана Громова", city: "Строгино", rating: 5, date: "Декабрь 2025", text: "Тканевый потолок на кухне-гостиной 42 м². Сначала сомневалась, но мастер подробно всё объяснил. Потолок дышит, конденсата нет. Уже год прошёл — никаких нареканий.", type: "Тканевый", area: 42 },
  { name: "Михаил Зайцев", city: "Щёлково", rating: 5, date: "Февраль 2026", text: "Ставили в ванную влагостойкий глянец. Боялся, что будет некрасиво, но получилось очень стильно. Потолок отражает плитку — ванная выглядит в два раза больше. Цена приятная.", type: "Влагостойкий глянец", area: 6 },
];

const FAQ = [
  { q: "Сколько времени занимает установка?", a: "Монтаж одной комнаты до 30 м² занимает 3–5 часов. Квартиру в среднем делаем за 1 рабочий день. При площади свыше 100 м² — 2 дня. После монтажа никакого мусора и запаха." },
  { q: "Какая гарантия на потолки?", a: "Мы даём письменную гарантию 12 лет на все виды натяжных потолков. За 15 лет работы не было ни одного гарантийного случая по вине производства. При любых проблемах — выезжаем бесплатно." },
  { q: "Нужно ли готовить комнату к монтажу?", a: "Уберите вещи от стен на 50–70 см и закройте мебель плёнкой. Мы привозим всё необходимое. Клеить обои и красить стены нужно ДО монтажа потолка — это важно." },
  { q: "Можно ли монтировать зимой?", a: "Да, тканевые потолки монтируются при любой температуре. Плёночные — при температуре от +15°C. В неотапливаемых помещениях зимой монтируем только тканевые конструкции." },
  { q: "Как быстро приедет замерщик?", a: "Замерщик приезжает на следующий день или в тот же день (при заявке до 12:00). Замер бесплатный, занимает 20–30 минут. Сразу получите точный расчёт и 3D-визуализацию." },
  { q: "Вы работаете в области?", a: "Работаем по всей Москве и области: Видное, Домодедово, Красногорск, Одинцово, Строгино, Щёлково, Балашиха, Реутов, Люберцы и другие города. Выезд бесплатный в радиусе 30 км от МКАД." },
];

const PROCESS = [
  { step: "01", title: "Заявка онлайн или по телефону", desc: "Звоните или оставляйте заявку — перезвоним в течение 15 минут", icon: "Phone" },
  { step: "02", title: "Бесплатный замер на следующий день", desc: "Замерщик приезжает, делает точные замеры и 3D-визуализацию", icon: "Ruler" },
  { step: "03", title: "Договор и фиксированная цена", desc: "Подписываем договор. Цена не изменится — никаких доплат", icon: "FileText" },
  { step: "04", title: "Монтаж за 1 день", desc: "Два мастера устанавливают потолок. Убираем за собой полностью", icon: "Hammer" },
  { step: "05", title: "Гарантия 12 лет письменно", desc: "Выдаём гарантийный талон. При любых проблемах — выезд бесплатно", icon: "Shield" },
];

const CITIES = ["Москва", "Видное", "Выхино", "Домодедово", "Красногорск", "Одинцово", "Строгино", "Щёлково", "Балашиха", "Реутов", "Люберцы", "Подольск", "Химки", "Мытищи", "Зеленоград"];

const STATS = [
  { num: "15 000+", label: "реализованных проектов", icon: "Building2" },
  { num: "15", label: "лет на рынке Москвы", icon: "Calendar" },
  { num: "12", label: "лет гарантии письменно", icon: "Shield" },
  { num: "1", label: "день — монтаж любой комнаты", icon: "Clock" },
  { num: "0 ₽", label: "замер и 3D-визуализация", icon: "Ruler" },
  { num: "4.9★", label: "средняя оценка клиентов", icon: "Star" },
];

// ─── CALCULATOR ───────────────────────────────────────────────────────────────
function Calculator() {
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

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function Index() {
  const [scrollY, setScrollY] = useState(0);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "living" | "bedroom" | "kitchen">("all");

  useEffect(() => {
    const fn = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const heroRef = useInView(0.05);
  const statsRef = useInView(0.1);
  const catalogRef = useInView(0.05);
  const calcRef = useInView(0.05);
  const processRef = useInView(0.1);
  const portfolioRef = useInView(0.05);
  const reviewsRef = useInView(0.05);
  const faqRef = useInView(0.05);
  const citiesRef = useInView(0.1);
  const contactRef = useInView(0.05);

  const filteredPortfolio = PORTFOLIO_ITEMS.filter(p => {
    if (activeTab === "all") return true;
    if (activeTab === "living") return p.room.includes("Гостин");
    if (activeTab === "bedroom") return p.room.includes("Спальн");
    if (activeTab === "kitchen") return p.room.includes("Кухн");
    return true;
  });

  return (
    <div className="bg-[#08080d] text-white font-rubik overflow-x-hidden">

      {/* ─── HEADER ─── */}
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
            {[["#catalog", "Каталог"], ["#calc", "Калькулятор"], ["#portfolio", "Портфолио"], ["#reviews", "Отзывы"], ["#faq", "FAQ"], ["#contact", "Контакты"]].map(([href, label]) => (
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

      {/* ─── HERO ─── */}
      <section className="relative min-h-[100svh] flex items-center pt-20 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(234,88,12,0.18),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_80%,rgba(139,92,246,0.1),transparent)]" />
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        </div>
        <div className="absolute top-1/3 right-10 w-[480px] h-[480px] bg-orange-500/8 rounded-full blur-3xl animate-float pointer-events-none" />
        <div className="absolute bottom-1/4 left-0 w-[320px] h-[320px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

        <div ref={heroRef.ref} className="relative max-w-7xl mx-auto px-5 py-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center w-full">
          <div className={`transition-all duration-1000 ${heroRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
            <div className="inline-flex items-center gap-2 bg-orange-500/15 border border-orange-500/30 text-orange-300 rounded-full px-4 py-1.5 text-xs font-montserrat font-semibold mb-6 uppercase tracking-widest">
              <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
              Производитель №1 в Москве и МО
            </div>
            <h1 className="font-montserrat font-black text-5xl md:text-6xl xl:text-7xl leading-[0.95] mb-6">
              Натяжные<br />
              <span className="bg-gradient-to-r from-orange-400 via-rose-400 to-violet-400 bg-clip-text text-transparent">потолки</span>
              <br />
              <span className="text-white/25 text-4xl md:text-5xl">от производителя</span>
            </h1>
            <p className="text-white/55 text-lg leading-relaxed mb-8 max-w-lg">
              15 лет устанавливаем натяжные потолки в Москве и области. Монтаж за 1 день, гарантия 12 лет. Бесплатный замер с 3D-визуализацией.
            </p>
            <div className="flex flex-wrap gap-3 mb-10">
              <a href="#contact" className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-montserrat font-bold px-7 py-4 rounded-2xl text-base hover:scale-105 transition-transform shadow-xl shadow-orange-500/25">
                Вызвать замерщика бесплатно <Icon name="ArrowRight" size={18} />
              </a>
              <a href="#calc" className="inline-flex items-center gap-2 border border-white/15 text-white/70 font-montserrat font-semibold px-6 py-4 rounded-2xl text-base hover:bg-white/8 hover:text-white transition-all">
                <Icon name="Calculator" size={18} /> Рассчитать цену
              </a>
            </div>
            <div className="flex flex-wrap gap-6">
              {[["15 000+", "проектов"], ["12 лет", "гарантия"], ["1 день", "монтаж"], ["0 ₽", "замер"]].map(([n, l]) => (
                <div key={n} className="flex flex-col">
                  <span className="font-montserrat font-black text-2xl text-orange-400">{n}</span>
                  <span className="text-white/40 text-xs">{l}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={`transition-all duration-1000 delay-300 ${heroRef.inView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"}`}>
            <div className="relative">
              <div className="absolute -inset-2 bg-gradient-to-r from-orange-500/20 to-violet-500/20 rounded-3xl blur-2xl" />
              <div className="relative bg-white/4 border border-white/10 rounded-3xl p-7 backdrop-blur">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-green-300 text-sm font-montserrat font-semibold">Акция: скидка 10% при заявке онлайн</span>
                </div>
                <div className="space-y-3 mb-6">
                  {[
                    ["Тканевые потолки", "от 399 ₽/м²", "Экология"],
                    ["Глянцевые потолки", "от 299 ₽/м²", "Хит"],
                    ["Матовые потолки", "от 249 ₽/м²", "Классика"],
                    ["Звёздное небо", "от 1200 ₽/м²", "Wow"],
                    ["Двухуровневые", "от 499 ₽/м²", "Дизайн"],
                    ["Фотопечать", "от 699 ₽/м²", "Уник."],
                  ].map(([n, price, tag]) => (
                    <div key={n} className="flex items-center justify-between py-2.5 border-b border-white/6 last:border-0 hover:bg-white/3 rounded-xl px-2 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 bg-orange-400 rounded-full" />
                        <span className="text-white/80 text-sm font-medium">{n}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full font-montserrat font-semibold">{tag}</span>
                        <span className="font-montserrat font-black text-orange-400 text-sm">{price}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <a href="tel:+79776068901" className="flex items-center justify-center gap-2 w-full bg-white/8 border border-white/15 text-white font-montserrat font-bold py-3 rounded-xl hover:bg-white/15 transition-colors text-sm">
                  <Icon name="Phone" size={16} className="text-orange-400" /> Позвонить: +7 (977) 606-89-01
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/25 text-xs">
          <span className="text-[10px] uppercase tracking-widest">листайте</span>
          <div className="w-px h-8 bg-gradient-to-b from-white/20 to-transparent" />
        </div>
      </section>

      {/* ─── STATS ─── */}
      <section className="py-14 border-y border-white/5 bg-gradient-to-r from-orange-950/20 via-transparent to-violet-950/15">
        <div ref={statsRef.ref} className="max-w-7xl mx-auto px-5">
          <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 transition-all duration-700 ${statsRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            {STATS.map((s, i) => (
              <div key={i} className="text-center group" style={{ transitionDelay: `${i * 60}ms` }}>
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-white/5 border border-white/8 mb-2 group-hover:border-orange-500/30 group-hover:bg-orange-500/10 transition-all">
                  <Icon name={s.icon} size={20} className="text-orange-400" />
                </div>
                <div className="font-montserrat font-black text-2xl text-white leading-none">{s.num}</div>
                <div className="text-white/40 text-[11px] mt-1 leading-snug">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CATALOG ─── */}
      <section id="catalog" className="py-24">
        <div ref={catalogRef.ref} className="max-w-7xl mx-auto px-5">
          <div className={`mb-14 transition-all duration-700 ${catalogRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <div className="inline-flex items-center gap-2 text-orange-400 text-xs font-montserrat font-bold uppercase tracking-[0.2em] mb-4">
              <div className="w-8 h-px bg-orange-400" />Каталог потолков
            </div>
            <h2 className="font-montserrat font-black text-4xl md:text-5xl mb-3">
              8 видов натяжных потолков<br /><span className="text-white/30">с ценами от производителя</span>
            </h2>
            <p className="text-white/50 text-base max-w-xl">Все виды полотна у нас в наличии. Работаем с проверенными производителями Франции, Германии и России.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CATALOG.map((c, i) => (
              <div key={c.id}
                className={`relative p-6 rounded-3xl border bg-white/2 hover:bg-white/5 transition-all duration-300 group cursor-pointer overflow-hidden ${c.popular ? "border-orange-500/40 shadow-lg shadow-orange-500/10" : "border-white/7 hover:border-orange-500/25"} ${catalogRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
                style={{ transitionDelay: `${i * 50}ms`, transitionProperty: "opacity, transform, background, border" }}>
                {c.popular && <div className="absolute top-4 right-4 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[10px] font-montserrat font-black px-2.5 py-1 rounded-full">Хит</div>}
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-full bg-gradient-to-br ${c.color} opacity-10 group-hover:opacity-20 transition-opacity blur-2xl pointer-events-none`} />
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${c.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
                  <Icon name="Layers" size={20} className="text-white" />
                </div>
                <div className="text-white/40 text-[10px] font-montserrat font-semibold uppercase tracking-wider mb-1">{c.tag}</div>
                <h3 className="font-montserrat font-black text-lg mb-2">{c.name}</h3>
                <p className="text-white/45 text-xs leading-relaxed mb-4">{c.desc}</p>
                <div className="space-y-1 mb-4">
                  {c.features.map((f, j) => (
                    <div key={j} className="flex items-center gap-2 text-white/55 text-xs">
                      <Icon name="Check" size={12} className="text-orange-400 shrink-0" />{f}
                    </div>
                  ))}
                </div>
                <div className="pt-3 border-t border-white/6">
                  <div className="font-montserrat font-black text-2xl text-orange-400">{c.price} <span className="text-sm text-white/30">₽/м²</span></div>
                  <div className="text-white/30 text-[10px]">с теплом: {c.priceHeat} ₽/м²</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CALCULATOR ─── */}
      <section id="calc" className="py-16 bg-gradient-to-b from-transparent via-white/2 to-transparent">
        <div ref={calcRef.ref} className="max-w-7xl mx-auto px-5">
          <div className={`mb-10 transition-all duration-700 ${calcRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <div className="inline-flex items-center gap-2 text-orange-400 text-xs font-montserrat font-bold uppercase tracking-[0.2em] mb-4">
              <div className="w-8 h-px bg-orange-400" />Калькулятор
            </div>
            <h2 className="font-montserrat font-black text-4xl md:text-5xl">
              Узнайте стоимость<br /><span className="text-white/30">прямо сейчас</span>
            </h2>
          </div>
          <div className={`transition-all duration-700 delay-200 ${calcRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <Calculator />
          </div>
        </div>
      </section>

      {/* ─── PROCESS ─── */}
      <section className="py-24">
        <div ref={processRef.ref} className="max-w-7xl mx-auto px-5">
          <div className={`mb-14 transition-all duration-700 ${processRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <div className="inline-flex items-center gap-2 text-violet-400 text-xs font-montserrat font-bold uppercase tracking-[0.2em] mb-4">
              <div className="w-8 h-px bg-violet-400" />Как мы работаем
            </div>
            <h2 className="font-montserrat font-black text-4xl md:text-5xl">
              5 шагов от заявки<br /><span className="text-white/30">до готового потолка</span>
            </h2>
          </div>
          <div className="relative">
            <div className="absolute top-10 left-10 right-10 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent hidden lg:block" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
              {PROCESS.map((p, i) => (
                <div key={i}
                  className={`relative p-6 rounded-3xl border border-white/7 bg-white/2 hover:border-orange-500/25 hover:bg-white/4 transition-all duration-300 ${processRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
                  style={{ transitionDelay: `${i * 100}ms` }}>
                  <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500/20 to-rose-500/10 border border-orange-500/25 flex items-center justify-center mb-4 z-10">
                    <Icon name={p.icon} size={20} className="text-orange-400" />
                  </div>
                  <div className="font-montserrat font-black text-5xl text-white/5 absolute top-4 right-4 leading-none select-none">{p.step}</div>
                  <h3 className="font-montserrat font-bold text-sm mb-2 leading-snug">{p.title}</h3>
                  <p className="text-white/40 text-xs leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── PORTFOLIO ─── */}
      <section id="portfolio" className="py-24 bg-gradient-to-b from-transparent via-violet-950/10 to-transparent">
        <div ref={portfolioRef.ref} className="max-w-7xl mx-auto px-5">
          <div className={`flex flex-wrap items-end justify-between gap-6 mb-10 transition-all duration-700 ${portfolioRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <div>
              <div className="inline-flex items-center gap-2 text-violet-400 text-xs font-montserrat font-bold uppercase tracking-[0.2em] mb-4">
                <div className="w-8 h-px bg-violet-400" />Портфолио
              </div>
              <h2 className="font-montserrat font-black text-4xl md:text-5xl">
                Наши реальные работы<br /><span className="text-white/30">по Москве и области</span>
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {[["all", "Все"], ["living", "Гостиные"], ["bedroom", "Спальни"], ["kitchen", "Кухни"]].map(([tab, label]) => (
                <button key={tab} onClick={() => setActiveTab(tab as typeof activeTab)}
                  className={`px-4 py-2 rounded-xl text-xs font-montserrat font-semibold transition-all ${activeTab === tab ? "bg-orange-500 text-white" : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredPortfolio.map((p, i) => (
              <div key={i}
                className={`relative rounded-2xl overflow-hidden group cursor-pointer transition-all duration-500 ${portfolioRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                style={{ transitionDelay: `${i * 60}ms`, aspectRatio: i % 5 === 0 ? "1.6/1" : "1/1" }}>
                <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-110" style={{ background: `radial-gradient(circle at 30% 30%, ${p.accent}40, ${p.color})` }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute top-1/3 left-1/3 w-1/2 h-1/2 rounded-full blur-2xl pointer-events-none" style={{ background: `${p.accent}30` }} />
                <div className="absolute inset-0 flex flex-col justify-end p-4">
                  <div className="font-montserrat font-black text-sm leading-snug">{p.room}</div>
                  <div className="text-white/60 text-xs">{p.type}</div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="text-white/40 text-[10px]">{p.district}</div>
                    <div className="text-[10px] font-montserrat font-bold" style={{ color: p.accent }}>{p.area} м²</div>
                  </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                    <Icon name="Expand" size={18} className="text-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <a href="#contact" className="inline-flex items-center gap-2 border border-white/12 text-white/50 font-montserrat font-semibold px-6 py-3 rounded-2xl hover:bg-white/5 hover:text-white transition-all text-sm">
              Посмотреть все 15 000+ работ <Icon name="ArrowRight" size={14} />
            </a>
          </div>
        </div>
      </section>

      {/* ─── REVIEWS ─── */}
      <section id="reviews" className="py-24">
        <div ref={reviewsRef.ref} className="max-w-7xl mx-auto px-5">
          <div className={`flex flex-wrap items-end justify-between gap-6 mb-12 transition-all duration-700 ${reviewsRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <div>
              <div className="inline-flex items-center gap-2 text-rose-400 text-xs font-montserrat font-bold uppercase tracking-[0.2em] mb-4">
                <div className="w-8 h-px bg-rose-400" />Отзывы клиентов
              </div>
              <h2 className="font-montserrat font-black text-4xl md:text-5xl">
                Реальные отзывы<br /><span className="text-white/30">с Яндекс.Карт и 2ГИС</span>
              </h2>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-2xl border border-white/8 bg-white/3">
              <div>
                <div className="font-montserrat font-black text-4xl text-orange-400">4.9</div>
                <div className="flex gap-0.5 mt-1">{"★★★★★".split("").map((s, i) => <span key={i} className="text-orange-400 text-sm">{s}</span>)}</div>
              </div>
              <div>
                <div className="text-white/60 text-xs">Средняя оценка</div>
                <div className="text-white/40 text-xs">на основе 2 800+ отзывов</div>
                <div className="flex gap-2 mt-1">
                  <span className="text-[10px] bg-white/8 px-2 py-0.5 rounded-full text-white/40">Яндекс 4.9★</span>
                  <span className="text-[10px] bg-white/8 px-2 py-0.5 rounded-full text-white/40">2ГИС 4.8★</span>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {REVIEWS.map((r, i) => (
              <div key={i}
                className={`p-6 rounded-3xl border border-white/7 bg-white/2 hover:border-rose-500/20 hover:bg-white/4 transition-all duration-300 ${reviewsRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
                style={{ transitionDelay: `${i * 80}ms`, transitionProperty: "opacity, transform, border, background" }}>
                <div className="flex gap-0.5 mb-3">{"★★★★★".split("").map((s, j) => <span key={j} className="text-orange-400">{s}</span>)}</div>
                <p className="text-white/65 text-sm leading-relaxed mb-5 italic">"{r.text}"</p>
                <div className="pt-4 border-t border-white/6 flex items-center justify-between">
                  <div>
                    <div className="font-montserrat font-bold text-sm">{r.name}</div>
                    <div className="text-white/35 text-xs">{r.city} · {r.type} · {r.area} м²</div>
                  </div>
                  <div className="text-white/25 text-[11px] shrink-0">{r.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="py-24 bg-gradient-to-b from-transparent via-white/2 to-transparent">
        <div ref={faqRef.ref} className="max-w-4xl mx-auto px-5">
          <div className={`mb-12 text-center transition-all duration-700 ${faqRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <div className="inline-flex items-center gap-2 text-orange-400 text-xs font-montserrat font-bold uppercase tracking-[0.2em] mb-4">
              <div className="w-8 h-px bg-orange-400" />Частые вопросы<div className="w-8 h-px bg-orange-400" />
            </div>
            <h2 className="font-montserrat font-black text-4xl md:text-5xl">
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

      {/* ─── CITIES ─── */}
      <section className="py-16 border-y border-white/5">
        <div ref={citiesRef.ref} className="max-w-7xl mx-auto px-5">
          <div className={`transition-all duration-700 ${citiesRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 text-white/40 text-xs font-montserrat font-bold uppercase tracking-[0.2em] mb-3">
                <div className="w-6 h-px bg-white/20" />Работаем по всей Москве и области<div className="w-6 h-px bg-white/20" />
              </div>
              <p className="text-white/35 text-sm">Бесплатный выезд замерщика в радиусе 30 км от МКАД</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {CITIES.map((city, i) => (
                <div key={i} className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/8 bg-white/3 text-white/50 text-sm hover:border-orange-500/30 hover:text-white/70 hover:bg-white/5 transition-all cursor-pointer">
                  <Icon name="MapPin" size={12} className="text-orange-400" />{city}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── CONTACT ─── */}
      <section id="contact" className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_50%,rgba(234,88,12,0.12),transparent)]" />
        <div ref={contactRef.ref} className="relative max-w-7xl mx-auto px-5">
          <div className={`mb-12 text-center transition-all duration-700 ${contactRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <div className="inline-flex items-center gap-2 text-orange-400 text-xs font-montserrat font-bold uppercase tracking-[0.2em] mb-4">
              <div className="w-8 h-px bg-orange-400" />Бесплатный замер<div className="w-8 h-px bg-orange-400" />
            </div>
            <h2 className="font-montserrat font-black text-4xl md:text-5xl mb-3">Получите расчёт за 15 минут</h2>
            <p className="text-white/40 text-base">Замерщик приедет на следующий день. Расчёт и 3D-визуализация — бесплатно.</p>
          </div>
          <div className={`grid grid-cols-1 lg:grid-cols-5 gap-8 transition-all duration-700 delay-200 ${contactRef.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <div className="lg:col-span-2 space-y-5">
              {[
                { icon: "Phone", title: "Телефон", val: "+7 (977) 606-89-01", sub: "Ежедневно 8:00–22:00", href: "tel:+79776068901" },
                { icon: "MessageCircle", title: "WhatsApp", val: "Написать в WhatsApp", sub: "Отвечаем за 5 минут", href: "https://wa.me/79776068901" },
                { icon: "MapPin", title: "Адрес", val: "Мытищи, Пограничная 24", sub: "Выезд бесплатный до 30 км от МКАД", href: "#" },
              ].map((item, i) => (
                <a key={i} href={item.href} target={item.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer"
                  className="flex items-center gap-4 p-4 rounded-2xl border border-white/8 bg-white/3 hover:border-orange-500/25 hover:bg-white/5 transition-all group">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500/25 to-rose-500/15 border border-orange-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Icon name={item.icon} size={20} className="text-orange-400" />
                  </div>
                  <div>
                    <div className="text-white/40 text-xs">{item.title}</div>
                    <div className="font-montserrat font-bold text-sm text-white">{item.val}</div>
                    <div className="text-white/35 text-xs">{item.sub}</div>
                  </div>
                </a>
              ))}
              <div className="p-4 rounded-2xl border border-white/6 bg-white/2">
                <div className="text-white/40 text-xs font-montserrat uppercase tracking-widest mb-3">Наши гарантии</div>
                <div className="space-y-2">
                  {["Договор с фиксированной ценой", "Гарантийный талон на 12 лет", "Бесплатный выезд при гарантийном случае", "Возврат предоплаты если не понравится"].map((g, i) => (
                    <div key={i} className="flex items-center gap-2 text-white/55 text-xs">
                      <Icon name="CheckCircle" size={13} className="text-orange-400 shrink-0" />{g}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="lg:col-span-3 relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-orange-500/15 to-violet-500/15 rounded-3xl blur-xl" />
              <div className="relative p-8 rounded-3xl border border-white/10 bg-[#08080d]/90 backdrop-blur">
                {sent ? (
                  <div className="text-center py-10">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center mx-auto mb-5 shadow-xl shadow-orange-500/30 animate-scale-in">
                      <Icon name="Check" size={36} className="text-white" />
                    </div>
                    <h3 className="font-montserrat font-black text-2xl mb-2">Заявка принята!</h3>
                    <p className="text-white/50">Перезвоним вам в течение 15 минут.<br />Или звоните сами: <a href="tel:+79776068901" className="text-orange-400 font-semibold">+7 (977) 606-89-01</a></p>
                  </div>
                ) : (
                  <form onSubmit={e => { e.preventDefault(); setSent(true); }} className="space-y-4">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-montserrat font-black text-xl">Оставить заявку</h3>
                      <div className="flex items-center gap-1.5 text-green-400 text-xs font-montserrat font-semibold">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />Скидка 10% онлайн
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-white/40 text-[11px] font-montserrat uppercase tracking-widest mb-2">Ваше имя</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Иван" required
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 focus:bg-white/7 transition-all text-sm" />
                      </div>
                      <div>
                        <label className="block text-white/40 text-[11px] font-montserrat uppercase tracking-widest mb-2">Телефон</label>
                        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (___) ___-__-__" required
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 focus:bg-white/7 transition-all text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-white/40 text-[11px] font-montserrat uppercase tracking-widest mb-2">Комментарий (необязательно)</label>
                      <textarea value={comment} onChange={e => setComment(e.target.value)}
                        placeholder="Опишите задачу: кол-во комнат, площадь, предпочтения..." rows={3}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 focus:bg-white/7 transition-all text-sm resize-none" />
                    </div>
                    <button type="submit"
                      className="w-full bg-gradient-to-r from-orange-500 to-rose-500 text-white font-montserrat font-black py-4 rounded-xl text-base hover:scale-[1.02] transition-transform shadow-xl shadow-orange-500/25">
                      Вызвать замерщика бесплатно →
                    </button>
                    <p className="text-white/20 text-[11px] text-center leading-relaxed">Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности. Перезвоним в течение 15 минут.</p>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/5 py-10">
        <div className="max-w-7xl mx-auto px-5 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-rose-600 flex items-center justify-center">
              <span className="text-white font-montserrat font-black text-xs">R</span>
            </div>
            <div>
              <span className="font-montserrat font-bold text-sm">MOS<span className="text-orange-400">POTOLKI</span></span>
              <div className="text-white/25 text-[11px]">Натяжные потолки с 2009 года</div>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-5 text-white/30 text-xs">
            {[["#catalog", "Каталог"], ["#calc", "Калькулятор"], ["#portfolio", "Портфолио"], ["#reviews", "Отзывы"], ["#contact", "Контакты"]].map(([h, l]) => (
              <a key={h} href={h} className="hover:text-white/60 transition-colors">{l}</a>
            ))}
          </div>
          <a href="tel:+79776068901" className="font-montserrat font-bold text-white/60 hover:text-orange-400 transition-colors text-sm">+7 (977) 606-89-01</a>
        </div>
        <div className="text-center text-white/15 text-[11px] mt-6">© 2009–2026 MOSPOTOLKI · Натяжные потолки в Москве и МО · Мытищи, Пограничная 24</div>
      </footer>
    </div>
  );
}