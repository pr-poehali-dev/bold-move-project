import { useState, useEffect, useRef } from "react";
import SectionsTop from "./SectionsTop";
import ProductionSection from "./ProductionSection";
import SectionsBottom from "./SectionsBottom";

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

export default function Index() {
  const [scrollY, setScrollY] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);

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
  const productionRef = useInView(0.05);
  const portfolioRef = useInView(0.05);
  const reviewsRef = useInView(0.05);
  const faqRef = useInView(0.05);
  const citiesRef = useInView(0.1);
  const contactRef = useInView(0.05);
  const assistantRef = useInView(0.05);

  return (
    <div className="bg-[#08080d] text-white font-rubik overflow-x-hidden pb-16 md:pb-0">
      <SectionsTop
        scrollY={scrollY}
        heroRef={heroRef}
        statsRef={statsRef}
        catalogRef={catalogRef}
        calcRef={calcRef}
        processRef={processRef}
        assistantRef={assistantRef}
      />
      <ProductionSection productionRef={productionRef} />
      {/* Mobile sticky CTA */}
      <div className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-[#08080d]/95 backdrop-blur border-t border-white/10 px-4 py-3 flex gap-2">
        <a href="tel:+79776068901" className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-montserrat font-bold py-3 rounded-xl text-sm">
          Позвонить
        </a>
        <a href="#contact" className="flex-1 flex items-center justify-center gap-2 border border-white/15 text-white/80 font-montserrat font-semibold py-3 rounded-xl text-sm hover:bg-white/8 transition-colors">
          Заявка
        </a>
        <a href="https://wa.me/79776068901" target="_blank" rel="noreferrer" className="w-12 flex items-center justify-center bg-green-500/20 border border-green-500/30 rounded-xl">
          <span className="text-green-400 text-lg">💬</span>
        </a>
      </div>

      <SectionsBottom
        portfolioRef={portfolioRef}
        reviewsRef={reviewsRef}
        faqRef={faqRef}
        citiesRef={citiesRef}
        contactRef={contactRef}
        name={name}
        setName={setName}
        phone={phone}
        setPhone={setPhone}
        comment={comment}
        setComment={setComment}
        sent={sent}
        setSent={setSent}
      />
    </div>
  );
}