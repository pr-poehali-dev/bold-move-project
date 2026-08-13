import { useEffect, useRef } from "react";
import { crmAiFetch } from "./crmApi";

interface TouchLike {
  id: number;
  channel: string;
  audio_url: string | null;
  text: string | null;
  status: string;
}

/**
 * Автоматически расшифровывает звонки без текста, когда лента касаний открыта.
 * Расшифровка не входит в приём вебхука (см. uis-webhook на бэкенде) — звонок
 * появляется в ленте сразу, а текст подгружается следом, при просмотре.
 *
 * @param touches  текущая лента касаний
 * @param onDone   вызывается после расшифровки очередного звонка (перечитать ленту)
 */
export function useAutoTranscribe(touches: TouchLike[], onDone?: () => void) {
  const inFlight = useRef<Set<number>>(new Set());

  useEffect(() => {
    const pending = touches.filter(
      t => t.channel === "call" && t.audio_url && !t.text && t.status !== "transcribing"
    );
    if (pending.length === 0) return;

    // Расшифровываем по одному за раз, чтобы не заваливать бэкенд параллельными
    // запросами при первом открытии ленты с историей звонков.
    const target = pending.find(t => !inFlight.current.has(t.id));
    if (!target) return;

    inFlight.current.add(target.id);
    (async () => {
      try {
        await crmAiFetch("transcribe-call", {
          method: "POST",
          body: JSON.stringify({ touch_id: target.id }),
        });
        onDone?.();
      } catch { /* тихо: расшифровка не критична для показа звонка */ }
      finally {
        inFlight.current.delete(target.id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touches]);
}