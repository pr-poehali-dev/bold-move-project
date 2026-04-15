import React from "react";
import { Send, Mic, Square, StopCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const cn = (...c: (string | undefined | null | false)[]) => c.filter(Boolean).join(" ");

// Расширяем window для SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface Props {
  value: string;
  onValueChange: (v: string) => void;
  onSubmit: (text: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export const PromptInputBox = React.forwardRef<HTMLDivElement, Props>(
  ({ value, onValueChange, onSubmit, isLoading = false, placeholder = "Спросите Женю о потолках…" }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const [isRecording, setIsRecording] = React.useState(false);
    const [recTime, setRecTime] = React.useState(0);
    const [speechError, setSpeechError] = React.useState("");
    const [bars] = React.useState(() =>
      Array.from({ length: 26 }, () => 0.2 + Math.random() * 0.8)
    );
    const timerRef = React.useRef<ReturnType<typeof setInterval>>();
    const recognitionRef = React.useRef<SpeechRecognition | null>(null);
    const stoppedByUserRef = React.useRef(false);

    // Авторесайз textarea
    React.useEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
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

    const startRecording = () => {
      setSpeechError("");
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        setSpeechError("Браузер не поддерживает голосовой ввод");
        return;
      }
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      const recognition = new SR();
      recognition.lang = "ru-RU";
      recognition.continuous = !isMobile;
      recognition.interimResults = true;

      const finalTextRef = { current: value };
      stoppedByUserRef.current = false;

      const restartIfNeeded = () => {
        if (stoppedByUserRef.current) return;
        try { recognition.start(); } catch { /* уже запущен */ }
      };

      recognition.onresult = (e: SpeechRecognitionEvent) => {
        let interim = "";
        let final = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) final += t;
          else interim += t;
        }
        if (final) {
          finalTextRef.current = (finalTextRef.current + " " + final).trim();
          onValueChange(finalTextRef.current);
        } else if (interim) {
          onValueChange((finalTextRef.current + " " + interim).trim());
        }
      };

      recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
        if (e.error === "not-allowed") {
          setSpeechError("Нет доступа к микрофону");
          stoppedByUserRef.current = true;
          setIsRecording(false);
        } else if (e.error === "no-speech" || e.error === "aborted") {
          // Пауза или прерывание — перезапустим в onend
        } else {
          stoppedByUserRef.current = true;
          setIsRecording(false);
        }
      };

      recognition.onend = () => {
        if (stoppedByUserRef.current) {
          setIsRecording(false);
          return;
        }
        // Перезапускаем после паузы — пользователь ещё не нажал стоп
        setTimeout(restartIfNeeded, 100);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
    };

    const stopRecording = () => {
      stoppedByUserRef.current = true;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setIsRecording(false);
    };

    const fmt = (s: number) =>
      `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

    const hasContent = value.trim().length > 0;

    const handleSend = () => {
      const text = value.trim();
      if (!text || isLoading || isRecording) return;
      onSubmit(text);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    const handleAction = () => {
      if (isLoading) return;
      if (isRecording) { stopRecording(); return; }
      if (hasContent) { handleSend(); return; }
      startRecording();
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl border transition-all duration-300",
          isRecording
            ? "border-red-500/40 bg-white/[0.04]"
            : isLoading
            ? "border-orange-500/40 bg-white/[0.04]"
            : "border-white/[0.07] bg-white/[0.04] focus-within:border-orange-500/30"
        )}
      >
        {/* Визуализация записи */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              key="recording"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col items-center pt-3 pb-1 px-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="font-mono text-xs text-white/60">{fmt(recTime)}</span>
                  <span className="text-white/25 text-[11px]">· говорите сейчас</span>
                </div>
                <div className="w-full h-8 flex items-end justify-center gap-[3px]">
                  {bars.map((h, i) => (
                    <motion.div
                      key={i}
                      className="w-[3px] rounded-full bg-gradient-to-t from-orange-500 to-rose-400"
                      animate={{ scaleY: [h, 1, h * 0.4, 0.9, h] }}
                      transition={{
                        duration: 0.7 + h * 0.5,
                        repeat: Infinity,
                        delay: i * 0.035,
                        ease: "easeInOut",
                      }}
                      style={{ height: "100%", transformOrigin: "bottom" }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Textarea */}
        <AnimatePresence initial={false}>
          {!isRecording && (
            <motion.div
              key="textarea"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-end gap-2 px-3 pt-2.5 pb-0"
            >
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onValueChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                rows={1}
                disabled={isLoading}
                style={{ resize: "none", minHeight: 38, maxHeight: 120 }}
                className="flex-1 bg-transparent text-white text-[13px] outline-none placeholder:text-white/20 overflow-y-auto py-1 leading-relaxed"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ошибка микрофона */}
        {speechError && (
          <div className="px-3 pb-1">
            <span className="text-[10px] text-red-400">{speechError}</span>
          </div>
        )}

        {/* Нижняя панель — две кнопки */}
        <div className="flex items-center justify-end gap-2 px-2.5 py-2">

          {/* Кнопка микрофон */}
          <motion.button
            onClick={() => { if (isLoading) return; if (isRecording) stopRecording(); else startRecording(); }}
            whileTap={{ scale: 0.85 }}
            whileHover={{ scale: 1.06 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            title={isRecording ? "Остановить запись" : "Надиктовать голосом"}
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-200",
              isRecording
                ? "bg-red-500/20 text-red-400"
                : "bg-white/[0.06] text-white/30 hover:bg-white/[0.1] hover:text-white/60"
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isRecording ? (
                <motion.span key="stoprec"
                  initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                  transition={{ duration: 0.12 }}>
                  <StopCircle size={16} />
                </motion.span>
              ) : (
                <motion.span key="mic"
                  initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                  transition={{ duration: 0.12 }}>
                  <Mic size={15} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Кнопка отправить */}
          <motion.button
            onClick={handleSend}
            disabled={!hasContent || isLoading || isRecording}
            whileTap={{ scale: 0.85 }}
            whileHover={{ scale: 1.06 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            title="Отправить"
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-200",
              hasContent && !isLoading && !isRecording
                ? "bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-md shadow-orange-500/20"
                : "bg-white/[0.06] text-white/20"
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isLoading ? (
                <motion.span key="loading"
                  initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                  transition={{ duration: 0.12 }}>
                  <Square size={13} className="fill-white" />
                </motion.span>
              ) : (
                <motion.span key="send"
                  initial={{ scale: 0, x: -3 }} animate={{ scale: 1, x: 0 }} exit={{ scale: 0 }}
                  transition={{ duration: 0.12 }}>
                  <Send size={15} className="-translate-x-px" />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

        </div>
      </div>
    );
  }
);

PromptInputBox.displayName = "PromptInputBox";