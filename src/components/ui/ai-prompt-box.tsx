import React from "react";
import { ArrowUp, Mic, Square, StopCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(" ");

interface PromptInputBoxProps {
  value: string;
  onValueChange: (v: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export const PromptInputBox = React.forwardRef<HTMLDivElement, PromptInputBoxProps>(
  ({ value, onValueChange, onSubmit, isLoading = false, placeholder = "Спросите Женю о потолках…", className }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const [isRecording, setIsRecording] = React.useState(false);
    const [recTime, setRecTime]         = React.useState(0);
    const timerRef = React.useRef<ReturnType<typeof setInterval>>();

    // Авторесайз textarea
    React.useEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }, [value]);

    // Таймер записи
    React.useEffect(() => {
      if (isRecording) {
        timerRef.current = setInterval(() => setRecTime((t) => t + 1), 1000);
      } else {
        clearInterval(timerRef.current);
        setRecTime(0);
      }
      return () => clearInterval(timerRef.current);
    }, [isRecording]);

    const fmt = (s: number) =>
      `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

    const hasContent = value.trim().length > 0;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (hasContent && !isLoading) onSubmit();
      }
    };

    const handleAction = () => {
      if (isLoading)     return;
      if (isRecording)   { setIsRecording(false); return; }
      if (hasContent)    { onSubmit(); return; }
      setIsRecording(true);
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl border bg-white/[0.04] transition-all duration-300",
          isLoading    ? "border-orange-500/50" : "border-white/[0.07]",
          isRecording  ? "border-red-500/50"    : "",
          "focus-within:border-orange-500/30",
          className
        )}
      >
        {/* Recording UI */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col items-center py-3 px-4 overflow-hidden"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="font-mono text-sm text-white/70">{fmt(recTime)}</span>
              </div>
              <div className="w-full h-8 flex items-center justify-center gap-0.5">
                {Array.from({ length: 28 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-0.5 rounded-full bg-white/40"
                    animate={{ scaleY: [0.3, 1, 0.3] }}
                    transition={{ duration: 0.6 + Math.random() * 0.4, repeat: Infinity, delay: i * 0.04 }}
                    style={{ height: "100%" }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Textarea */}
        <AnimatePresence>
          {!isRecording && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-3 pt-2.5"
            >
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onValueChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                rows={1}
                disabled={isLoading}
                style={{ resize: "none", minHeight: 42, maxHeight: 160 }}
                className="w-full bg-transparent text-white text-[13px] outline-none placeholder:text-white/20 overflow-y-auto py-1"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions bar */}
        <div className="flex items-center justify-between px-2 pb-2 pt-1">
          {/* Подсказка */}
          <span className="text-[10px] text-white/15 pl-1 select-none">
            {isRecording ? "Идёт запись…" : "Enter — отправить · Shift+Enter — перенос"}
          </span>

          {/* Кнопка отправки / записи */}
          <motion.button
            onClick={handleAction}
            disabled={isLoading && !hasContent}
            whileTap={{ scale: 0.9 }}
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200",
              isRecording
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                : hasContent || isLoading
                ? "bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/20"
                : "bg-white/[0.06] text-white/30 hover:bg-white/[0.1] hover:text-white/60"
            )}
          >
            {isLoading ? (
              <Square size={14} className="fill-white animate-pulse" />
            ) : isRecording ? (
              <StopCircle size={16} />
            ) : hasContent ? (
              <ArrowUp size={16} />
            ) : (
              <Mic size={15} />
            )}
          </motion.button>
        </div>
      </div>
    );
  }
);

PromptInputBox.displayName = "PromptInputBox";
