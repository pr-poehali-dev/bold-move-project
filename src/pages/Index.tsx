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

  return (
    <div className="bg-[#08080d] text-white font-rubik overflow-x-hidden">
      <SectionsTop
        scrollY={scrollY}
        heroRef={heroRef}
        statsRef={statsRef}
        catalogRef={catalogRef}
        calcRef={calcRef}
        processRef={processRef}
      />
      <ProductionSection productionRef={productionRef} />
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