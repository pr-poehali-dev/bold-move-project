import React, { useRef, useEffect, useCallback, useState } from "react";
import Icon from "@/components/ui/icon";

interface Props {
  value: string;           // HTML строка
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
}

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48];

const PRESET_COLORS = [
  "#ffffff", "#ffffffaa", "#ffffff66",
  "#f97316", "#ef4444", "#ec4899",
  "#a78bfa", "#60a5fa", "#34d399",
  "#fbbf24", "#f59e0b", "#6ee7b7",
];

// Sanitize: оставляем только безопасные теги форматирования
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/javascript:/gi, "");
}

// Проверяет активен ли формат в текущем selection
function isFormatActive(cmd: string): boolean {
  try { return document.queryCommandState(cmd); } catch { return false; }
}

export function RichTextEditor({ value, onChange, placeholder, className, minHeight = 48 }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSizePicker, setShowSizePicker] = useState(false);
  const [, forceUpdate] = useState(0);

  // Синхронизируем innerHTML только при внешнем изменении value
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (isInternalChange.current) { isInternalChange.current = false; return; }
    if (el.innerHTML !== value) {
      el.innerHTML = value || "";
    }
  }, [value]);

  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    isInternalChange.current = true;
    onChange(sanitizeHtml(el.innerHTML));
    forceUpdate(n => n + 1); // обновляем состояние кнопок тулбара
  }, [onChange]);

  const exec = useCallback((cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    handleInput();
    forceUpdate(n => n + 1);
  }, [handleInput]);

  const setFontSize = (size: number) => {
    editorRef.current?.focus();
    // execCommand fontSize работает с 1-7, используем span
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("fontSize", false, "7");
    // Заменяем размер на нужный
    const el = editorRef.current;
    if (el) {
      el.querySelectorAll("font[size='7']").forEach(node => {
        const span = document.createElement("span");
        span.style.fontSize = `${size}px`;
        span.innerHTML = (node as HTMLElement).innerHTML;
        node.replaceWith(span);
      });
    }
    handleInput();
    setShowSizePicker(false);
  };

  const setColor = (color: string) => {
    exec("foreColor", color);
    setShowColorPicker(false);
  };

  const btnCls = (active: boolean) =>
    `w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition cursor-pointer select-none ${
      active
        ? "bg-violet-500/40 text-violet-300 border border-violet-500/50"
        : "bg-white/[0.05] text-white/50 hover:bg-white/[0.10] hover:text-white/80 border border-white/[0.08]"
    }`;

  const isBold   = isFormatActive("bold");
  const isItalic = isFormatActive("italic");
  const isUnder  = isFormatActive("underline");
  const isStrike = isFormatActive("strikeThrough");

  return (
    <div className="flex flex-col gap-1.5">
      {/* ── Тулбар ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1 p-1.5 rounded-xl bg-white/[0.04] border border-white/[0.07]">

        {/* Жирный */}
        <button type="button" onMouseDown={e => { e.preventDefault(); exec("bold"); }} className={btnCls(isBold)} title="Жирный (Ctrl+B)">
          <span style={{ fontWeight: 900 }}>Ж</span>
        </button>

        {/* Курсив */}
        <button type="button" onMouseDown={e => { e.preventDefault(); exec("italic"); }} className={btnCls(isItalic)} title="Курсив (Ctrl+I)">
          <span style={{ fontStyle: "italic", fontWeight: 700 }}>К</span>
        </button>

        {/* Подчёркнутый */}
        <button type="button" onMouseDown={e => { e.preventDefault(); exec("underline"); }} className={btnCls(isUnder)} title="Подчёркнутый (Ctrl+U)">
          <span style={{ textDecoration: "underline" }}>Ч</span>
        </button>

        {/* Перечёркнутый */}
        <button type="button" onMouseDown={e => { e.preventDefault(); exec("strikeThrough"); }} className={btnCls(isStrike)} title="Перечёркнутый">
          <span style={{ textDecoration: "line-through" }}>З</span>
        </button>

        <div className="w-px h-5 bg-white/[0.08] mx-0.5" />

        {/* Размер шрифта */}
        <div className="relative">
          <button type="button" onMouseDown={e => { e.preventDefault(); setShowSizePicker(v => !v); setShowColorPicker(false); }}
            className="h-7 px-2 rounded-lg flex items-center gap-1 text-[11px] text-white/50 hover:text-white/80 bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] transition select-none"
            title="Размер шрифта">
            <Icon name="Type" size={11} />
            <Icon name="ChevronDown" size={9} />
          </button>
          {showSizePicker && (
            <>
              <div className="fixed inset-0 z-40" onMouseDown={() => setShowSizePicker(false)} />
              <div className="absolute top-full left-0 mt-1 z-50 bg-[#1a1a2e] border border-white/[0.12] rounded-xl shadow-2xl p-1.5 grid grid-cols-3 gap-1 min-w-[120px]">
                {FONT_SIZES.map(sz => (
                  <button key={sz} type="button"
                    onMouseDown={e => { e.preventDefault(); setFontSize(sz); }}
                    className="px-2 py-1 rounded-lg text-xs text-white/60 hover:bg-violet-500/20 hover:text-violet-300 transition text-center">
                    {sz}px
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Цвет текста */}
        <div className="relative">
          <button type="button" onMouseDown={e => { e.preventDefault(); setShowColorPicker(v => !v); setShowSizePicker(false); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] transition select-none"
            title="Цвет текста">
            <span className="text-xs font-bold" style={{ color: "#f97316" }}>A</span>
          </button>
          {showColorPicker && (
            <>
              <div className="fixed inset-0 z-40" onMouseDown={() => setShowColorPicker(false)} />
              <div className="absolute top-full left-0 mt-1 z-50 bg-[#1a1a2e] border border-white/[0.12] rounded-xl shadow-2xl p-2">
                <div className="grid grid-cols-6 gap-1 mb-2">
                  {PRESET_COLORS.map(c => (
                    <button key={c} type="button"
                      onMouseDown={e => { e.preventDefault(); setColor(c); }}
                      className="w-6 h-6 rounded-lg border-2 border-transparent hover:border-white/50 transition"
                      style={{ background: c }} />
                  ))}
                </div>
                {/* Кастомный цвет */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-white/30">Свой:</span>
                  <input type="color" defaultValue="#ffffff"
                    onChange={e => setColor(e.target.value)}
                    className="w-8 h-6 rounded cursor-pointer border border-white/10 bg-transparent" />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="w-px h-5 bg-white/[0.08] mx-0.5" />

        {/* Выравнивание */}
        {(["justifyLeft","justifyCenter","justifyRight"] as const).map((cmd, i) => (
          <button key={cmd} type="button"
            onMouseDown={e => { e.preventDefault(); exec(cmd); }}
            className={btnCls(isFormatActive(cmd))}
            title={["По левому краю","По центру","По правому краю"][i]}>
            <Icon name={["AlignLeft","AlignCenter","AlignRight"][i]} size={12} />
          </button>
        ))}

        <div className="w-px h-5 bg-white/[0.08] mx-0.5" />

        {/* Сброс форматирования */}
        <button type="button" onMouseDown={e => { e.preventDefault(); exec("removeFormat"); }}
          className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.05] text-white/30 hover:bg-red-500/10 hover:text-red-400 border border-white/[0.08] transition select-none"
          title="Сбросить форматирование">
          <Icon name="RemoveFormatting" size={12} fallback="X" />
        </button>
      </div>

      {/* ── Редактируемая область ────────────────────────── */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={e => {
          // Ctrl+B/I/U уже обрабатывается браузером
          if (e.key === "Enter" && e.shiftKey) {
            // Shift+Enter = <br> вместо нового параграфа
          }
        }}
        className={`w-full rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-violet-500/40 bg-white/[0.06] border border-white/[0.1] px-3 py-2 text-sm leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-white/25 ${className ?? ""}`}
        style={{ minHeight, wordBreak: "break-word", overflowWrap: "break-word" }}
        data-placeholder={placeholder ?? "Введите текст..."}
        onFocus={() => forceUpdate(n => n + 1)}
        onBlur={() => forceUpdate(n => n + 1)}
        onMouseUp={() => forceUpdate(n => n + 1)}
        onKeyUp={() => forceUpdate(n => n + 1)}
      />
    </div>
  );
}
