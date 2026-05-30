// ── Атомарные переиспользуемые компоненты страницы личного бренда ────────────
import { useState, useEffect, useRef, useCallback } from "react";
import { PROJECTS, NAV_ITEMS, TG_LINK, MAX_LINK } from "./lbData";

// ── Анимированный печатающийся текст ─────────────────────────────────────────
export function TypeWriter({ texts, speed = 60 }: { texts: string[]; speed?: number }) {
  const [display, setDisplay] = useState("");
  const [idx, setIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = texts[idx];
    const timeout = setTimeout(() => {
      if (!deleting) {
        if (charIdx < current.length) {
          setDisplay(current.slice(0, charIdx + 1));
          setCharIdx(c => c + 1);
        } else {
          setTimeout(() => setDeleting(true), 2000);
        }
      } else {
        if (charIdx > 0) {
          setDisplay(current.slice(0, charIdx - 1));
          setCharIdx(c => c - 1);
        } else {
          setDeleting(false);
          setIdx(i => (i + 1) % texts.length);
        }
      }
    }, deleting ? speed / 2 : speed);
    return () => clearTimeout(timeout);
  }, [charIdx, deleting, idx, texts, speed]);

  return (
    <span>
      {display}
      <span className="animate-pulse" style={{ color: "#8b5cf6" }}>|</span>
    </span>
  );
}

// ── Анимированный счётчик ─────────────────────────────────────────────────────
export function AnimCounter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        let start = 0;
        const step = to / 40;
        const t = setInterval(() => {
          start += step;
          if (start >= to) { setVal(to); clearInterval(t); }
          else setVal(Math.floor(start));
        }, 30);
      }
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [to]);

  return <span ref={ref}>{val}{suffix}</span>;
}

// ── Canvas частицы ────────────────────────────────────────────────────────────
export function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const COUNT = 55;
    const particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.45 + 0.1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(139,92,246,${p.alpha})`;
        ctx.fill();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(139,92,246,${0.1 * (1 - dist / 110)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

// ── Лайтбокс ─────────────────────────────────────────────────────────────────
export function Lightbox({ images, startIdx, onClose }: { images: string[]; startIdx: number; onClose: () => void }) {
  const [current, setCurrent] = useState(startIdx);

  const prev = useCallback(() => setCurrent(c => (c - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setCurrent(c => (c + 1) % images.length), [images.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      <div className="relative max-w-5xl w-full mx-4" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-10 right-0 text-white/50 hover:text-white transition-colors text-2xl">✕</button>
        <img src={images[current]} alt="" className="w-full rounded-2xl" style={{ maxHeight: "80vh", objectFit: "contain" }} />
        <div className="text-center mt-3 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>{current + 1} / {images.length}</div>
        {images.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110" style={{ background: "rgba(139,92,246,0.3)", border: "1px solid rgba(139,92,246,0.5)", color: "#fff" }}>←</button>
            <button onClick={next} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110" style={{ background: "rgba(139,92,246,0.3)", border: "1px solid rgba(139,92,246,0.5)", color: "#fff" }}>→</button>
          </>
        )}
        <div className="flex justify-center gap-2 mt-4">
          {images.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)} className="rounded-full transition-all duration-300" style={{ width: i === current ? 20 : 6, height: 6, background: i === current ? "#8b5cf6" : "rgba(255,255,255,0.25)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Карточка проекта с лайтбоксом ────────────────────────────────────────────
export function ProjectCard({ project, index }: { project: typeof PROJECTS[0]; index: number }) {
  const [activeShot, setActiveShot] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.15 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!hovered && lightbox === null) {
      const t = setInterval(() => setActiveShot(s => (s + 1) % project.screenshots.length), 2500);
      return () => clearInterval(t);
    }
  }, [hovered, lightbox, project.screenshots.length]);

  const isEven = index % 2 === 0;

  return (
    <>
      {lightbox !== null && (
        <Lightbox images={project.screenshots} startIdx={lightbox} onClose={() => setLightbox(null)} />
      )}
      <div
        ref={ref}
        className="relative rounded-3xl overflow-hidden transition-all duration-700"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : `translateY(${isEven ? 40 : 60}px)`,
          transitionDelay: `${index * 80}ms`,
          background: hovered ? "linear-gradient(135deg, rgba(10,10,20,0.98), rgba(10,10,20,0.95))" : "rgba(255,255,255,0.025)",
          border: `1.5px solid ${hovered ? project.color : "rgba(255,255,255,0.07)"}`,
          boxShadow: hovered ? `0 0 60px ${project.glow}` : "none",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Скриншот */}
        <div className="relative overflow-hidden cursor-zoom-in group/img" style={{ height: 220 }} onClick={() => setLightbox(activeShot)}>
          {project.screenshots.map((src, i) => (
            <img key={i} src={src} alt="" className="absolute inset-0 w-full h-full object-cover object-top transition-all duration-700" style={{ opacity: i === activeShot ? 1 : 0, transform: i === activeShot ? "scale(1.02)" : "scale(1)" }} />
          ))}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(8,8,16,0.95) 100%)" }} />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity duration-200">
            <div className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: "rgba(0,0,0,0.7)", color: "rgba(255,255,255,0.8)", backdropFilter: "blur(4px)" }}>🔍 Увеличить</div>
          </div>
          {project.screenshots.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5" onClick={e => e.stopPropagation()}>
              {project.screenshots.map((_, i) => (
                <button key={i} onClick={() => setActiveShot(i)} className="rounded-full transition-all duration-300" style={{ width: i === activeShot ? 20 : 6, height: 6, background: i === activeShot ? project.color : "rgba(255,255,255,0.3)" }} />
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {/* Тег — теперь здесь, не перекрывает скриншот */}
          <div className="mb-2">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold" style={{ background: project.color, color: "#0a0a14" }}>{project.tags[0]}</span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-white mb-1" style={{ fontFamily: "Montserrat, sans-serif" }}>{project.title}</h3>
          <p className="text-sm mb-3" style={{ color: project.color }}>{project.subtitle}</p>
          <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.6)" }}>{project.description}</p>
          <ul className="space-y-1.5 mb-5">
            {project.features.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: project.color }} />
                {f}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-1.5 mb-5">
            {project.tags.map((t, i) => (
              <span key={i} className="px-2.5 py-0.5 rounded-full text-xs" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>{t}</span>
            ))}
          </div>
          <a href={project.link} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 hover:gap-3" style={{ background: `${project.color}20`, color: project.color, border: `1px solid ${project.color}40` }}>
            Посмотреть живой проект →
          </a>
        </div>
      </div>
    </>
  );
}

// ── Анимированный фоновый грид ────────────────────────────────────────────────
export function GridBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(139,92,246,0.05)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      <div className="absolute rounded-full" style={{ width: 600, height: 600, top: -200, left: -200, background: "radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)" }} />
      <div className="absolute rounded-full" style={{ width: 500, height: 500, top: 100, right: -100, background: "radial-gradient(circle, rgba(249,115,22,0.07) 0%, transparent 70%)" }} />
    </div>
  );
}

// ── Прогресс-бар навыка ───────────────────────────────────────────────────────
export function SkillBar({ name, level, color, delay }: { name: string; level: number; color: string; delay: number }) {
  const [animated, setAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setTimeout(() => setAnimated(true), delay); }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.85)", fontFamily: "Rubik, sans-serif" }}>{name}</span>
        <span className="text-xs font-bold" style={{ color }}>{level}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: animated ? `${level}%` : "0%", background: `linear-gradient(90deg, ${color}, ${color}aa)`, boxShadow: animated ? `0 0 8px ${color}60` : "none" }} />
      </div>
    </div>
  );
}

// ── Sticky CTA bar ────────────────────────────────────────────────────────────
export function StickyBar() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 flex gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl transition-all duration-500"
      style={{
        background: "rgba(10,10,20,0.96)",
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        opacity: show ? 1 : 0,
        transform: `translateX(-50%) translateY(${show ? 0 : 20}px)`,
        pointerEvents: show ? "auto" : "none",
        maxWidth: "calc(100vw - 24px)",
      }}
    >
      <a href={TG_LINK} target="_blank" rel="noreferrer"
        className="px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95 whitespace-nowrap"
        style={{ background: "#f97316", color: "#0a0a14" }}>
        💬 Telegram
      </a>
      <a href={MAX_LINK} target="_blank" rel="noreferrer"
        className="px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95 whitespace-nowrap"
        style={{ background: "rgba(139,92,246,0.15)", color: "#8b5cf6", border: "1px solid rgba(139,92,246,0.4)" }}>
        🚀 MAX
      </a>
    </div>
  );
}

// ── Якорная навигация ─────────────────────────────────────────────────────────
export function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("hero");

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 60);
      const sections = NAV_ITEMS.map(n => n.href.replace("#", ""));
      for (const id of [...sections].reverse()) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 120) {
          setActive(id);
          break;
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (href: string) => {
    document.getElementById(href.replace("#", ""))?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-40 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(8,8,16,0.95)" : "transparent",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "none",
        backdropFilter: scrolled ? "blur(20px)" : "none",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 sm:py-3 flex items-center justify-between">
        <span className="text-sm font-black" style={{ fontFamily: "Montserrat, sans-serif", background: "linear-gradient(90deg, #f97316, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          EK
        </span>
        <div className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map(item => {
            const id = item.href.replace("#", "");
            const isActive = active === id;
            return (
              <button
                key={item.href}
                onClick={() => scrollTo(item.href)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
                style={{ color: isActive ? "#fff" : "rgba(255,255,255,0.45)", background: isActive ? "rgba(139,92,246,0.2)" : "transparent" }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <a href={TG_LINK} target="_blank" rel="noreferrer" className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105" style={{ background: "#f97316", color: "#0a0a14" }}>
          Написать
        </a>
      </div>
    </nav>
  );
}