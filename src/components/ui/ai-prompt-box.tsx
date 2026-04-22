import React from "react";
import { Send, Mic, StopCircle, Paperclip, CheckCircle2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import func2url from "@/../backend/func2url.json";
import { usePhone } from "@/hooks/use-phone";

const UPLOAD_URL = func2url["live-chat"];

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
  hasEstimate?: boolean;
  onNewEstimate?: () => void;
}

export const PromptInputBox = React.forwardRef<HTMLDivElement, Props>(
  ({ value, onValueChange, onSubmit, isLoading = false, placeholder = "Спросите Женю о потолках…", hasEstimate = false, onNewEstimate }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const [isRecording, setIsRecording] = React.useState(false);
    const [isTranscribing, setIsTranscribing] = React.useState(false);
    const [recTime, setRecTime] = React.useState(0);
    const [speechError, setSpeechError] = React.useState("");
    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
    const audioChunksRef = React.useRef<Blob[]>([]);

    const WHISPER_URL = func2url["whisper-transcribe"];
    const [bars] = React.useState(() =>
      Array.from({ length: 26 }, () => 0.2 + Math.random() * 0.8)
    );
    const timerRef = React.useRef<ReturnType<typeof setInterval>>();
    const recognitionRef = React.useRef<SpeechRecognition | null>(null);
    const stoppedByUserRef = React.useRef(false);
    const errorCountRef = React.useRef(0);
    const restartTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
    const isIOS = React.useMemo(() =>
      typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent), []);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [uploadState, setUploadState] = React.useState<"idle" | "loading" | "done" | "error">("idle");
    const [showUploadModal, setShowUploadModal] = React.useState(false);
    const [phoneSent, setPhoneSent] = React.useState(false);
    const { phone: uploadPhone, handleChange: handlePhoneChange, handleFocus: focusPhone, handleBlur: blurPhone, isValid: phoneValid } = usePhone();

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadState("loading");

      const CHUNK = 700 * 1024;
      const total = Math.ceil(file.size / CHUNK);
      const fileId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const toB64 = (buf: ArrayBuffer): string => {
        const bytes = new Uint8Array(buf);
        let bin = "";
        for (let j = 0; j < bytes.length; j++) bin += String.fromCharCode(bytes[j]);
        return btoa(bin);
      };

      try {
        for (let i = 0; i < total; i++) {
          const slice = file.slice(i * CHUNK, (i + 1) * CHUNK);
          const buf = await slice.arrayBuffer();
          const b64 = toB64(buf);
          const res = await fetch(`${UPLOAD_URL}?action=chunk`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              file_id: fileId,
              filename: file.name,
              chunk_index: i,
              total_chunks: total,
              data: b64,
            }),
          });
          if (!res.ok) throw new Error(`chunk ${i} failed`);
        }
        setUploadState("done");
        setShowUploadModal(true);
      } catch {
        setUploadState("error");
        setTimeout(() => { setUploadState("idle"); if (fileInputRef.current) fileInputRef.current.value = ""; }, 3000);
        return;
      }
      setUploadState("idle");
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

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

    // iOS: MediaRecorder → Whisper
    const startIOSRecording = async () => {
      setSpeechError("");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];

        const mimeType = MediaRecorder.isTypeSupported("audio/mp4;codecs=mp4a")
          ? "audio/mp4;codecs=mp4a"
          : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "audio/mp4";

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          setIsRecording(false);
          setIsTranscribing(true);
          try {
            const blob = new Blob(audioChunksRef.current, { type: "audio/mp4" });
            // FileReader — надёжный способ base64 на iOS Safari
            const b64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = reader.result as string;
                resolve(dataUrl.split(",")[1]);
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            const res = await fetch(WHISPER_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audio: b64, mimeType: "audio/mp4" }),
            });
            const data = await res.json();
            if (data.text?.trim()) {
              onValueChange((value + " " + data.text).trim());
            } else {
              setSpeechError("Не удалось распознать речь");
            }
          } catch (e) {
            setSpeechError("Ошибка отправки аудио");
          } finally {
            setIsTranscribing(false);
          }
        };

        recorder.start();
        setIsRecording(true);
      } catch {
        setSpeechError("Нет доступа к микрофону");
      }
    };

    const stopIOSRecording = () => {
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current = null;
    };

    // Android/Desktop: Web Speech Recognition
    const startSpeechRecognition = () => {
      setSpeechError("");
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        setSpeechError("Браузер не поддерживает голосовой ввод");
        return;
      }

      const accumulatedRef = { current: value };
      stoppedByUserRef.current = false;
      errorCountRef.current = 0;

      const createAndStart = () => {
        if (stoppedByUserRef.current) return;

        const recognition = new SR();
        recognition.lang = "ru-RU";
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = (e: SpeechRecognitionEvent) => {
          errorCountRef.current = 0;
          let interimText = "";
          let finalText = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const t = e.results[i][0].transcript;
            if (e.results[i].isFinal) finalText += t;
            else interimText += t;
          }
          if (finalText) {
            accumulatedRef.current = (accumulatedRef.current + " " + finalText).trim();
            onValueChange(accumulatedRef.current);
          } else if (interimText) {
            onValueChange((accumulatedRef.current + " " + interimText).trim());
          }
        };

        recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
          if (e.error === "not-allowed") {
            setSpeechError("Нет доступа к микрофону");
            stoppedByUserRef.current = true;
            setIsRecording(false);
            return;
          }
          if (e.error === "network" || e.error === "service-not-available") {
            errorCountRef.current += 1;
          }
        };

        recognition.onend = () => {
          recognitionRef.current = null;
          if (stoppedByUserRef.current) { setIsRecording(false); return; }
          if (errorCountRef.current >= 3) {
            setSpeechError("Нет связи с сервисом распознавания");
            setIsRecording(false);
            return;
          }
          // Всегда перезапускаем — только явный стоп от пользователя останавливает
          clearTimeout(restartTimerRef.current);
          restartTimerRef.current = setTimeout(createAndStart, 150);
        };

        recognitionRef.current = recognition;
        try {
          recognition.start();
        } catch {
          clearTimeout(restartTimerRef.current);
          restartTimerRef.current = setTimeout(createAndStart, 500);
        }
      };

      createAndStart();
      setIsRecording(true);
    };

    const startRecording = () => {
      if (isIOS) startIOSRecording();
      else startSpeechRecognition();
    };

    const stopRecording = () => {
      if (isIOS) { stopIOSRecording(); return; }
      stoppedByUserRef.current = true;
      clearTimeout(restartTimerRef.current);
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setIsRecording(false);
    };

    const fmt = (s: number) =>
      `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

    const sendPhone = () => {
      if (!phoneValid) return;
      fetch(`${UPLOAD_URL}?action=send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: "upload-phone",
          name: "Клиент (загрузил проект)",
          text: `📱 Контакт для просчёта: ${uploadPhone.trim()}`,
        }),
      });
      setPhoneSent(true);
    };

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
      <>
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
        {/* Визуализация записи / расшифровки */}
        <AnimatePresence>
          {(isRecording || isTranscribing) && (
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
                  {isTranscribing ? (
                    <>
                      <Loader2 size={12} className="text-orange-400 animate-spin" />
                      <span className="text-orange-400/70 text-[11px]">расшифровываю...</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      {isIOS
                        ? <span className="text-white/40 text-[11px]">говорите, затем нажмите ⏹</span>
                        : <><span className="font-mono text-xs text-white/60">{fmt(recTime)}</span><span className="text-white/25 text-[11px]">· говорите сейчас</span></>
                      }
                    </>
                  )}
                </div>
                <div className="w-full h-8 flex items-end justify-center gap-[3px]">
                  {bars.map((h, i) => (
                    <motion.div
                      key={i}
                      className="w-[3px] rounded-full bg-gradient-to-t from-orange-500 to-rose-400"
                      animate={isTranscribing ? { scaleY: 0.15 } : { scaleY: [h, 1, h * 0.4, 0.9, h] }}
                      transition={isTranscribing ? { duration: 0.4 } : {
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
          {!isRecording && !isTranscribing && (
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

        {/* Нижняя панель */}
        <div className="flex items-center justify-end gap-2 px-2.5 py-2">

          {/* Кнопка загрузки файла / новая смета */}
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.dwg,.dxf" />
          {hasEstimate ? (
            <motion.button
              onClick={onNewEstimate}
              whileTap={{ scale: 0.92 }}
              title="Создать новую смету"
              className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-[11px] font-medium shrink-0 transition-all duration-200 bg-orange-500/15 text-orange-400 hover:bg-orange-500/25"
            >
              <CheckCircle2 size={13} />
              <span>Создать новую смету</span>
            </motion.button>
          ) : (
            <motion.button
              onClick={() => uploadState === "idle" && fileInputRef.current?.click()}
              whileTap={{ scale: 0.92 }}
              title="Загрузить проект"
              className={cn(
                "flex items-center gap-1.5 px-3 h-9 rounded-xl text-[11px] font-medium shrink-0 transition-all duration-200",
                uploadState === "done"  ? "bg-green-500/20 text-green-400"
                : uploadState === "error"  ? "bg-red-500/20 text-red-400"
                : uploadState === "loading" ? "bg-white/[0.06] text-white/40 cursor-wait"
                : "bg-white/[0.06] text-white/40 hover:bg-orange-500/10 hover:text-orange-400"
              )}
            >
              {uploadState === "loading" ? <Loader2 size={13} className="animate-spin" />
                : uploadState === "done" ? <CheckCircle2 size={13} />
                : <Paperclip size={13} />}
              <span>
                {uploadState === "loading" ? "Отправка…"
                  : uploadState === "done" ? "Отправлено!"
                  : uploadState === "error" ? "Ошибка"
                  : "Загрузить проект"}
              </span>
            </motion.button>
          )}

          {/* Кнопка микрофон */}
          <motion.button
            onClick={() => { if (isLoading || isTranscribing) return; if (isRecording) stopRecording(); else startRecording(); }}
            whileTap={{ scale: 0.85 }}
            whileHover={{ scale: 1.06 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            title={isRecording ? "Остановить запись" : "Надиктовать голосом"}
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-200",
              isRecording ? "bg-red-500/20 text-red-400"
              : isTranscribing ? "bg-orange-500/10 text-orange-400"
              : "bg-white/[0.06] text-white/30 hover:bg-white/[0.1] hover:text-white/60"
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isTranscribing ? (
                <motion.span key="spin"
                  initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                  transition={{ duration: 0.12 }}>
                  <Loader2 size={15} className="animate-spin" />
                </motion.span>
              ) : isRecording ? (
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

      {/* Модал после загрузки проекта */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ backdropFilter: "blur(8px)", background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-sm rounded-3xl border border-orange-500/25 bg-[#16100a]/98 shadow-2xl shadow-orange-500/15 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 to-rose-500" />
            <div className="p-6">
              {!phoneSent ? (
                <>
                  <div className="flex flex-col items-center text-center mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center mb-3 text-2xl">📐</div>
                    <div className="text-white font-bold text-base mb-2">Проект получен!</div>
                    <div className="text-white/50 text-sm leading-relaxed">
                      Мы уже приступили к скрупулёзному изучению вашего проекта и скоро вернёмся с качественным просчётом стоимости.
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="text-white/60 text-xs mb-2 text-center">Куда отправить просчёт?</div>
                    <input
                      type="tel"
                      value={uploadPhone}
                      onChange={handlePhoneChange}
                      onFocus={focusPhone}
                      onBlur={blurPhone}
                      placeholder="+7 (___) ___-__-__"
                      className={`w-full bg-white/[0.06] border rounded-xl px-4 py-3 text-white text-sm outline-none placeholder:text-white/20 mb-3 transition-colors ${uploadPhone && !phoneValid ? "border-rose-500/50" : "border-white/10 focus:border-orange-500/40"}`}
                    />
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {/* Telegram */}
                      <div className="flex flex-col items-center gap-1 bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 text-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="12" fill="url(#tg-grad)"/>
                          <defs><linearGradient id="tg-grad" x1="12" y1="0" x2="12" y2="24" gradientUnits="userSpaceOnUse"><stop stopColor="#2AABEE"/><stop offset="1" stopColor="#229ED9"/></linearGradient></defs>
                          <path d="M5.5 11.5L17 7l-2 9.5-3.5-2.5-1.5 1.5V13l5-4.5-6.5 3.5L5.5 11.5z" fill="white"/>
                        </svg>
                        <span className="text-white/40 text-[10px]">Telegram</span>
                      </div>
                      {/* MAX */}
                      <div className="flex flex-col items-center gap-1 bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 text-center">
                        <img src="https://cdn.poehali.dev/files/dc3bd406-b8e7-4faf-a027-22420f5483ee.png" alt="MAX" className="w-6 h-6 rounded-md object-cover" />
                        <span className="text-white/40 text-[10px]">MAX</span>
                      </div>
                      {/* WhatsApp */}
                      <div className="flex flex-col items-center gap-1 bg-white/[0.04] border border-white/[0.07] rounded-xl py-2.5 text-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="12" fill="#25D366"/>
                          <path d="M17.5 14.4c-.3-.1-1.7-.8-1.9-.9-.3-.1-.5-.1-.7.1-.2.3-.7.9-.9 1-.2.2-.3.2-.6.1-.3-.2-1.2-.4-2.3-1.4-.8-.7-1.4-1.6-1.5-1.9-.2-.3 0-.4.1-.6l.4-.5c.1-.2.2-.3.2-.5 0-.2-.6-1.5-.9-2-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4C8 8.5 7.3 9.2 7.3 10.6s1 2.7 1.1 2.9c.2.2 2 3 4.8 4.2.7.3 1.2.4 1.6.5.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.6.2-1.2.1-1.3-.1-.1-.3-.2-.6-.3z" fill="white"/>
                        </svg>
                        <span className="text-white/40 text-[10px]">WhatsApp</span>
                      </div>
                    </div>
                    <button
                      onClick={sendPhone}
                      disabled={!phoneValid}
                      className="w-full bg-gradient-to-r from-orange-500 to-rose-500 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-all active:scale-[0.98]">
                      Отправить контакт
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center text-center py-4 gap-3">
                  <div className="text-4xl">✅</div>
                  <div className="text-white font-bold">Отлично!</div>
                  <div className="text-white/50 text-sm">Мы свяжемся с вами по указанному контакту с готовым просчётом.</div>
                  <button onClick={() => { setShowUploadModal(false); setPhoneSent(false); }}
                    className="mt-2 text-orange-400 text-sm hover:text-orange-300 underline">Закрыть</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </>
    );
  }
);

PromptInputBox.displayName = "PromptInputBox";