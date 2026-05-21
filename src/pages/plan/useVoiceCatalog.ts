/**
 * useVoiceCatalog — голосовое наполнение сметы в построителе.
 *
 * Логика:
 * 1. Записываем голос через MediaRecorder
 * 2. Транскрибируем через deepgram-transcribe (тот же эндпоинт что в боте)
 * 3. Формируем системный контекст из чертежа (площадь, периметр, углы, уже добавленные товары)
 * 4. Отправляем в ai-chat (тот же эндпоинт что в боте, бота НЕ трогаем)
 * 5. Получаем items[] → возвращаем наружу для добавления в смету
 *
 * Данные с построителя ПРИОРИТЕТНЕЕ слов клиента — передаются как первое системное сообщение.
 */

import { useRef, useState, useCallback } from "react";
import func2url from "@/../backend/func2url.json";
import type { PlanState, SegmentPriceItem } from "./planTypes";
import { calcScale, polygonArea, polygonPerimeter } from "./planTypes";

const TRANSCRIBE_URL = (func2url as Record<string, string>)["deepgram-transcribe"];
const WHISPER_URL    = (func2url as Record<string, string>)["whisper-transcribe"];
const AI_CHAT_URL    = (func2url as Record<string, string>)["ai-chat"];

export interface VoiceCatalogItem {
  name: string;
  qty: number;
  unit: string;
  price?: number;
}

// Определяем ориентацию сегмента по координатам точек
function segmentOrientation(ax: number, ay: number, bx: number, by: number): "top" | "bottom" | "left" | "right" | "diagonal" {
  const dx = Math.abs(bx - ax);
  const dy = Math.abs(by - ay);
  if (dx > dy * 2) {
    // горизонтальный — определяем верх/низ по Y (в SVG Y растёт вниз)
    return ay < by ? "top" : ay > by ? "bottom" : (ax + bx) / 2 < 0 ? "top" : "top";
  } else if (dy > dx * 2) {
    // вертикальный — определяем лево/право по X
    return ax < bx ? "left" : "right";
  }
  return "diagonal";
}

// Специальный sentinel: явная команда "на все стены"
export const ALL_SEGS_SENTINEL = "__ALL__";

// Находим ID сегментов по текстовым подсказкам в транскрипте.
// Возвращает:
//   [ALL_SEGS_SENTINEL]  — явная команда "на все стены"
//   string[]             — конкретные ID сегментов
//   null                 — неизвестно (нужно уточнить у пользователя)
export function findTargetSegIds(transcript: string, state: PlanState): string[] | null {
  const t = transcript.toLowerCase();
  const { points, segments } = state;

  // Явная команда "на все стены" — ТОЛЬКО при чётком упоминании
  if (/на все стены|на каждую стену|по всем стенам|по периметру|везде/.test(t)) {
    return [ALL_SEGS_SENTINEL];
  }

  // Буквенные метки A-Z (напр. "стена A-B", "отрезок BC", "сторона AB")
  const labelMatch = t.match(/(?:стен[ауе]?|отрезк[еуа]?|сторон[еуа]?)\s+([a-zа-яё]{1,2}[-–—]?[a-zа-яё]{0,2})/i)
    ?? t.match(/([a-zA-Z]{1,2})[-–—]([a-zA-Z]{1,2})/);
  if (labelMatch) {
    const raw = labelMatch[1]?.replace(/[-–—]/g, "") ?? "";
    const matched: string[] = [];
    segments.forEach((seg, i) => {
      const fromLetter = String.fromCharCode(65 + i).toLowerCase();
      const toLetter   = String.fromCharCode(65 + ((i + 1) % segments.length)).toLowerCase();
      const segLabel   = `${fromLetter}${toLetter}`;
      if (segLabel.includes(raw.toLowerCase()) || raw.toLowerCase().includes(fromLetter)) {
        matched.push(seg.id);
      }
    });
    if (matched.length > 0) return matched;
  }

  // Длинная / самая длинная стена
  if (/длинн|самая длин|наибольш/.test(t)) {
    const sorted = [...segments]
      .filter(s => s.lengthCm)
      .sort((a, b) => (b.lengthCm ?? 0) - (a.lengthCm ?? 0));
    if (sorted.length > 0) return [sorted[0].id];
  }

  // Короткая / самая короткая стена
  if (/коротк|самая коротк|наименьш/.test(t)) {
    const sorted = [...segments]
      .filter(s => s.lengthCm)
      .sort((a, b) => (a.lengthCm ?? 0) - (b.lengthCm ?? 0));
    if (sorted.length > 0) return [sorted[0].id];
  }

  // "на две стены" / "на три стены" — берём N самых длинных
  const nMatch = t.match(/на\s+(дв[еухумя]+|тр[иёехём]+|четыр[её]+|пять)\s+стен/);
  if (nMatch) {
    const nMap: Record<string, number> = {
      две: 2, двух: 2, двум: 2, двумя: 2,
      три: 3, трёх: 3, трех: 3, трём: 3, трем: 3,
      четыре: 4, четырёх: 4, четырех: 4,
      пять: 5,
    };
    const n = nMap[nMatch[1]] ?? 2;
    const sorted = [...segments]
      .filter(s => s.lengthCm)
      .sort((a, b) => (b.lengthCm ?? 0) - (a.lengthCm ?? 0))
      .slice(0, n);
    if (sorted.length > 0) return sorted.map(s => s.id);
  }

  // Ориентация: верх/низ/лево/право
  if (points.length < 2) return null;
  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y));
  const maxY = Math.max(...points.map(p => p.y));
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  const wantTop    = /верхн|сверху|наверху/.test(t);
  const wantBottom = /нижн|снизу|внизу/.test(t);
  const wantLeft   = /лев[оуыйаяе]|слева/.test(t);
  const wantRight  = /прав[оуыйаяе]|справа/.test(t);

  if (!wantTop && !wantBottom && !wantLeft && !wantRight) return null;

  const w = maxX - minX || 1;
  const h = maxY - minY || 1;

  const result: string[] = [];
  segments.forEach(seg => {
    const a = points.find(p => p.id === seg.fromId);
    const b = points.find(p => p.id === seg.toId);
    if (!a || !b) return;
    const segMidX = (a.x + b.x) / 2;
    const segMidY = (a.y + b.y) / 2;
    const relX = (segMidX - midX) / (w / 2);
    const relY = (segMidY - midY) / (h / 2);
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    const isHorizontal = dx > dy;
    const isVertical   = dy > dx;
    if (wantTop    && isHorizontal && relY < -0.3) result.push(seg.id);
    if (wantBottom && isHorizontal && relY >  0.3) result.push(seg.id);
    if (wantLeft   && isVertical   && relX < -0.3) result.push(seg.id);
    if (wantRight  && isVertical   && relX >  0.3) result.push(seg.id);
  });

  if (result.length === 0) {
    segments.forEach(seg => {
      const a = points.find(p => p.id === seg.fromId);
      const b = points.find(p => p.id === seg.toId);
      if (!a || !b) return;
      const segMidX = (a.x + b.x) / 2;
      const segMidY = (a.y + b.y) / 2;
      if (wantTop    && segMidY < midY - h * 0.2) result.push(seg.id);
      if (wantBottom && segMidY > midY + h * 0.2) result.push(seg.id);
      if (wantLeft   && segMidX < midX - w * 0.2) result.push(seg.id);
      if (wantRight  && segMidX > midX + w * 0.2) result.push(seg.id);
    });
  }

  return result.length > 0 ? [...new Set(result)] : null;
}

// Ключевые слова товаров для поиска в тексте транскрипта
const ITEM_KEYWORDS: { pattern: RegExp; keywords: string[] }[] = [
  { pattern: /парящ/,      keywords: ["парящ"] },
  { pattern: /теневой|тенев|klassika|классик/i, keywords: ["теневой", "тенев", "классик"] },
  { pattern: /flexy|флекси|световой|световые/i, keywords: ["flexy", "флекс", "световой"] },
  { pattern: /стеновой|стандартный профиль|пвх профиль/i, keywords: ["стеновой", "стандарт", "профиль"] },
  { pattern: /ниш|карниз/i,  keywords: ["ниш", "карниз"] },
];

// Ищем сегменты для конкретного товара — ищем ключевое слово товара в тексте,
// затем берём ориентацию ТОЛЬКО из ближайшего контекста (±50 символов).
// НЕТ fallback на весь текст — иначе все направления из одной фразы
// "на левую теневой, на правую парящий, сверху ниша" попадут в каждый товар.
export function findSegIdsForItem(itemName: string, itemCategory: string, transcript: string, state: PlanState): string[] | null {
  const t    = transcript.toLowerCase();
  const name = itemName.toLowerCase();
  const cat  = itemCategory.toLowerCase();

  // Сначала ищем явную фразу "на <направление> <товар>" или "<товар> на <направление>"
  // Паттерн: до 40 символов между направлением и ключевым словом товара
  const directionPatterns = [
    { re: /на левую|слева/,   extract: (pos: number) => t.slice(Math.max(0, pos - 5), pos + 60)  },
    { re: /на правую|справа/, extract: (pos: number) => t.slice(Math.max(0, pos - 5), pos + 60)  },
    { re: /сверху|верхн/,     extract: (pos: number) => t.slice(Math.max(0, pos - 5), pos + 60)  },
    { re: /снизу|нижн/,       extract: (pos: number) => t.slice(Math.max(0, pos - 5), pos + 60)  },
  ];

  // Находим ключевые слова для этого товара
  const entry = ITEM_KEYWORDS.find(e => e.pattern.test(name) || e.pattern.test(cat));

  let searchPos = -1;
  if (entry) {
    for (const kw of entry.keywords) {
      const p = t.indexOf(kw);
      if (p !== -1 && (searchPos === -1 || p < searchPos)) searchPos = p;
    }
  }

  if (searchPos === -1) {
    // Пробуем найти часть названия товара в тексте (первые 5+ символов слова)
    const nameWords = name.split(/\s+/).filter(w => w.length >= 5);
    for (const w of nameWords) {
      const p = t.indexOf(w.slice(0, 5));
      if (p !== -1 && (searchPos === -1 || p < searchPos)) searchPos = p;
    }
  }

  if (searchPos === -1) return null; // товар не упоминается — нет контекста

  // Берём УЗКОЕ окно ±50 символов вокруг упоминания товара
  // Это исключает соседние товары с другими направлениями
  const win = t.slice(Math.max(0, searchPos - 50), Math.min(t.length, searchPos + 50));
  const result = findTargetSegIds(win, state);

  // Если в узком окне не нашли — ищем в направлении НАЗАД (до предыдущей запятой)
  if (!result || result.length === 0) {
    const before = t.slice(0, searchPos);
    const lastComma = before.lastIndexOf(",");
    const segment = before.slice(lastComma + 1); // от последней запятой до товара
    return findTargetSegIds(segment + " " + win, state);
  }

  return result;
}

interface Props {
  state: PlanState;
  onItems: (items: VoiceCatalogItem[], transcript: string) => void;
}

// Строим читаемый контекст помещения из состояния построителя
function buildRoomContext(state: PlanState): string {
  const { points, segments, room, floorItems = [] } = state;

  const scale   = calcScale(points, segments);
  const areaPx  = polygonArea(points);
  const perimPx = polygonPerimeter(points);
  const areaCm2 = scale ? areaPx / (scale * scale) : null;
  const areaM2  = areaCm2 ? Math.round(areaCm2 / 10000 * 100) / 100 : null;

  // Точный периметр из lengthCm (приоритет) или расчётный
  const allSet = segments.length > 0 && segments.every(s => s.lengthCm !== null && s.lengthCm > 0);
  const exactPerimM = allSet
    ? Math.round(segments.reduce((s, seg) => s + (seg.lengthCm ?? 0), 0) / 100 * 100) / 100
    : null;
  const perimM = exactPerimM ?? (scale ? Math.round((perimPx / scale) / 100 * 100) / 100 : null);

  const corners = points.length;

  const lines: string[] = [];

  lines.push("=== ДАННЫЕ ПОМЕЩЕНИЯ (ИСТИНА, ПРИОРИТЕТ НАД СЛОВАМИ КЛИЕНТА) ===");

  if (areaM2)  lines.push(`Площадь потолка: ${areaM2} м²`);
  if (perimM)  lines.push(`Периметр: ${perimM} м`);
  if (corners) lines.push(`Количество углов: ${corners}`);

  if (room.floorToCeilCm)  lines.push(`Высота потолка: ${room.floorToCeilCm} см`);
  if (room.concreteDipMm)  lines.push(`Провис перекрытия: ${room.concreteDipMm} мм`);

  // Стены с длинами, ориентацией и уже добавленными товарами
  if (segments.length > 0) {
    const minX = points.length ? Math.min(...points.map(p => p.x)) : 0;
    const maxX = points.length ? Math.max(...points.map(p => p.x)) : 0;
    const minY = points.length ? Math.min(...points.map(p => p.y)) : 0;
    const maxY = points.length ? Math.max(...points.map(p => p.y)) : 0;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    lines.push("\nСтены помещения (буква = метка, ориентация = как видит зритель на экран):");
    segments.forEach((seg, i) => {
      const fromLetter = String.fromCharCode(65 + i);
      const toLetter   = String.fromCharCode(65 + ((i + 1) % segments.length));
      const label      = `${fromLetter}-${toLetter}`;
      const lenM       = seg.lengthCm ? (seg.lengthCm / 100).toFixed(2) + " м" : "?";
      const a = points.find(p => p.id === seg.fromId);
      const b = points.find(p => p.id === seg.toId);
      let orient = "";
      if (a && b) {
        const segMidX = (a.x + b.x) / 2;
        const segMidY = (a.y + b.y) / 2;
        const o = segmentOrientation(a.x, a.y, b.x, b.y);
        if (o === "top" || o === "bottom") {
          orient = segMidY < midY ? " [верхняя]" : " [нижняя]";
        } else if (o === "left" || o === "right") {
          orient = segMidX < midX ? " [левая]" : " [правая]";
        }
      }
      const items = (seg.items ?? []).map(it =>
        `${it.name}${it.quantity ? ` ${it.quantity} ${it.unit ?? "м"}` : ""}`
      );
      const itemsStr = items.length > 0 ? ` [добавлено: ${items.join(", ")}]` : "";
      lines.push(`  Стена ${label}${orient}: ${lenM}${itemsStr}`);
    });
  }

  // Товары на полотне
  if (floorItems.length > 0) {
    lines.push("\nТовары на полотне:");
    floorItems.forEach(fi => {
      lines.push(`  ${fi.name}: ${fi.quantity} ${fi.unit ?? "шт"}`);
    });
  }

  lines.push("\n=== ЗАДАЧА ===");
  lines.push("На основе голосового запроса клиента и данных помещения выше — подбери товары для сметы.");
  lines.push("Верни JSON с массивом items. Каждый item: { name, qty, unit, price }.");
  lines.push("Используй реальные названия из прайса натяжных потолков (профили, полотна, освещение, крепёж).");
  lines.push("Объём/количество считай на основе точных данных помещения, не придумывай размеры.");

  return lines.join("\n");
}

export default function useVoiceCatalog({ state, onItems }: Props) {
  const [isRecording,    setIsRecording]    = useState(false);
  const [isProcessing,   setIsProcessing]   = useState(false);
  const [status,         setStatus]         = useState("");
  const [recTime,        setRecTime]        = useState(0);
  const [volume,         setVolume]         = useState(0);

  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const audioChunksRef    = useRef<Blob[]>([]);
  const streamRef         = useRef<MediaStream | null>(null);
  const timerRef          = useRef<ReturnType<typeof setInterval>>();
  const animFrameRef      = useRef<number>();
  const analyserRef       = useRef<AnalyserNode | null>(null);
  const stateRef          = useRef(state);
  stateRef.current = state; // всегда актуальный state без пересоздания

  // ── Транскрибация blob → текст ──────────────────────────────────────────────
  const transcribeBlob = useCallback(async (blob: Blob): Promise<string> => {
    if (blob.size === 0) throw new Error("Пустая запись");

    const buf   = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);

    // Сначала Deepgram (быстро), при ошибке — Whisper (резерв)
    let data: { text?: string; error?: string } = {};
    try {
      const res = await fetch(TRANSCRIBE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: b64, mimeType: blob.type || "audio/mp4" }),
      });
      data = await res.json();
    } catch { /* продолжаем с Whisper */ }

    if (!data.text && WHISPER_URL) {
      const res = await fetch(WHISPER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: b64, mimeType: blob.type || "audio/mp4" }),
      });
      data = await res.json();
    }

    if (!data.text) throw new Error(data.error ?? "Не удалось распознать речь");
    return data.text;
  }, []);

  // ── Отправка в ai-chat с контекстом чертежа ─────────────────────────────────
  const sendToAI = useCallback(async (transcript: string): Promise<{ items: VoiceCatalogItem[]; transcript: string }> => {
    const roomContext = buildRoomContext(stateRef.current);

    const messages = [
      { role: "user", text: roomContext },
      { role: "user", text: transcript },
    ];

    const res  = await fetch(AI_CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, fast: false }),
    });
    const data = await res.json();

    if (data.items && Array.isArray(data.items) && data.items.length > 0) {
      return { items: data.items as VoiceCatalogItem[], transcript };
    }
    return { items: [], transcript };
  }, []);

  // ── Визуализация громкости ───────────────────────────────────────────────────
  const trackVolume = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(buf);
      const avg = buf.reduce((s, v) => s + v, 0) / buf.length;
      setVolume(Math.min(1, avg / 128));
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  // ── Старт записи ────────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setStatus("");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setStatus("Нет доступа к микрофону");
      return;
    }
    streamRef.current = stream;

    // Анализатор громкости
    try {
      const ctx      = new AudioContext();
      const source   = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      trackVolume();
    } catch { /* визуализация необязательна */ }

    const formats  = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg", ""];
    const mimeType = formats.find(m => m === "" || MediaRecorder.isTypeSupported(m)) ?? "";
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    audioChunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };

    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      streamRef.current     = null;
      analyserRef.current   = null;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setVolume(0);

      const blob = new Blob(audioChunksRef.current, { type: mimeType || "audio/mp4" });
      setIsProcessing(true);
      setStatus("Распознаю речь...");
      try {
        const transcript = await transcribeBlob(blob);
        setStatus(`"${transcript}" — запрашиваю бота...`);
        const { items, transcript: fullTranscript } = await sendToAI(transcript);
        if (items.length > 0) {
          setStatus(`Добавляю ${items.length} позиций в смету...`);
          onItems(items, fullTranscript);
          setStatus("");
        } else {
          setStatus("Бот не нашёл подходящих товаров");
          setTimeout(() => setStatus(""), 3000);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Ошибка";
        setStatus(msg);
        setTimeout(() => setStatus(""), 3000);
      } finally {
        setIsProcessing(false);
      }
    };

    mediaRecorderRef.current = recorder;
    recorder.start(500);
    setIsRecording(true);
    setRecTime(0);
    timerRef.current = setInterval(() => setRecTime(t => t + 1), 1000);
  }, [transcribeBlob, sendToAI, onItems, trackVolume]);

  // ── Стоп записи ─────────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setRecTime(0);
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) stopRecording();
    else startRecording();
  }, [isRecording, startRecording, stopRecording]);

  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return {
    isRecording,
    isProcessing,
    status,
    recTime,
    fmtTime,
    volume,
    toggleRecording,
    stopRecording,
  };
}