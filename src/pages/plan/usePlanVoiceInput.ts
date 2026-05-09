import { useState, useRef, useCallback } from "react";
import type { Segment } from "./planTypes";

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

// Слова-команды «следующая сторона»
const NEXT_KEYWORDS = [
  "следующая", "следующее", "следующий", "следующую",
  "далее", "дальше", "вперёд", "вперед", "дальнейший",
  "next", "готово",
];

// Текстовые числа → цифры (основные варианты распознавания ru-RU)
const TEXT_TO_NUM: Record<string, number> = {
  "ноль": 0, "один": 1, "одна": 1, "два": 2, "две": 2,
  "три": 3, "четыре": 4, "пять": 5, "шесть": 6, "семь": 7,
  "восемь": 8, "девять": 9, "десять": 10, "одиннадцать": 11,
  "двенадцать": 12, "тринадцать": 13, "четырнадцать": 14,
  "пятнадцать": 15, "шестнадцать": 16, "семнадцать": 17,
  "восемнадцать": 18, "девятнадцать": 19, "двадцать": 20,
  "тридцать": 30, "сорок": 40, "пятьдесят": 50,
  "шестьдесят": 60, "семьдесят": 70, "восемьдесят": 80,
  "девяносто": 90, "сто": 100, "двести": 200, "триста": 300,
  "четыреста": 400, "пятьсот": 500, "шестьсот": 600,
  "семьсот": 700, "восемьсот": 800, "девятьсот": 900,
  "тысяча": 1000, "полтора": 1.5, "половина": 0.5,
};

// Парсим текст → число (см) или null
function parseNumber(text: string): number | null {
  // Убираем лишнее, нормализуем
  const clean = text.toLowerCase().trim()
    .replace(/[,]/g, ".") // запятая → точка
    .replace(/\s+/g, " ");

  // Прямое число (включая дробные: "3.5", "2,5", "10")
  const direct = parseFloat(clean.replace(/[^\d.]/g, ""));
  if (!isNaN(direct) && direct > 0) return Math.round(direct * 10) / 10;

  // Попытка сложить текстовые числа ("два пятьдесят" → не поддерживаем, но базовые — да)
  const words = clean.split(" ");
  let sum = 0;
  let found = false;
  for (const word of words) {
    const n = TEXT_TO_NUM[word];
    if (n !== undefined) { sum += n; found = true; }
  }
  if (found && sum > 0) return Math.round(sum * 10) / 10;

  return null;
}

// Проверяем, есть ли в тексте команда «следующая»
function hasNextCommand(text: string): boolean {
  const lower = text.toLowerCase();
  return NEXT_KEYWORDS.some(kw => lower.includes(kw));
}

interface Props {
  segments: Segment[];
  onUpdateSegment: (id: string, patch: Partial<Segment>) => void;
}

export default function usePlanVoiceInput({ segments, onUpdateSegment }: Props) {
  const [isListening, setIsListening] = useState(false);
  // Индекс текущей активной стороны (0 = A-B и тд)
  const [activeIdx, setActiveIdx] = useState(0);
  // Промежуточный текст для показа пользователю
  const [interimText, setInterimText] = useState("");

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const activeIdxRef = useRef(0);
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  const isIOS = typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent);

  const hasSpeech = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  // Переходим к следующей стороне
  const goNext = useCallback(() => {
    const next = Math.min(activeIdxRef.current + 1, segmentsRef.current.length - 1);
    activeIdxRef.current = next;
    setActiveIdx(next);
    setInterimText("");
  }, []);

  // Остановить распознавание
  const stop = useCallback(() => {
    const r = recognitionRef.current;
    recognitionRef.current = null;
    r?.stop();
    setIsListening(false);
    setInterimText("");
  }, []);

  // Запустить / остановить
  const toggle = useCallback(() => {
    if (isListening) { stop(); return; }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("Голосовой ввод не поддерживается. Используйте Chrome.");
      return;
    }

    // Сброс к первой незаполненной стороне
    const firstEmpty = segmentsRef.current.findIndex(s => !s.lengthCm || s.lengthCm <= 0);
    const startIdx = firstEmpty >= 0 ? firstEmpty : 0;
    activeIdxRef.current = startIdx;
    setActiveIdx(startIdx);
    setInterimText("");

    const recognition = new SR();
    recognition.lang = "ru-RU";
    recognition.interimResults = true;
    recognition.continuous = false; // было: !isIOS (iOS=false, Android=true)
    recognition.maxAlternatives = 3;
    recognitionRef.current = recognition;

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let finalText = "";
      let interimBuf = "";

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          // Собираем из всех альтернатив — берём первую с числом
          let best = result[0].transcript;
          for (let a = 0; a < result.length; a++) {
            if (parseNumber(result[a].transcript) !== null) {
              best = result[a].transcript;
              break;
            }
          }
          finalText += best + " ";
        } else {
          interimBuf += result[0].transcript;
        }
      }

      if (interimBuf) setInterimText(interimBuf);

      if (!finalText.trim()) return;

      const segs = segmentsRef.current;
      const idx = activeIdxRef.current;

      // Проверяем команду «следующая»
      if (hasNextCommand(finalText)) {
        setInterimText("");
        if (idx < segs.length - 1) {
          goNext();
        } else {
          // Все стороны заполнены — останавливаем
          stop();
        }
        return;
      }

      // Пробуем распознать число
      const value = parseNumber(finalText);
      if (value !== null && idx < segs.length) {
        onUpdateSegment(segs[idx].id, { lengthCm: value });
        setInterimText("");

        // Автопереход к следующей если есть ещё стороны
        if (idx < segs.length - 1) {
          // Небольшая пауза перед переходом чтобы пользователь видел введённое
          setTimeout(() => goNext(), 400);
        } else {
          // Все заполнены
          setTimeout(() => stop(), 600);
        }
      } else {
        setInterimText("");
      }
    };

    recognition.onend = () => {
      if (!recognitionRef.current) return;
      if (isIOS) {
        // iOS: не перезапускаем — ждём следующего касания
        setIsListening(false);
        recognitionRef.current = null;
      } else {
        // Android + десктоп: перезапускаем автоматически
        try {
          setTimeout(() => {
            if (recognitionRef.current) recognitionRef.current.start();
          }, 150);
        } catch {
          setIsListening(false);
          recognitionRef.current = null;
        }
      }
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      console.error("[PlanVoice] error:", e.error);
      if (e.error === "not-allowed") {
        alert("Доступ к микрофону запрещён. Разрешите доступ в настройках браузера.");
        recognitionRef.current = null;
        setIsListening(false);
        return;
      }
      // no-speech / aborted — ждём onend, он перезапустит
    };

    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.error("[PlanVoice] start failed:", err);
    }
  }, [isListening, isIOS, goNext, stop, onUpdateSegment]);

  return {
    isListening,
    activeIdx,
    interimText,
    hasSpeech,
    toggle,
    stop,
  };
}