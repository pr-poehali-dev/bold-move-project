/**
 * Голосовое построение чертежа.
 * Пользователь диктует: "354 вправо 422 влево 354 вправо 422" → замкнутый прямоугольник.
 * Первый отрезок A→B всегда идёт горизонтально вправо.
 * Точка A — нижний левый угол (фиксированная стартовая позиция).
 */
import { useState, useRef, useCallback } from "react";
import type { PlanState, Point, Segment } from "./planTypes";
import { genId, buildAutoDiagonals } from "./planTypes";

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

// ── Константы ─────────────────────────────────────────────────────────────────

// Стартовая позиция точки A (нижний левый угол, в px-координатах холста)
const START_X = 200;
const START_Y = 400;
// Длина в px для первого отрезка (масштаб установится позже)
// Используем 1cm = 2px пока не получим первый размер
const SCALE_INIT = 2; // px/cm

// Направления
type Dir = "right" | "up" | "left" | "down";

const DIR_DELTA: Record<Dir, { dx: number; dy: number }> = {
  right: { dx: 1,  dy: 0  },
  down:  { dx: 0,  dy: 1  },  // вниз по экрану = на юг
  left:  { dx: -1, dy: 0  },
  up:    { dx: 0,  dy: -1 },
};

// Поворот текущего направления
function turnRight(dir: Dir): Dir {
  const order: Dir[] = ["right", "down", "left", "up"];
  return order[(order.indexOf(dir) + 1) % 4];
}
function turnLeft(dir: Dir): Dir {
  const order: Dir[] = ["right", "down", "left", "up"];
  return order[(order.indexOf(dir) + 3) % 4];
}

// ── Парсинг текста ─────────────────────────────────────────────────────────────

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
  "тысяча": 1000,
};

function parseNumber(text: string): number | null {
  const clean = text.toLowerCase().trim().replace(/,/g, ".").replace(/\s+/g, " ");
  const direct = parseFloat(clean.replace(/[^\d.]/g, ""));
  if (!isNaN(direct) && direct > 0) return Math.round(direct * 10) / 10;
  const words = clean.split(" ");
  let sum = 0; let found = false;
  for (const w of words) { const n = TEXT_TO_NUM[w]; if (n !== undefined) { sum += n; found = true; } }
  if (found && sum > 0) return Math.round(sum * 10) / 10;
  return null;
}

function parseDirection(text: string): "right" | "left" | "straight" | null {
  const t = text.toLowerCase();
  if (/право|правый|направо|вправо/.test(t)) return "right";
  if (/лево|левый|налево|влево/.test(t))    return "left";
  if (/прямо|прямой|вперёд|вперед/.test(t)) return "straight";
  return null;
}

function parseTurnOrClose(text: string): "right" | "left" | "straight" | "close" | null {
  const t = text.toLowerCase();
  if (/замкн|закрыть|финиш|готово|конец|стоп/.test(t)) return "close";
  return parseDirection(t);
}

// ── Хук ───────────────────────────────────────────────────────────────────────

interface Props {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
}

export default function useVoiceDraw({ state, onChange }: Props) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [status, setStatus] = useState<string>(""); // подсказка пользователю

  const recognitionRef  = useRef<SpeechRecognition | null>(null);
  const stateRef        = useRef(state);
  stateRef.current      = state;

  // Строительное состояние
  const buildRef = useRef<{
    points:    Point[];
    segments:  Segment[];
    currentDir: Dir;
    baseScale: number | null; // px/cm
    pendingLen: number | null; // размер без поворота
  }>({
    points:    [],
    segments:  [],
    currentDir: "right",
    baseScale: null,
    pendingLen: null,
  });

  const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const hasSpeech = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  // Сбросить строительное состояние
  const resetBuild = useCallback(() => {
    buildRef.current = {
      points:    [],
      segments:  [],
      currentDir: "right",
      baseScale: null,
      pendingLen: null,
    };
  }, []);

  // Добавить отрезок в строящийся чертёж
  const addSegment = useCallback((lengthCm: number, dir: Dir) => {
    const b = buildRef.current;
    const scale = b.baseScale ?? SCALE_INIT;
    const lenPx = lengthCm * scale;
    const { dx, dy } = DIR_DELTA[dir];

    // Если точек нет — создаём точку A
    if (b.points.length === 0) {
      const ptA: Point = { id: genId("pt"), x: START_X, y: START_Y };
      b.points.push(ptA);
    }

    const lastPt = b.points[b.points.length - 1];
    const newPt: Point = {
      id: genId("pt"),
      x: Math.round(lastPt.x + dx * lenPx),
      y: Math.round(lastPt.y + dy * lenPx),
    };
    b.points.push(newPt);

    const newSeg: Segment = {
      id: genId("s"),
      fromId: lastPt.id,
      toId:   newPt.id,
      lengthCm,
      showLength: true,
      showDimLine: true,
      arcRadius: 0,
    };
    b.segments.push(newSeg);

    // Публикуем промежуточное состояние
    onChange({
      points:   [...b.points],
      segments: [...b.segments],
      tool:     "move",
      phase:    "draw",
    });

    setStatus(`Отрезок ${b.segments.length}: ${lengthCm} см → ожидаю поворот`);
  }, [onChange]);

  // Замкнуть фигуру
  const closeFigure = useCallback(() => {
    const b = buildRef.current;
    if (b.points.length < 3) return;
    const closing: Segment = {
      id: genId("s"),
      fromId: b.points[b.points.length - 1].id,
      toId:   b.points[0].id,
      lengthCm: null,
      showLength: true,
      showDimLine: true,
      arcRadius: 0,
    };
    b.segments.push(closing);
    const newDiags = buildAutoDiagonals(b.points, [], b.baseScale);
    onChange({
      points:   [...b.points],
      segments: [...b.segments],
      diagonals: newDiags,
      isClosed: true,
      phase:    "lengths",
      tool:     "move",
      activeInputIndex: 0,
      selectedSegmentId: b.segments[0]?.id ?? null,
      sidebarTab: "drawing",
    });
    setStatus("Фигура замкнута!");
    stop();
  }, [onChange]); // eslint-disable-line react-hooks/exhaustive-deps

  // Обработка финального текста от распознавания
  const processFinal = useCallback((text: string) => {
    const b = buildRef.current;

    // Сначала ищем поворот (если есть pendingLen)
    if (b.pendingLen !== null) {
      const turn = parseTurnOrClose(text);
      if (turn === "close") { closeFigure(); return; }
      if (turn !== null) {
        const dir = turn === "right"    ? turnRight(b.currentDir)
                  : turn === "left"     ? turnLeft(b.currentDir)
                  : b.currentDir; // straight
        b.currentDir = dir;
        addSegment(b.pendingLen, dir);
        b.pendingLen = null;
        setStatus(`Жду следующий размер или «замкнуть»`);
        return;
      }
    }

    // Ищем размер
    const num = parseNumber(text);
    if (num !== null) {
      if (b.baseScale === null) {
        // Первый отрезок — сразу идёт вправо, масштаб пока SCALE_INIT
        b.baseScale = SCALE_INIT;
        addSegment(num, "right");
        b.currentDir = "right";
        b.pendingLen = null;
        setStatus(`Первый отрезок ${num} см. Скажите поворот: «вправо», «влево», «прямо» или «замкнуть»`);
      } else {
        // Запоминаем длину — ждём поворот
        b.pendingLen = num;
        setStatus(`${num} см — скажите поворот: «вправо», «влево», «прямо» или «замкнуть»`);
      }
      return;
    }

    // Поворот без pending (на случай если сказали поворот после первого числа)
    const turn = parseTurnOrClose(text);
    if (turn === "close") { closeFigure(); return; }
    if (turn !== null && b.pendingLen !== null) {
      const dir = turn === "right" ? turnRight(b.currentDir) : turn === "left" ? turnLeft(b.currentDir) : b.currentDir;
      b.currentDir = dir;
      addSegment(b.pendingLen, dir);
      b.pendingLen = null;
    }
  }, [addSegment, closeFigure]);

  const stop = useCallback(() => {
    const r = recognitionRef.current;
    recognitionRef.current = null;
    r?.stop();
    setIsListening(false);
    setInterimText("");
  }, []);

  const toggle = useCallback(() => {
    if (isListening) { stop(); return; }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Голосовой ввод не поддерживается. Используйте Chrome."); return; }

    // Сброс чертежа — начинаем заново
    resetBuild();
    onChange({ points: [], segments: [], diagonals: [], isClosed: false, isBuilt: false, baseScale: null, phase: "draw", tool: "draw" });
    setStatus("Скажите длину первого отрезка A→B (например: «354»)");

    const recognition = new SR();
    recognition.lang = "ru-RU";
    recognition.interimResults = true;
    recognition.continuous = !isMobile;
    recognition.maxAlternatives = 3;
    recognitionRef.current = recognition;

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let finalText = "";
      let interimBuf = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          let best = res[0].transcript;
          for (let a = 0; a < res.length; a++) {
            if (parseNumber(res[a].transcript) !== null || parseTurnOrClose(res[a].transcript) !== null) {
              best = res[a].transcript; break;
            }
          }
          finalText += best + " ";
        } else {
          interimBuf += res[0].transcript;
        }
      }
      if (interimBuf) setInterimText(interimBuf);
      if (finalText.trim()) { setInterimText(""); processFinal(finalText.trim()); }
    };

    recognition.onend = () => {
      if (!recognitionRef.current) return;
      if (!isMobile) {
        try { recognitionRef.current.start(); } catch { setIsListening(false); }
      } else {
        try { setTimeout(() => { if (recognitionRef.current) recognitionRef.current.start(); }, 200); }
        catch { setIsListening(false); recognitionRef.current = null; }
      }
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "not-allowed") {
        alert("Доступ к микрофону запрещён.");
        recognitionRef.current = null;
        setIsListening(false);
      }
    };

    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.error("[VoiceDraw] start failed:", err);
    }
  }, [isListening, isMobile, stop, resetBuild, onChange, processFinal]);

  return { isListening, interimText, status, hasSpeech, toggle, stop };
}
