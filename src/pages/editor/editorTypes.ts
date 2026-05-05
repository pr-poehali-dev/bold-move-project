import React from "react";
import type { PageBlock, PageBlockStyle } from "@/context/AuthContext";

export function genId() { return Math.random().toString(36).slice(2, 9); }

export function getYouTubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

export function snap(val: number, grid: number, enabled: boolean) {
  if (!enabled || grid < 1) return val;
  return Math.round(val / grid) * grid;
}

export const SNAP_EDGE = 6;

export const DEFAULT_SIZES: Record<string, { w: number; h: number }> = {
  heading: { w: 300, h: 60 },
  text:    { w: 300, h: 100 },
  gallery: { w: 300, h: 200 },
  buttons: { w: 240, h: 60 },
  card:    { w: 160, h: 140 },
  video:   { w: 300, h: 180 },
  divider: { w: 300, h: 24 },
  spacer:  { w: 300, h: 48 },
};

export function defaultBlock(type: PageBlock["type"], x = 40, y = 40): PageBlock {
  const sz = DEFAULT_SIZES[type] ?? { w: 240, h: 80 };
  const base = { id: genId(), x, y, w: sz.w, h: sz.h, zIndex: 1 };
  if (type === "heading")  return { ...base, type, text: "Заголовок", size: "lg", align: "left" };
  if (type === "text")     return { ...base, type, text: "Введите текст...", align: "left" };
  if (type === "gallery")  return { ...base, type, photos: [], cols: 2, ratio: "4/3" };
  if (type === "buttons")  return { ...base, type, items: [{ label: "Позвонить", action: "phone", value: "", style: "primary" }] };
  if (type === "video")    return { ...base, type, url: "" };
  if (type === "spacer")   return { ...base, type, height: 32 };
  if (type === "card")     return { ...base, type, icon: "⭐", title: "Карточка", text: "Описание", align: "center" };
  return { ...base, type: "divider", style: "line" };
}

export const ADD_BLOCKS: { type: PageBlock["type"]; icon: string; label: string; color: string; bg: string }[] = [
  { type: "heading",  icon: "Heading",       label: "Заголовок",   color: "#c4b5fd", bg: "rgba(139,92,246,0.15)" },
  { type: "text",     icon: "AlignLeft",     label: "Текст",       color: "#93c5fd", bg: "rgba(59,130,246,0.15)" },
  { type: "gallery",  icon: "Image",         label: "Галерея",     color: "#6ee7b7", bg: "rgba(16,185,129,0.15)" },
  { type: "buttons",  icon: "MousePointer",  label: "Кнопки",      color: "#fca5a5", bg: "rgba(239,68,68,0.15)"  },
  { type: "card",     icon: "LayoutList",    label: "Карточка",    color: "#fcd34d", bg: "rgba(245,158,11,0.15)" },
  { type: "video",    icon: "Play",          label: "Видео",       color: "#f9a8d4", bg: "rgba(236,72,153,0.15)" },
  { type: "divider",  icon: "Minus",         label: "Разделитель", color: "#94a3b8", bg: "rgba(148,163,184,0.12)"},
  { type: "spacer",   icon: "ArrowUpDown",   label: "Отступ",      color: "#67e8f9", bg: "rgba(6,182,212,0.13)"  },
];

export const BLOCK_LABELS: Record<string, string> = {
  heading: "Заголовок", text: "Текст", gallery: "Галерея",
  buttons: "Кнопки", divider: "Разделитель", video: "Видео",
  spacer: "Отступ", card: "Карточка",
};

export const HANDLES = ["n","ne","e","se","s","sw","w","nw"] as const;
export type Handle = typeof HANDLES[number];
export const HANDLE_CURSOR: Record<Handle, string> = {
  n:"ns-resize", ne:"nesw-resize", e:"ew-resize", se:"nwse-resize",
  s:"ns-resize", sw:"nesw-resize", w:"ew-resize", nw:"nwse-resize",
};
export const HANDLE_POS: Record<Handle, string> = {
  n:  "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2",
  ne: "top-0 right-0 -translate-y-1/2 translate-x-1/2",
  e:  "top-1/2 right-0 -translate-y-1/2 translate-x-1/2",
  se: "bottom-0 right-0 translate-y-1/2 translate-x-1/2",
  s:  "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2",
  sw: "bottom-0 left-0 translate-y-1/2 -translate-x-1/2",
  w:  "top-1/2 left-0 -translate-y-1/2 -translate-x-1/2",
  nw: "top-0 left-0 -translate-y-1/2 -translate-x-1/2",
};

export function hexWithOpacity(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${opacity/100})`;
}

export function blockStyleToCss(s?: PageBlockStyle): React.CSSProperties {
  if (!s) return {};
  const css: React.CSSProperties = {};

  // Фон
  if (s.bgType === "color" && s.bgColor) {
    css.backgroundColor = s.bgColor;
    if (s.bgOpacity !== undefined) css.backgroundColor = hexWithOpacity(s.bgColor, s.bgOpacity);
  } else if (s.bgType === "gradient" && s.bgGradFrom && s.bgGradTo) {
    const angle = s.bgGradAngle ?? 135;
    css.background = `linear-gradient(${angle}deg, ${s.bgGradFrom}, ${s.bgGradTo})`;
  }

  // Рамка
  if (s.borderWidth && s.borderWidth > 0) {
    css.border = `${s.borderWidth}px ${s.borderStyle ?? "solid"} ${s.borderColor ?? "#ffffff33"}`;
  }
  if (s.borderRadius !== undefined) css.borderRadius = s.borderRadius;

  // Тень
  if ((s.shadowBlur ?? 0) > 0 || (s.shadowX ?? 0) !== 0 || (s.shadowY ?? 0) !== 0) {
    css.boxShadow = `${s.shadowX ?? 0}px ${s.shadowY ?? 0}px ${s.shadowBlur ?? 0}px ${s.shadowColor ?? "rgba(0,0,0,0.4)"}`;
  }

  // Внутренние отступы
  if (s.padTop || s.padRight || s.padBottom || s.padLeft) {
    css.padding = `${s.padTop ?? 0}px ${s.padRight ?? 0}px ${s.padBottom ?? 0}px ${s.padLeft ?? 0}px`;
  }

  // Прозрачность
  if (s.opacity !== undefined && s.opacity < 100) {
    css.opacity = s.opacity / 100;
  }

  return css;
}
