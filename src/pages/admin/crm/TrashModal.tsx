import { useState, useEffect } from "react";
import { useTheme } from "./themeContext";
import { crmFetch, Client } from "./crmApi";
import Icon from "@/components/ui/icon";

interface Props {
  onClose: () => void;
  onRestored: () => void;
}

export function TrashModal({ onClose, onRestored }: Props) {
  const t = useTheme();
  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    crmFetch("clients", {}, { status: "deleted" })
      .then((d: unknown) => { if (Array.isArray(d)) setItems(d as Client[]); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const restore = async (id: number) => {
    setRestoringId(id);
    try {
      await crmFetch("clients", { method: "PUT" }, { id: String(id), action: "restore" });
      setItems(prev => prev.filter(c => c.id !== id));
      onRestored();
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-5 shadow-2xl max-h-[80vh] flex flex-col"
        style={{ background: t.surface, border: `1px solid ${t.border}` }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Icon name="Trash2" size={17} style={{ color: t.textMute }} />
            <h3 className="text-base font-bold" style={{ color: "#fff" }}>Корзина</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition">
            <Icon name="X" size={16} style={{ color: t.textMute }} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-1.5">
          {loading && (
            <div className="text-center py-8 text-sm" style={{ color: t.textMute }}>Загрузка...</div>
          )}
          {!loading && items.length === 0 && (
            <div className="text-center py-8 text-sm" style={{ color: t.textMute }}>Корзина пуста</div>
          )}
          {items.map(c => (
            <div key={c.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl"
              style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate" style={{ color: "#fff" }}>
                  №{c.id} {c.client_name || "Без имени"}
                </div>
                <div className="text-xs truncate" style={{ color: t.textMute }}>
                  {c.phone || "—"}
                </div>
              </div>
              <button onClick={() => restore(c.id)} disabled={restoringId === c.id}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition hover:opacity-90 flex-shrink-0 disabled:opacity-50"
                style={{ background: "#10b98118", color: "#10b981", border: "1px solid #10b98140" }}>
                <Icon name={restoringId === c.id ? "Loader2" : "RotateCcw"} size={12} className={restoringId === c.id ? "animate-spin" : ""} />
                Восстановить
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}