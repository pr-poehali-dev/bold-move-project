import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

interface Props {
  baseIncome: number;
  onConfirm: (pct: number, exactAmt: number) => void;
  onClose: () => void;
}

export function MarkupInputModal({ baseIncome, onConfirm, onClose }: Props) {
  const [pct, setPct] = useState("");
  const [amt, setAmt] = useState("");
  const [lastEdited, setLastEdited] = useState<"pct" | "amt">("pct");
  const [focus, setFocus] = useState<"pct" | "amt">("pct");

  const syncFromPct = (v: string) => {
    setPct(v);
    setLastEdited("pct");
    const n = parseFloat(v);
    if (!isNaN(n) && n > 0 && baseIncome > 0) {
      setAmt(String(Math.round(baseIncome * n / 100)));
    } else {
      setAmt("");
    }
  };

  const syncFromAmt = (v: string) => {
    setAmt(v);
    setLastEdited("amt");
    const n = parseFloat(v);
    if (!isNaN(n) && n > 0 && baseIncome > 0) {
      setPct(String(Math.round(n / baseIncome * 1000) / 10));
    } else {
      setPct("");
    }
  };

  const pctVal = parseFloat(pct) || 0;
  const amtVal = parseFloat(amt) || 0;
  const resultIncome = baseIncome + amtVal;
  const valid = pctVal > 0 && amtVal > 0;

  const handleConfirm = () => {
    if (!valid) return;
    const exactAmt = lastEdited === "amt" ? amtVal : Math.round(baseIncome * pctVal / 100);
    const exactPct = lastEdited === "pct" ? pctVal : Math.round(amtVal / baseIncome * 1000) / 10;
    onConfirm(exactPct, exactAmt);
  };

  // Следим за visualViewport чтобы модалка не перекрывалась клавиатурой
  const [viewportTop, setViewportTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setViewportTop(vv.offsetTop);
        setViewportHeight(vv.height);
      });
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const modalTop = viewportTop + Math.max(16, (viewportHeight - 320) / 4);

  return (
    <div
      className="fixed inset-0 z-[500]"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="absolute left-4 right-4 max-w-xs mx-auto rounded-2xl overflow-hidden"
        style={{
          top: modalTop,
          background: "#0e0e1c",
          border: "1px solid rgba(16,185,129,0.25)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <Icon name="TrendingUp" size={14} style={{ color: "#10b981" }} />
            <span className="text-sm font-black text-white">Задать наценку</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition" style={{ color: "rgba(255,255,255,0.4)" }}>
            <Icon name="X" size={14} />
          </button>
        </div>

        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {/* % */}
            <div
              className={`rounded-xl p-3 transition cursor-text ${focus === "pct" ? "ring-2 ring-emerald-500/50" : ""}`}
              style={{ background: focus === "pct" ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(16,185,129,0.25)" }}
              onClick={() => setFocus("pct")}
            >
              <div className="text-[9px] uppercase tracking-wider font-bold mb-2" style={{ color: "#10b981" }}>Наценка %</div>
              <div className="flex items-center gap-1">
                <input
                  type="number" inputMode="decimal" min={0.1} step={0.5}
                  value={pct}
                  onChange={e => syncFromPct(e.target.value)}
                  onFocus={() => setFocus("pct")}
                  autoFocus
                  placeholder="0"
                  className="flex-1 w-full bg-transparent text-xl font-black focus:outline-none"
                  style={{ color: "#10b981" }}
                />
                <span className="text-sm font-bold" style={{ color: "rgba(16,185,129,0.5)" }}>%</span>
              </div>
            </div>

            {/* Сумма */}
            <div
              className={`rounded-xl p-3 transition cursor-text ${focus === "amt" ? "ring-2 ring-emerald-500/50" : ""}`}
              style={{ background: focus === "amt" ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(16,185,129,0.25)" }}
              onClick={() => setFocus("amt")}
            >
              <div className="text-[9px] uppercase tracking-wider font-bold mb-2" style={{ color: "#10b981" }}>Сумма ₽</div>
              <div className="flex items-center gap-1">
                <input
                  type="number" inputMode="numeric" min={1} step={100}
                  value={amt}
                  onChange={e => syncFromAmt(e.target.value)}
                  onFocus={() => setFocus("amt")}
                  placeholder="0"
                  className="flex-1 w-full bg-transparent text-xl font-black focus:outline-none"
                  style={{ color: "#10b981" }}
                />
                <span className="text-sm font-bold" style={{ color: "rgba(16,185,129,0.5)" }}>₽</span>
              </div>
            </div>
          </div>

          {valid && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="text-[11px] text-white/40">Итого с наценкой</span>
              <span className="text-[13px] font-black text-white">{resultIncome.toLocaleString("ru-RU")} ₽</span>
            </div>
          )}

          <button
            onClick={handleConfirm}
            disabled={!valid}
            className="w-full py-3 rounded-xl text-[13px] font-black transition disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]"
            style={{ background: valid ? "#10b981" : "rgba(16,185,129,0.15)", color: valid ? "#000" : "#10b981" }}
          >
            Применить наценку
          </button>
        </div>
      </div>
    </div>
  );
}
