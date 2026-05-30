// ── Атомарные переиспользуемые компоненты страницы личного бренда ────────────
import { useState, useEffect, useRef } from "react";
import { PROJECTS } from "./lbData";

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

// ── Карточка проекта ──────────────────────────────────────────────────────────
export function ProjectCard({ project, index }: { project: typeof PROJECTS[0]; index: number }) {
  const [activeShot, setActiveShot] = useState(0);
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.15 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  // Авто-листание скриншотов
  useEffect(() => {
    if (!hovered) {
      const t = setInterval(() => setActiveShot(s => (s + 1) % project.screenshots.length), 2500);
      return () => clearInterval(t);
    }
  }, [hovered, project.screenshots.length]);

  const isEven = index % 2 === 0;

  return (
    <div
      ref={ref}
      className="relative rounded-3xl overflow-hidden transition-all duration-700"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : `translateY(${isEven ? 40 : 60}px)`,
        transitionDelay: `${index * 80}ms`,
        background: hovered
          ? `linear-gradient(135deg, rgba(10,10,20,0.98), rgba(10,10,20,0.95))`
          : "rgba(255,255,255,0.025)",
        border: `1.5px solid ${hovered ? project.color : "rgba(255,255,255,0.07)"}`,
        boxShadow: hovered ? `0 0 60px ${project.glow}` : "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Скриншот */}
      <div className="relative overflow-hidden" style={{ height: 220 }}>
        {project.screenshots.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-top transition-all duration-700"
            style={{ opacity: i === activeShot ? 1 : 0, transform: i === activeShot ? "scale(1.02)" : "scale(1)" }}
          />
        ))}
        {/* Gradient overlay */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(8,8,16,0.95) 100%)" }} />
        {/* Dots */}
        {project.screenshots.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {project.screenshots.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveShot(i)}
                className="rounded-full transition-all duration-300"
                style={{ width: i === activeShot ? 20 : 6, height: 6, background: i === activeShot ? project.color : "rgba(255,255,255,0.3)" }}
              />
            ))}
          </div>
        )}
        {/* Tag */}
        <div className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold" style={{ background: project.color, color: "#0a0a14" }}>
          {project.tags[0]}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="text-xl font-bold text-white mb-1" style={{ fontFamily: "Montserrat, sans-serif" }}>{project.title}</h3>
        <p className="text-sm mb-3" style={{ color: project.color }}>{project.subtitle}</p>
        <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.6)" }}>{project.description}</p>

        {/* Features */}
        <ul className="space-y-1.5 mb-5">
          {project.features.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: project.color }} />
              {f}
            </li>
          ))}
        </ul>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {project.tags.map((t, i) => (
            <span key={i} className="px-2.5 py-0.5 rounded-full text-xs" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {t}
            </span>
          ))}
        </div>

        <a
          href={project.link}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 hover:gap-3"
          style={{ background: `${project.color}20`, color: project.color, border: `1px solid ${project.color}40` }}
        >
          Посмотреть живой проект →
        </a>
      </div>
    </div>
  );
}

// ── Анимированный фоновый грид ────────────────────────────────────────────────
export function GridBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(139,92,246,0.06)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      {/* Gradient orbs */}
      <div className="absolute rounded-full" style={{ width: 600, height: 600, top: -200, left: -200, background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)" }} />
      <div className="absolute rounded-full" style={{ width: 500, height: 500, top: 100, right: -100, background: "radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)" }} />
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
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: animated ? `${level}%` : "0%", background: `linear-gradient(90deg, ${color}, ${color}aa)`, boxShadow: animated ? `0 0 8px ${color}60` : "none" }}
        />
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
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex gap-3 px-4 py-3 rounded-2xl transition-all duration-500"
      style={{
        background: "rgba(10,10,20,0.95)",
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
        opacity: show ? 1 : 0,
        transform: `translateX(-50%) translateY(${show ? 0 : 20}px)`,
        pointerEvents: show ? "auto" : "none",
      }}
    >
      <a
        href="https://t.me/krasnor"
        target="_blank"
        rel="noreferrer"
        className="px-5 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95"
        style={{ background: "#f97316", color: "#0a0a14" }}
      >
        Заказать проект
      </a>
      <a
        href="https://max.ru/u/9LHodD0cOKSEfyoFFiNHDKKda2DJEQla4TlbxlDSi7pGygeSc3tM9PafS5g"
        target="_blank"
        rel="noreferrer"
        className="px-5 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95"
        style={{ background: "rgba(139,92,246,0.15)", color: "#8b5cf6", border: "1px solid rgba(139,92,246,0.4)" }}
      >
        Пригласить в команду
      </a>
    </div>
  );
}
