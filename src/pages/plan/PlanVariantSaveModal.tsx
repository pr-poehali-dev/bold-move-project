import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

interface Props {
  open: boolean;
  defaultName?: string;
  saving?: boolean;
  onSave: (name: string) => void;
  onClose: () => void;
}

export default function PlanVariantSaveModal({ open, defaultName = "", saving, onSave, onClose }: Props) {
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    if (open) setName(defaultName || `Вариант ${new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}`);
  }, [open, defaultName]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 space-y-4"
        style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(124,58,237,0.2)" }}>
              <Icon name="Save" size={15} style={{ color: "#a78bfa" }} />
            </div>
            <span className="text-white font-bold text-[15px]">Сохранить вариант</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg transition hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.4)" }}>
            <Icon name="X" size={15} />
          </button>
        </div>

        <div>
          <label className="text-[11px] text-white/40 uppercase tracking-wider font-semibold mb-1.5 block">
            Название варианта
          </label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && name.trim() && onSave(name.trim())}
            placeholder="Вариант 1"
            className="w-full rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => name.trim() && onSave(name.trim())}
            disabled={!name.trim() || saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff" }}
          >
            {saving ? "Сохраняем..." : "Сохранить"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm transition"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
