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

interface Props {
  state: PlanState;
  onItems: (items: VoiceCatalogItem[]) => void;
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

  // Стены с длинами и уже добавленными товарами
  if (segments.length > 0) {
    lines.push("\nСтены помещения:");
    segments.forEach((seg, i) => {
      const label = String.fromCharCode(65 + i); // A, B, C...
      const lenM  = seg.lengthCm ? (seg.lengthCm / 100).toFixed(2) + " м" : "?";
      const items = (seg.items ?? []).map(it =>
        `${it.name}${it.quantity ? ` ${it.quantity} ${it.unit ?? "м"}` : ""}`
      );
      const itemsStr = items.length > 0 ? ` [добавлено: ${items.join(", ")}]` : "";
      lines.push(`  Стена ${label}: ${lenM}${itemsStr}`);
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
  const sendToAI = useCallback(async (transcript: string): Promise<VoiceCatalogItem[]> => {
    const roomContext = buildRoomContext(stateRef.current);

    // Системный контекст идёт первым сообщением, голос клиента — вторым
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

    // Бот возвращает { answer, items[] } — берём items
    if (data.items && Array.isArray(data.items) && data.items.length > 0) {
      return data.items as VoiceCatalogItem[];
    }

    // Если items нет — пробуем распарсить из answer (запасной вариант)
    return [];
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
        const items = await sendToAI(transcript);
        if (items.length > 0) {
          setStatus(`Добавляю ${items.length} позиций в смету...`);
          onItems(items);
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
