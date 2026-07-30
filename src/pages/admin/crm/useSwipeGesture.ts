import { useState, useRef, useEffect, RefObject } from "react";
import { Client } from "./crmApi";
import { SNAP_WIDTH, THRESHOLD, vibe } from "./ordersClientRowShared";

interface Params {
  elRef: RefObject<HTMLDivElement>;
  client: Client;
  onSwipeBuilder?: (client: Client) => void;
  onSwipeAgent?: (client: Client) => void;
}

// Общая логика горизонтального свайпа карточки/строки заявки (мобайл):
// влево — открыть в Построителе, вправо — передать в Агент.
export function useSwipeGesture({ elRef, client, onSwipeBuilder, onSwipeAgent }: Params) {
  const [offset, setOffset]       = useState(0);
  const [dragging, setDragging]   = useState(false);
  const [swipeHint, setSwipeHint] = useState<"builder" | "agent" | null>(null);

  const sx        = useRef(0);
  const sy        = useRef(0);
  const axis      = useRef<"h" | "v" | null>(null);
  const alive     = useRef(false);
  const vibed     = useRef(false);
  const offsetRef = useRef(0);

  const setOffsetSync    = useRef((v: number)  => { offsetRef.current = v; setOffset(v); });
  const setDraggingSync  = useRef((v: boolean) => setDragging(v));
  const setSwipeHintSync = useRef((v: "builder" | "agent" | null) => setSwipeHint(v));
  setOffsetSync.current    = (v) => { offsetRef.current = v; setOffset(v); };
  setDraggingSync.current  = (v) => setDragging(v);
  setSwipeHintSync.current = (v) => setSwipeHint(v);

  const cb = useRef({ onSwipeBuilder, onSwipeAgent, c: client });
  cb.current = { onSwipeBuilder, onSwipeAgent, c: client };

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      sx.current    = e.touches[0].clientX;
      sy.current    = e.touches[0].clientY;
      axis.current  = null;
      alive.current = true;
      vibed.current = false;
      setDraggingSync.current(false);
      setSwipeHintSync.current(null);
    };

    const onMove = (e: TouchEvent) => {
      if (!alive.current) return;
      const dx = e.touches[0].clientX - sx.current;
      const dy = e.touches[0].clientY - sy.current;

      if (!axis.current) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        axis.current = Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
      }
      if (axis.current === "v") return;

      e.preventDefault();
      setDraggingSync.current(true);

      const clamped = Math.max(-SNAP_WIDTH, Math.min(SNAP_WIDTH, dx));
      setOffsetSync.current(clamped);

      if (clamped >= THRESHOLD) setSwipeHintSync.current("agent");
      else if (clamped <= -THRESHOLD) setSwipeHintSync.current("builder");
      else setSwipeHintSync.current(null);

      if (!vibed.current && Math.abs(dx) >= THRESHOLD) {
        vibe(25);
        vibed.current = true;
      }
    };

    const onEnd = () => {
      if (!alive.current) return;
      alive.current = false;
      setDraggingSync.current(false);
      setSwipeHintSync.current(null);

      if (axis.current !== "h") return;

      const cur = offsetRef.current;

      if (cur >= THRESHOLD) {
        vibe(40);
        setOffsetSync.current(0);
        cb.current.onSwipeAgent?.(cb.current.c);
      } else if (cur <= -THRESHOLD) {
        vibe([30, 60, 30]);
        setOffsetSync.current(0);
        cb.current.onSwipeBuilder?.(cb.current.c);
      } else {
        setOffsetSync.current(0);
      }
    };

    el.addEventListener("touchstart",  onStart, { passive: true });
    el.addEventListener("touchmove",   onMove,  { passive: false });
    el.addEventListener("touchend",    onEnd,   { passive: true });
    el.addEventListener("touchcancel", onEnd,   { passive: true });

    return () => {
      el.removeEventListener("touchstart",  onStart);
      el.removeEventListener("touchmove",   onMove);
      el.removeEventListener("touchend",    onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { offset, dragging, swipeHint, cb };
}
