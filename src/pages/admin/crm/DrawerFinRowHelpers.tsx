import { useState } from "react";
import React from "react";
import Icon from "@/components/ui/icon";

export function AddFinRowInline({ block, onAdd, forceOpen, onClose }: {
  block: "income" | "costs";
  onAdd: (label: string, block: "income" | "costs") => void;
  forceOpen?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const color = block === "income" ? "#10b981" : "#ef4444";
  const isOpen = open || forceOpen;

  const commit = () => {
    if (val.trim()) { onAdd(val.trim(), block); setVal(""); }
    setOpen(false);
    onClose?.();
  };
  const cancel = () => { setVal(""); setOpen(false); onClose?.(); };

  if (!isOpen) return (
    <button onClick={() => setOpen(true)}
      className="flex items-center gap-1 mt-1 text-xs transition-opacity opacity-40 hover:opacity-80"
      style={{ color }}>
      <Icon name="Plus" size={11} /> Добавить строку
    </button>
  );
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <input
        autoFocus
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        placeholder="Название строки..."
        className="flex-1 text-xs rounded-lg px-2 py-1 focus:outline-none"
        style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${color}40`, color: "#fff" }}
      />
      <button onClick={commit}
        className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background: `${color}20`, color }}>
        OK
      </button>
      <button onClick={cancel} className="text-xs text-white/30 hover:text-white/60">✕</button>
    </div>
  );
}

export function RowWithToggle({ rowKey, visible, onToggle, children, editMode, editableLabel, onLabelChange, onDelete }: {
  rowKey: string;
  visible: boolean;
  onToggle: (key: string) => void;
  children: React.ReactNode;
  editMode?: boolean;
  editableLabel?: string;
  onLabelChange?: (label: string) => void;
  onDelete?: () => void;
}) {
  const [labelVal, setLabelVal] = useState(editableLabel || "");

  React.useEffect(() => { setLabelVal(editableLabel || ""); }, [editableLabel]);

  if (!visible) return null;

  const showLabelEdit = editMode && editableLabel !== undefined && onLabelChange;
  const handleDelete = onDelete ?? (() => onToggle(rowKey));

  return (
    <div className="flex items-center gap-1">
      {showLabelEdit ? (
        <div className="flex items-center flex-1 min-w-0 py-2" style={{ borderBottom: "1px solid #2a2a2a" }}>
          <input
            value={labelVal}
            onChange={e => setLabelVal(e.target.value)}
            onBlur={() => { if (labelVal.trim() && labelVal !== editableLabel) onLabelChange!(labelVal.trim()); }}
            onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            className="text-xs rounded-lg px-2 py-0.5 focus:outline-none w-36 flex-shrink-0"
            style={{ background: "rgba(124,58,237,0.15)", border: "1px solid #7c3aed40", color: "#fff" }}
          />
          <div className="flex-1 min-w-0 ml-2 [&>div]:border-none [&>div]:py-0 [&>div>span:first-child]:!hidden">{children}</div>
        </div>
      ) : (
        <div className="flex-1 min-w-0">{children}</div>
      )}
      {editMode && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Слайдер видимости — в режиме редактирования */}
          <button
            onClick={() => onToggle(rowKey)}
            title="Показывать на всех карточках"
            className="flex-shrink-0 rounded-full transition-all duration-150"
            style={{
              width: 26, height: 14,
              background: "#10b981",
              position: "relative", display: "inline-flex", alignItems: "center",
            }}>
            <span style={{
              width: 10, height: 10,
              background: "#fff",
              borderRadius: "50%",
              position: "absolute",
              left: 14,
              transition: "left 0.15s",
            }} />
          </button>
          <button
            onClick={() => { if (window.confirm("Точно удалить?")) handleDelete(); }}
            title="Удалить строку"
            className="p-1 rounded-md text-red-400/50 hover:text-red-400 transition-all">
            <Icon name="X" size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

export function HiddenRowToggle({ rowKey, label, onToggle }: {
  rowKey: string;
  label: string;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 opacity-40 hover:opacity-70 transition-opacity"
      style={{ borderBottom: "1px solid #2a2a2a" }}>
      <span className="text-xs w-36" style={{ color: "#a3a3a3" }}>{label}</span>
      <button
        onClick={() => onToggle(rowKey)}
        title="Показывать на всех карточках"
        className="flex-shrink-0 rounded-full transition-all duration-200"
        style={{
          width: 28, height: 16,
          background: "#404040",
          position: "relative", display: "inline-flex", alignItems: "center",
        }}>
        <span style={{
          width: 12, height: 12,
          background: "#fff",
          borderRadius: "50%",
          position: "absolute",
          left: 2,
          transition: "left 0.2s",
        }} />
      </button>
    </div>
  );
}