import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { ComplexityPrompts, ThemeClasses, DEFAULT_FORMULA, DEFAULT_COMPLEXITY_PROMPTS } from "./discountRiskTypes";
import func2url from "@/../backend/func2url.json";

const TRANSCRIBE_URL = func2url["deepgram-transcribe"];
const WHISPER_URL = func2url["whisper-transcribe"];
const VOICE_EDIT_URL = func2url["voice-edit-prompt"];

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface Props {
  isDark: boolean;
  theme: ThemeClasses;
  readOnly: boolean;
  formula: string;
  setFormula: (v: string) => void;
  complexityPrompts: ComplexityPrompts;
  setComplexityPrompts: (p: ComplexityPrompts) => void;
  activePromptTab: "math" | "semantic" | "combine";
  setActivePromptTab: (t: "math" | "semantic" | "combine") => void;
  savedPrompts: boolean;
  improvedPrompts?: boolean;
  onSavePrompts: () => void;
  onImprovePrompts: () => void;
}

export default function ComplexityAiPrompts({
  isDark, theme, readOnly,
  formula, setFormula,
  complexityPrompts, setComplexityPrompts,
  activePromptTab, setActivePromptTab,
  savedPrompts, improvedPrompts, onSavePrompts, onImprovePrompts,
}: Props) {
  const [animating, setAnimating] = useState(false);
  const [animStep, setAnimStep] = useState(0);

  // Запись голоса
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isEditingByAI, setIsEditingByAI] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [voiceSuccess, setVoiceSuccess] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const stoppedByUserRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const iosStreamRef = useRef<MediaStream | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // iOS Safari detection (без CriOS = Chrome iOS)
  const isIOS = !/CriOS/i.test(navigator.userAgent) && (
    /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );

  // Авторесайз textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [complexityPrompts, activePromptTab]);

  useEffect(() => {
    if (!improvedPrompts) return;
    setAnimating(true);
    setAnimStep(1);
    const t1 = setTimeout(() => setAnimStep(2), 1200);
    const t2 = setTimeout(() => { setAnimating(false); setAnimStep(0); }, 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [improvedPrompts]);

  // Отправить транскрипт на GPT для редактирования промпта
  const applyVoiceEdit = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return;
    setIsEditingByAI(true);
    setVoiceError("");
    try {
      const res = await fetch(VOICE_EDIT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: complexityPrompts[activePromptTab],
          command: transcript,
          promptType: activePromptTab,
        }),
      });
      const data = await res.json();
      if (data.prompt) {
        setComplexityPrompts({ ...complexityPrompts, [activePromptTab]: data.prompt });
        setVoiceSuccess(true);
        setTimeout(() => setVoiceSuccess(false), 3000);
      } else {
        setVoiceError(data.error || "Ошибка AI");
      }
    } catch {
      setVoiceError("Ошибка соединения");
    } finally {
      setIsEditingByAI(false);
    }
  }, [complexityPrompts, activePromptTab, setComplexityPrompts]);

  // Транскрипция blob → Deepgram → GPT edit
  const transcribeBlob = useCallback(async (blob: Blob) => {
    if (blob.size === 0) { setVoiceError("Пустая запись"); return; }
    setIsTranscribing(true);
    try {
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const b64 = btoa(bin);

      let data: { text?: string; error?: string } = {};
      let res = await fetch(TRANSCRIBE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: b64, mimeType: blob.type || "audio/mp4" }),
      });
      data = await res.json();

      if (!data.text && res.status !== 200) {
        res = await fetch(WHISPER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio: b64, mimeType: blob.type || "audio/mp4" }),
        });
        data = await res.json();
      }

      if (data.text) {
        setIsTranscribing(false);
        await applyVoiceEdit(data.text);
      } else {
        setVoiceError(`Ошибка: ${data.error || "не распознано"}`);
        setIsTranscribing(false);
      }
    } catch {
      setVoiceError("Ошибка распознавания");
      setIsTranscribing(false);
    }
  }, [applyVoiceEdit]);

  // iOS: MediaRecorder → Deepgram
  const startIosRecording = useCallback(async () => {
    setVoiceError("");
    let stream = iosStreamRef.current;
    if (!stream || stream.getAudioTracks()[0]?.readyState === "ended") {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        iosStreamRef.current = stream;
      } catch {
        setVoiceError("Нет доступа к микрофону");
        return;
      }
    }
    const formats = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg", ""];
    const mimeType = formats.find(m => m === "" || MediaRecorder.isTypeSupported(m)) ?? "";
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    audioChunksRef.current = [];

    recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: mimeType || "audio/mp4" });
      transcribeBlob(blob);
    };
    mediaRecorderRef.current = recorder;
    recorder.start(500);
    setIsRecording(true);
  }, [transcribeBlob]);

  // Android/Desktop: Web Speech API
  const startWebSpeech = useCallback(() => {
    setVoiceError("");
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setVoiceError("Браузер не поддерживает голосовой ввод"); return; }

    stoppedByUserRef.current = false;
    let sessionText = "";

    const recognition = new SR();
    recognition.lang = "ru-RU";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) sessionText += e.results[i][0].transcript.trim() + " ";
      }
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "not-allowed") {
        setVoiceError("Нет доступа к микрофону");
        stoppedByUserRef.current = true;
        setIsRecording(false);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
      if (sessionText.trim()) applyVoiceEdit(sessionText.trim());
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [applyVoiceEdit]);

  const startRecording = useCallback(() => {
    if (isIOS) startIosRecording();
    else startWebSpeech();
  }, [isIOS, startIosRecording, startWebSpeech]);

  const stopRecording = useCallback(() => {
    if (isIOS) {
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current = null;
    } else {
      stoppedByUserRef.current = true;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, [isIOS]);

  const isBusy = animating || isTranscribing || isEditingByAI;

  return (
    <div className={`rounded-2xl p-4 space-y-3 ${theme.bg} border ${theme.border}`}>

      <div className="flex items-center gap-2">
        <Icon name="Sparkles" size={14} style={{ color: "#a78bfa" }} />
        <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-violet-300" : "text-violet-600"}`}>
          AI промпты анализа
        </span>
      </div>

      {/* Формула */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "#a78bfa" }}>
          Формула для AI-контекста
        </label>
        <input type="text" value={formula} onChange={e => setFormula(e.target.value)} disabled={readOnly}
          className={`w-full rounded-lg px-3 py-2 text-xs font-mono outline-none transition ${isDark ? "bg-white/[0.06] border border-white/10 text-white/80 focus:border-violet-500/50" : "bg-gray-50 border border-gray-200 text-gray-800 focus:border-violet-400"}`}
          placeholder={DEFAULT_FORMULA} />
        <p className={`text-[10px] mt-1 ${theme.sub}`}>Передаётся в AI как описание формулы расчёта</p>
      </div>

      {/* Табы промптов */}
      <div className="flex gap-1">
        {([
          { key: "math",     label: "1. Математика",  color: "#10b981" },
          { key: "semantic", label: "2. Семантика",   color: "#f59e0b" },
          { key: "combine",  label: "3. Объединение", color: "#8b5cf6" },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActivePromptTab(tab.key)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition"
            style={{
              background: activePromptTab === tab.key ? `${tab.color}20` : isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
              color: activePromptTab === tab.key ? tab.color : isDark ? "rgba(255,255,255,0.4)" : "#9ca3af",
              border: `1px solid ${activePromptTab === tab.key ? `${tab.color}40` : "transparent"}`,
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      <p className={`text-[10px] ${theme.sub}`}>
        {activePromptTab === "math" && "Получает математическую оценку (число). Объясняет что означает итоговый балл по формуле."}
        {activePromptTab === "semantic" && "Получает список позиций сметы. Оценивает объект семантически — риски, комбинации, нестандартные ситуации."}
        {activePromptTab === "combine" && "Получает результаты этапов 1 и 2. Выдаёт итоговую оценку, рекомендуемую скидку и вывод для менеджера в JSON."}
      </p>

      {/* Textarea + кнопка микрофона */}
      <div className="relative">
        {/* Строка над textarea: статус голоса */}
        {!readOnly && (
          <div className="flex items-center justify-end mb-1 min-h-[18px]">
            {voiceError && (
              <span className="text-[10px] text-red-400">{voiceError}</span>
            )}
            {voiceSuccess && !voiceError && (
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <Icon name="CheckCircle2" size={10} /> Промпт обновлён голосом
              </span>
            )}
            {isTranscribing && (
              <span className="text-[10px] text-violet-400 flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 border border-violet-400/40 border-t-violet-400 rounded-full animate-spin" />
                Распознаю речь...
              </span>
            )}
            {isEditingByAI && (
              <span className="text-[10px] text-amber-400 flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 border border-amber-400/40 border-t-amber-400 rounded-full animate-spin" />
                AI редактирует промпт...
              </span>
            )}
          </div>
        )}

        <textarea
          ref={textareaRef}
          disabled={readOnly || isBusy}
          value={complexityPrompts[activePromptTab]}
          onChange={e => setComplexityPrompts({ ...complexityPrompts, [activePromptTab]: e.target.value })}
          className={`w-full rounded-xl px-3 py-2.5 text-xs font-mono outline-none transition resize-y ${
            isDark
              ? "bg-white/[0.04] border border-white/10 text-white/75 focus:border-violet-500/50"
              : "bg-gray-50 border border-gray-200 text-gray-700 focus:border-violet-400"
          }`}
          style={{
            transition: "opacity 0.3s",
            opacity: isBusy ? 0.15 : 1,
            minHeight: "160px",
            overflowY: "hidden",
          }}
        />

        {/* Кнопка микрофона — поверх textarea, снизу справа */}
        {!readOnly && (
          <button
            type="button"
            onClick={() => { if (isBusy) return; if (isRecording) stopRecording(); else startRecording(); }}
            title={isRecording ? "Остановить запись" : "Надиктовать изменение голосом"}
            className="absolute bottom-3 right-3 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200"
            style={{
              background: isRecording
                ? "rgba(239,68,68,0.2)"
                : isBusy
                ? "rgba(255,255,255,0.04)"
                : "rgba(139,92,246,0.15)",
              border: `1px solid ${isRecording ? "rgba(239,68,68,0.4)" : isBusy ? "rgba(255,255,255,0.06)" : "rgba(139,92,246,0.3)"}`,
              color: isRecording ? "#f87171" : isBusy ? "rgba(255,255,255,0.2)" : "#a78bfa",
              cursor: isBusy ? "wait" : "pointer",
            }}
          >
            {isBusy && !isRecording
              ? <span className="w-3.5 h-3.5 border border-current/30 border-t-current rounded-full animate-spin block" />
              : isRecording
              ? <Icon name="Square" size={12} />
              : <Icon name="Mic" size={13} />
            }
          </button>
        )}

        {/* Анимация улучшения (кнопка "Улучшить промпты AI") */}
        {animating && (
          <div className="absolute inset-0 rounded-xl flex flex-col items-center justify-center gap-3"
            style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.4)" }}>
            {animStep === 1 ? (
              <>
                <div className="w-full px-5 space-y-1.5">
                  {["Анализирую структуру промптов...", "Оптимизирую логику расчёта скидки...", "Добавляю правила стабилизации..."].map((line, i) => (
                    <div key={i} className="flex items-center gap-2"
                      style={{ opacity: 0, animation: "fadeInLine 0.4s ease forwards", animationDelay: `${i * 350}ms` }}>
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ background: "#a78bfa" }} />
                      <span className="text-[11px] font-mono" style={{ color: "#c4b5fd" }}>{line}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-4 h-4 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
                  <span className="text-xs font-bold" style={{ color: "#a78bfa" }}>Улучшаю промпты...</span>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(16,185,129,0.2)", border: "2px solid rgba(16,185,129,0.5)" }}>
                  <Icon name="CheckCircle2" size={24} style={{ color: "#10b981" }} />
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-emerald-400">Промпты улучшены!</div>
                  <div className="text-[10px] text-white/40 mt-0.5">Скидка теперь считается стабильнее</div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeInLine {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Подсказка по микрофону */}
      {!readOnly && (
        <p className={`text-[10px] ${theme.sub} flex items-center gap-1`}>
          <Icon name="Mic" size={9} />
          Нажми на микрофон в поле промпта и скажи что изменить — AI сам отредактирует текст
        </p>
      )}

      <div className={`text-[10px] p-2.5 rounded-lg ${isDark ? "bg-white/[0.03]" : "bg-gray-50"}`}
        style={{ border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb"}` }}>
        <span className={`font-semibold ${isDark ? "text-white/60" : "text-gray-600"}`}>Переменные: </span>
        <span className={theme.sub}>
          {activePromptTab === "math" && "{math_score} — итоговый балл, {items_breakdown} — таблица позиций с баллами"}
          {activePromptTab === "semantic" && "{items} — список позиций сметы"}
          {activePromptTab === "combine" && "{math_result} — вывод этапа 1, {semantic_result} — вывод этапа 2, {max_discount} — макс. скидка"}
        </span>
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={onSavePrompts}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition hover:opacity-80"
            style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
            <Icon name={savedPrompts ? "Check" : "Save"} size={12} />
            {savedPrompts ? "Сохранено" : "Сохранить промпты и формулу"}
          </button>
          <button onClick={onImprovePrompts}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition hover:opacity-80"
            style={{
              background: improvedPrompts ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.12)",
              color:      improvedPrompts ? "#10b981" : "#f59e0b",
              border:     `1px solid ${improvedPrompts ? "rgba(16,185,129,0.4)" : "rgba(245,158,11,0.3)"}`,
            }}>
            <Icon name={improvedPrompts ? "CheckCircle2" : "Wand2"} size={12} />
            {improvedPrompts ? "✓ Промпты улучшены" : "Улучшить промпты AI"}
          </button>

          {/* Сброс к дефолту */}
          <button
            onClick={() => setComplexityPrompts({ ...complexityPrompts, [activePromptTab]: DEFAULT_COMPLEXITY_PROMPTS[activePromptTab] })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition hover:opacity-80 ml-auto"
            style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
            <Icon name="RotateCcw" size={12} />
            Сбросить к дефолту
          </button>
        </div>
      )}
    </div>
  );
}
