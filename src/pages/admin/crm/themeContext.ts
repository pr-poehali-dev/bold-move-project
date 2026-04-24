import { createContext, useContext } from "react";

export type Theme = "dark" | "light";

export interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
  // Цвета поверхностей
  bg:       string; // страница
  surface:  string; // карточки
  surface2: string; // вложенные
  border:   string; // обводка
  border2:  string; // слабее
  text:     string; // основной
  textSub:  string; // вторичный
  textMute: string; // совсем слабый
}

export const DARK: Omit<ThemeCtx, "toggle"> = {
  theme:    "dark",
  bg:       "#07070f",
  surface:  "#0e0e1c",
  surface2: "#13131f",
  border:   "rgba(255,255,255,0.07)",
  border2:  "rgba(255,255,255,0.04)",
  text:     "#f1f1f8",
  textSub:  "rgba(255,255,255,0.45)",
  textMute: "rgba(255,255,255,0.22)",
};

export const LIGHT: Omit<ThemeCtx, "toggle"> = {
  theme:    "light",
  bg:       "#eef0f6",
  surface:  "#ffffff",
  surface2: "#f0f2f7",
  border:   "rgba(0,0,0,0.12)",
  border2:  "rgba(0,0,0,0.07)",
  text:     "#0f1623",
  textSub:  "#374151",
  textMute: "#6b7280",
};

export const ThemeContext = createContext<ThemeCtx>({ ...DARK, toggle: () => {} });
export const useTheme = () => useContext(ThemeContext);