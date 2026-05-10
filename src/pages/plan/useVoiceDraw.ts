/**
 * Голосовое построение чертежа через MediaRecorder + Groq Whisper.
 * Пользователь держит кнопку → говорит всю фразу → отпускает → Whisper расшифровывает.
 * Пример: "350 вправо 250 вправо 350 вправо 250 замкнуть"
 * Точка A — нижний левый угол, первый отрезок идёт вверх.
 */
import { useState, useRef, useCallback } from "react";
import type { PlanState, Point, Segment } from "./planTypes";
import { genId, buildAutoDiagonals } from "./planTypes";
import func2url from "@/../backend/func2url.json";

const TRANSCRIBE_URL = (func2url as Record<string, string>)["voice-transcribe"];

// ── Константы ─────────────────────────────────────────────────────────────────

const START_X = 200;
const START_Y = 700;
const SCALE_INIT = 2; // px/cm

// Направления
type Dir = "right" | "up" | "left" | "down";

const DIR_DELTA: Record<Dir, { dx: number; dy: number }> = {
  right: { dx: 1,  dy: 0  },
  down:  { dx: 0,  dy: 1  },
  left:  { dx: -1, dy: 0  },
  up:    { dx: 0,  dy: -1 },
};

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

// Парсим всю фразу целиком: "350 вправо 250 вправо 350 вправо 250 замкнуть"
// Возвращает список команд [{len, turn}]
interface Cmd { len: number; turn: "right" | "left" | "straight" | "close" }

// Пробуем распознать шаблон фигуры по ключевому слову.
// Все шаблоны: обход против часовой на экране (Y↓), точка A = левый нижний, первый шаг вправо.
// turn "right"/"left" — относительно текущего направления движения.
// Последняя команда всегда close (замыкает фигуру к точке A).
function tryParseShape(text: string): Cmd[] | null {
  const t = text.toLowerCase().trim();

  // Собираем числа из текста по порядку
  const nums: number[] = [];
  for (const token of t.split(/\s+/)) {
    const n = parseNumber(token);
    if (n !== null) nums.push(n);
  }

  // ── Квадрат: "квадрат 250" ────────────────────────────────────────────────
  // 4 точки (A B C D), 3 явных отрезка + closeFigure замыкает D→A
  //   D──────C
  //   |      |
  //   A──────B
  if (/квадрат/.test(t) && nums.length >= 1) {
    const s = nums[0];
    return [
      { len: s, turn: "straight" }, // A→B вправо
      { len: s, turn: "left"     }, // B→C вверх
      { len: s, turn: "left"     }, // C→D влево
      { len: 0, turn: "close"    }, // замыкаем D→A геометрически
    ];
  }

  // ── Прямоугольник: "прямоугольник 400 на 300" или "400 на 300" ────────────
  // 4 точки, 3 явных отрезка + closeFigure
  if ((/прямоугольник|прямоугол/.test(t) || /\bна\b/.test(t)) && nums.length >= 2) {
    const w = nums[0], h = nums[1];
    return [
      { len: w, turn: "straight" }, // A→B →
      { len: h, turn: "left"     }, // B→C ↑
      { len: w, turn: "left"     }, // C→D ←
      { len: 0, turn: "close"    }, // замыкаем D→A геометрически
    ];
  }

  // ── Г-образная: "г-образная 400 300 150 100" ─────────────────────────────
  // 6 точек, 5 явных отрезков + closeFigure
  //   F──────────E
  //   |          |
  //   |       C──D
  //   |       |
  //   A───────B
  if (/г.обр|г-обр|г обр|г-образн|г образн/.test(t) && nums.length >= 4) {
    const [W, H, w, h] = nums;
    return [
      { len: W - w, turn: "straight" }, // A→B →
      { len: h,     turn: "left"     }, // B→C ↑
      { len: w,     turn: "right"    }, // C→D →
      { len: H - h, turn: "left"     }, // D→E ↑
      { len: W,     turn: "left"     }, // E→F ←
      { len: 0,     turn: "close"    }, // замыкаем F→A геометрически
    ];
  }

  // ── П-образная: "п-образная 500 400 200 150" ─────────────────────────────
  // 8 точек, 7 явных отрезков + closeFigure
  //   H──────────────────G
  //   |                  |
  //   |   D──────────C   |
  //   |   |          |   |
  //   A───B          E───F
  if (/п.обр|п-обр|п обр|п-образн|п образн/.test(t) && nums.length >= 4) {
    const [W, H, nW, nH] = nums;
    const side = Math.round((W - nW) / 2);
    return [
      { len: side, turn: "straight" }, // A→B →
      { len: nH,   turn: "left"     }, // B→C ↑
      { len: nW,   turn: "left"     }, // C→D ←
      { len: nH,   turn: "left"     }, // D→E ↓
      { len: side, turn: "left"     }, // E→F →
      { len: H,    turn: "left"     }, // F→G ↑
      { len: W,    turn: "left"     }, // G→H ←
      { len: 0,    turn: "close"    }, // замыкаем H→A геометрически
    ];
  }

  return null;
}

function parseFullPhrase(text: string): Cmd[] {
  // Сначала проверяем шаблоны фигур
  const shape = tryParseShape(text);
  if (shape) return shape;

  const tokens = text.toLowerCase().trim().split(/\s+/);
  const cmds: Cmd[] = [];
  let pendingLen: number | null = null;

  for (const token of tokens) {
    const num = parseNumber(token);
    if (num !== null) {
      if (pendingLen !== null) {
        // Число за числом — предыдущее без поворота, идём прямо
        cmds.push({ len: pendingLen, turn: "straight" });
      }
      pendingLen = num;
      continue;
    }

    const turn = parseTurnOrClose(token);
    if (turn !== null) {
      if (pendingLen !== null) {
        cmds.push({ len: pendingLen, turn });
        pendingLen = null;
        if (turn === "close") break;
      } else if (turn === "close") {
        cmds.push({ len: 0, turn: "close" });
        break;
      }
    }
  }

  // Если осталась длина без поворота в конце — игнорируем:
  // авто-замыкание само достроит последний отрезок по геометрии.
  // Это также отфильтровывает лишние числа которые Deepgram добавляет в конце.

  return cmds;
}

// ── Хук ───────────────────────────────────────────────────────────────────────

interface Props {
  state: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
}

export default function useVoiceDraw({ onChange }: Props) {
  const [isListening, setIsListening]   = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus]             = useState<string>("");
  const [interimText, setInterimText]   = useState<string>("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const analyserRef      = useRef<AnalyserNode | null>(null);
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const rafRef           = useRef<number>(0);
  const [volume, setVolume] = useState(0); // 0..1

  const buildRef = useRef<{
    points:     Point[];
    segments:   Segment[];
    currentDir: Dir;
    baseScale:  number | null;
  }>({
    points:     [],
    segments:   [],
    currentDir: "right",
    baseScale:  null,
  });

  const hasSpeech = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  const resetBuild = useCallback(() => {
    buildRef.current = { points: [], segments: [], currentDir: "right", baseScale: null };
  }, []);

  const addSegment = useCallback((lengthCm: number, dir: Dir) => {
    const b = buildRef.current;
    const scale = b.baseScale ?? SCALE_INIT;
    const lenPx = lengthCm * scale;
    const { dx, dy } = DIR_DELTA[dir];

    if (b.points.length === 0) {
      b.points.push({ id: genId("pt"), x: START_X, y: START_Y });
    }

    const lastPt = b.points[b.points.length - 1];
    const newPt: Point = {
      id: genId("pt"),
      x: Math.round(lastPt.x + dx * lenPx),
      y: Math.round(lastPt.y + dy * lenPx),
    };
    b.points.push(newPt);

    b.segments.push({
      id: genId("s"),
      fromId: lastPt.id,
      toId: newPt.id,
      lengthCm,
      showLength: true,
      showDimLine: true,
      arcRadius: 0,
    });

    onChange({
      points:   [...b.points],
      segments: [...b.segments],
      tool:     "move",
      phase:    "draw",
    });
  }, [onChange]);

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
      points:    [...b.points],
      segments:  [...b.segments],
      diagonals: newDiags,
      isClosed:  true,
      phase:     "lengths",
      tool:      "move",
      activeInputIndex:  0,
      selectedSegmentId: null,
      sidebarTab: "drawing",
    });
    setStatus("Фигура замкнута!");
  }, [onChange]);

  // Обрабатываем распознанный текст
  const processText = useCallback((text: string) => {
    console.log(`[VoiceDraw] распознано: "${text}"`);
    setInterimText(text);

    const b = buildRef.current;
    if (b.baseScale === null) b.baseScale = SCALE_INIT;

    const cmds = parseFullPhrase(text);
    console.log(`[VoiceDraw] команды:`, cmds);

    for (const cmd of cmds) {
      if (cmd.turn === "close") {
        if (cmd.len > 0) {
          const dir = b.currentDir;
          addSegment(cmd.len, dir);
        }
        closeFigure();
        return;
      }

      if (cmd.len > 0) {
        const dir = cmd.turn === "right"   ? turnRight(b.currentDir)
                  : cmd.turn === "left"    ? turnLeft(b.currentDir)
                  : b.currentDir;
        b.currentDir = dir;
        addSegment(cmd.len, dir);
      }
    }

    setStatus(`Добавлено отрезков: ${b.segments.length}. Скажите продолжение или «замкнуть».`);
  }, [addSegment, closeFigure]);

  // Остановить запись и отправить на сервер
  const stopAndTranscribe = useCallback(async () => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state === "inactive") return;

    // Останавливаем анализатор громкости
    cancelAnimationFrame(rafRef.current);
    analyserRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setVolume(0);

    setIsListening(false);
    setStatus("Распознаю...");

    // Запрашиваем последний чанк явно (важно на Android)
    if (mr.state === "recording") {
      try { mr.requestData(); } catch { /* игнорируем */ }
    }

    await new Promise<void>(resolve => {
      mr.onstop = () => resolve();
      // Небольшая задержка чтобы ondataavailable успел сработать
      setTimeout(() => mr.stop(), 150);
    });

    mediaRecorderRef.current = null;

    // Ещё небольшая пауза чтобы последний ondataavailable точно отработал
    await new Promise(r => setTimeout(r, 100));

    const chunks = chunksRef.current;
    if (chunks.length === 0) { setStatus("Ничего не записано — попробуйте ещё раз"); return; }

    // Берём реальный mimeType из первого чанка (браузер мог скорректировать)
    const mimeType = (chunks[0].type && chunks[0].type !== "") ? chunks[0].type.split(";")[0] : "audio/webm";
    const blob = new Blob(chunks, { type: mimeType });
    chunksRef.current = [];

    setIsProcessing(true);
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      // btoa со спредом падает на Android при большом аудио — конвертируем чанками
      let binary = "";
      const CHUNK = 8192;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      }
      const base64 = btoa(binary);

      const res = await fetch(TRANSCRIBE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64, mimeType }),
      });

      const data = await res.json();
      if (data.text) {
        processText(data.text);
      } else if (data.error) {
        console.error("[VoiceDraw] server error:", data.error);
        setStatus(`Ошибка: ${data.error}`);
      } else {
        setStatus("Не удалось распознать речь — говорите чётче");
      }
    } catch (e) {
      console.error("[VoiceDraw] transcribe error:", e);
      setStatus("Ошибка соединения — проверьте интернет");
    } finally {
      setIsProcessing(false);
      // Авто-замыкание: если набрали ≥ 3 точек и фигура ещё не замкнута — замыкаем
      const b = buildRef.current;
      if (b.points.length >= 3 && b.segments.length >= 2) {
        const lastSeg = b.segments[b.segments.length - 1];
        const alreadyClosed = lastSeg?.toId === b.points[0]?.id;
        if (!alreadyClosed) {
          closeFigure();
        }
      }
    }
  }, [processText, closeFigure]);

  // Начать запись
  const startRecording = useCallback(async () => {
    if (isListening || isProcessing) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Выбираем поддерживаемый формат (Android Chrome часто поддерживает только audio/webm или audio/ogg)
      const MIME_CANDIDATES = [
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
        "audio/webm",
        "audio/ogg",
        "audio/mp4",
        "",
      ];
      const mimeType = MIME_CANDIDATES.find(m => !m || MediaRecorder.isTypeSupported(m)) ?? "";

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      // ── Анализатор громкости ──────────────────────────────────────────────
      try {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
        analyserRef.current = analyser;

        const buf = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i];
          const avg = sum / buf.length / 255;
          setVolume(avg);
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch { /* AudioContext может быть недоступен */ }

      mr.start(100); // чанки каждые 100мс
      setIsListening(true);
      setInterimText("");
      setStatus("Говорите — нажмите стоп когда закончите.");
    } catch {
      alert("Доступ к микрофону запрещён. Разрешите доступ в настройках браузера.");
    }
  }, [isListening, isProcessing]);

  // Toggle: старт / стоп
  const toggle = useCallback(() => {
    if (isListening) {
      stopAndTranscribe();
    } else {
      // Сброс чертежа при первом старте
      if (buildRef.current.segments.length === 0) {
        resetBuild();
        onChange({ points: [], segments: [], diagonals: [], isClosed: false, isBuilt: false, baseScale: null, phase: "draw", tool: "draw" });
        setStatus("");
      }
      startRecording();
    }
  }, [isListening, stopAndTranscribe, startRecording, resetBuild, onChange]);

  const stop = useCallback(() => {
    if (isListening) stopAndTranscribe();
  }, [isListening, stopAndTranscribe]);

  return { isListening, isProcessing, interimText, status, hasSpeech, toggle, stop, volume };
}