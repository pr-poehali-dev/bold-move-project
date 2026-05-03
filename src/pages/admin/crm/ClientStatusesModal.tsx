import { useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { ClientStatus } from "./crmApi";

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#a78bfa",
  "#10b981", "#06b6d4", "#3b82f6",
  "#f59e0b", "#f97316", "#ef4444",
  "#ec4899", "#64748b", "#84cc16",
];

interface Props {
  statuses: ClientStatus[];
  onClose: () => void;
  onCreate: (name: string, color: string) => Promise<void>;
  onUpdate: (id: number, patch: Partial<ClientStatus>) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
}

export function ClientStatusesModal({ statuses, onClose, onCreate, onUpdate, onRemove }: Props) {
  const t = useTheme();
  const [newName,   setNewName]   = useState("");
  const [newColor,  setNewColor]  = useState("#6366f1");
  const [adding,    setAdding]    = useState(false);
  const [editId,    setEditId]    = useState<number | null>(null);
  const [editName,  setEditName]  = useState("");
  const [editColor, setEditColor] = useState("");
  const [busy,      setBusy]      = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const handleCreate = async () => {
    if (!newName.trim() || busy) return;
    setBusy(true);
    await onCreate(newName.trim(), newColor);
    setNewName(""); setAdding(false);
    setBusy(false);
  };

  const handleUpdate = async () => {
    if (!editId || !editName.trim() || busy) return;
    setBusy(true);
    await onUpdate(editId, { name: editName.trim(), color: editColor });
    setEditId(null);
    setBusy(false);
  };

  const handleRemove = async (id: number) => {
    setBusy(true);
    await onRemove(id);
    setConfirmId(null);
    setBusy(false);
  };

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl flex flex-col"
        style={{ background: t.surface, border: `1px solid ${t.border}`, maxHeight: "85dvh" }}
        onClick={e => e.stopPropagation()}>

        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#6366f120" }}>
              <Icon name="Tags" size={14} style={{ color: "#6366f1" }} />
            </div>
            <span className="text-sm font-bold" style={{ color: t.text }}>Статусы клиентов</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition" style={{ color: t.textMute }}>
            <Icon name="X" size={15} />
          </button>
        </div>

        {/* Список */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {statuses.map(s => (
            <div key={s.id}>
              {editId === s.id ? (
                <div className="rounded-xl p-3 space-y-2" style={{ background: t.surface2, border: `1px solid ${s.color}50` }}>
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleUpdate(); if (e.key === "Escape") setEditId(null); }}
                    className="w-full rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${t.border}`, color: t.text }}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_COLORS.map(c => (
                      <button key={c} onClick={() => setEditColor(c)}
                        className="w-6 h-6 rounded-full border-2 transition"
                        style={{ background: c, borderColor: editColor === c ? "#fff" : "transparent" }} />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleUpdate} disabled={busy}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold"
                      style={{ background: editColor, color: "#fff", opacity: busy ? 0.7 : 1 }}>
                      Сохранить
                    </button>
                    <button onClick={() => setEditId(null)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: "rgba(255,255,255,0.07)", color: t.textMute }}>
                      Отмена
                    </button>
                  </div>
                </div>
              ) : confirmId === s.id ? (
                <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: "#ef444412", border: "1px solid #ef444430" }}>
                  <span className="text-xs flex-1" style={{ color: "#fca5a5" }}>
                    Удалить «{s.name}»? Статус снимется у всех клиентов.
                  </span>
                  <button onClick={() => handleRemove(s.id)} disabled={busy}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-500 text-white">
                    Удалить
                  </button>
                  <button onClick={() => setConfirmId(null)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                    style={{ background: "rgba(255,255,255,0.07)", color: t.textMute }}>
                    Отмена
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-3 py-2 rounded-xl group transition hover:bg-white/5">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="flex-1 text-sm font-medium" style={{ color: t.text }}>{s.name}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => { setEditId(s.id); setEditName(s.name); setEditColor(s.color); }}
                      className="p-1.5 rounded-lg hover:bg-white/10 transition" style={{ color: t.textMute }}>
                      <Icon name="Pencil" size={12} />
                    </button>
                    <button onClick={() => setConfirmId(s.id)}
                      className="p-1.5 rounded-lg hover:bg-white/10 transition" style={{ color: "#ef4444" }}>
                      <Icon name="Trash2" size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Добавить */}
          {adding ? (
            <div className="rounded-xl p-3 space-y-2" style={{ background: t.surface2, border: `1px solid ${newColor}50` }}>
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }}
                className="w-full rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${t.border}`, color: t.text }}
                placeholder="Название статуса..."
              />
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map(c => (
                  <button key={c} onClick={() => setNewColor(c)}
                    className="w-6 h-6 rounded-full border-2 transition"
                    style={{ background: c, borderColor: newColor === c ? "#fff" : "transparent" }} />
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreate} disabled={busy || !newName.trim()}
                  className="flex-1 py-1.5 rounded-lg text-xs font-bold"
                  style={{ background: newColor, color: "#fff", opacity: busy || !newName.trim() ? 0.5 : 1 }}>
                  Добавить
                </button>
                <button onClick={() => { setAdding(false); setNewName(""); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: "rgba(255,255,255,0.07)", color: t.textMute }}>
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-semibold transition hover:bg-white/5"
              style={{ color: "#6366f1" }}>
              <Icon name="Plus" size={14} />
              Добавить статус
            </button>
          )}
        </div>

        {/* Футер */}
        <div className="px-5 py-4" style={{ borderTop: `1px solid ${t.border}` }}>
          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-bold transition"
            style={{ background: "#6366f1", color: "#fff" }}>
            Готово
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
