import { useState, useRef, useEffect } from "react";
import type React from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { Client } from "./crmApi";
import KanbanCard from "./KanbanCard";

const PRESET_COLORS = [
  "#8b5cf6","#a78bfa","#6366f1","#3b82f6","#06b6d4",
  "#10b981","#f59e0b","#f97316","#ef4444","#ec4899",
  "#64748b","#e2e8f0",
];

interface ColDef {
  id: string;
  label: string;
  color: string;
  statuses: readonly string[];
}

interface KanbanColumnProps {
  col: ColDef;
  label: string;
  colClients: Client[];
  width: number;
  isLast: boolean;
  isOver: boolean;
  dragging: Client | null;
  canDelete: boolean;
  onAddCard?: (colId: string) => void;
  onDragStart: (c: Client) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, colId: string) => void;
  onDragLeave: () => void;
  onDrop: (colId: string) => void;
  onOpen: (c: Client) => void;
  onNextStep: (id: number, next: string) => void;
  onStartResize: (e: React.MouseEvent, colId: string) => void;
  resizeBorderColor: string;
  onSaveLabel: (colId: string, val: string) => void;
  onSaveColor: (colId: string, color: string) => void;
  onDelete: (colId: string) => void;
}

export function KanbanColumn({
  col, label, colClients, width, isLast, isOver,
  dragging, canDelete, onAddCard,
  onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
  onOpen, onNextStep, onStartResize, resizeBorderColor,
  onSaveLabel, onSaveColor, onDelete,
}: KanbanColumnProps) {
  const t = useTheme();
  const revenue = colClients.reduce((s, c) => s + (Number(c.contract_sum) || 0), 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelVal, setLabelVal] = useState(label);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Закрываем попап при клике снаружи
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setShowColorPicker(false);
        setEditingLabel(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Синхронизируем label из пропса
  useEffect(() => { setLabelVal(label); }, [label]);

  const commitLabel = () => {
    const v = labelVal.trim();
    if (v && v !== label) onSaveLabel(col.id, v);
    setEditingLabel(false);
  };

  return (
    <div className="flex flex-shrink-0" style={{ width }}>
      <div
        className="flex flex-col rounded-2xl transition-all"
        style={{ width: "100%" }}
        onDragOver={e => onDragOver(e, col.id)}
        onDragLeave={onDragLeave}
        onDrop={() => onDrop(col.id)}>

        {/* Заголовок */}
        <div className="flex items-center justify-between px-3 py-2 rounded-t-2xl group/header"
          style={{ background: col.color + "18", borderBottom: `2px solid ${col.color}` }}>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color }} />
            <span className="text-xs font-bold truncate" style={{ color: t.text }}>{label}</span>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
              style={{ background: col.color + "25", color: col.color }}>{colClients.length}</span>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {revenue > 0 && width > 180 && (
              <span className="text-[10px] font-semibold mr-1" style={{ color: col.color + "bb" }}>
                {revenue.toLocaleString("ru-RU")} ₽
              </span>
            )}

            {/* Кнопка настроек колонки */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => { setMenuOpen(v => !v); setShowColorPicker(false); setEditingLabel(false); }}
                className="p-1 rounded-md opacity-0 group-hover/header:opacity-100 transition"
                style={{ color: t.textMute }}
                onMouseEnter={e => (e.currentTarget.style.background = t.surface2)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <Icon name="Settings2" size={12} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-7 z-50 rounded-xl shadow-2xl overflow-hidden"
                  style={{ background: t.surface, border: `1px solid ${t.border}`, minWidth: 200 }}>

                  {/* Переименовать */}
                  <div className="px-3 py-2" style={{ borderBottom: `1px solid ${t.border2}` }}>
                    <div className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: t.textMute }}>Название</div>
                    <div className="flex items-center gap-1.5">
                      <input
                        value={labelVal}
                        onChange={e => setLabelVal(e.target.value)}
                        onFocus={() => setEditingLabel(true)}
                        onKeyDown={e => { if (e.key === "Enter") commitLabel(); if (e.key === "Escape") { setLabelVal(label); setEditingLabel(false); } }}
                        className="flex-1 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                        style={{ background: t.surface2, border: `1px solid ${editingLabel ? "#7c3aed60" : t.border}`, color: t.text }}
                      />
                      {editingLabel && (
                        <button onClick={commitLabel}
                          className="px-2 py-1 rounded-lg text-xs font-semibold"
                          style={{ background: "#7c3aed", color: "#fff" }}>
                          ОК
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Цвет */}
                  <div className="px-3 py-2" style={{ borderBottom: `1px solid ${t.border2}` }}>
                    <div className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: t.textMute }}>Цвет</div>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_COLORS.map(c => (
                        <button key={c} onClick={() => { onSaveColor(col.id, c); }}
                          className="w-5 h-5 rounded-full transition hover:scale-125"
                          style={{
                            background: c,
                            outline: col.color === c ? `2px solid ${c}` : "none",
                            outlineOffset: 2,
                          }} />
                      ))}
                      <label className="w-5 h-5 rounded-full overflow-hidden cursor-pointer flex-shrink-0 flex items-center justify-center transition hover:scale-125"
                        style={{ border: `2px dashed ${t.border}` }} title="Свой цвет">
                        <input type="color" defaultValue={col.color} className="opacity-0 w-0 h-0"
                          onChange={e => onSaveColor(col.id, e.target.value)} />
                        <Icon name="Plus" size={10} style={{ color: t.textMute }} />
                      </label>
                    </div>
                  </div>

                  {/* Удалить */}
                  <button
                    onClick={() => {
                      if (!window.confirm(`Удалить колонку «${label}»? Клиенты не удалятся.`)) return;
                      setMenuOpen(false);
                      onDelete(col.id);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium transition hover:bg-red-500/10"
                    style={{ color: "#f87171" }}>
                    <Icon name="Trash2" size={12} />
                    Удалить колонку
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Карточки */}
        <div
          className="flex-1 p-2 space-y-2 rounded-b-2xl transition-all"
          style={{
            background: isOver ? col.color + "08" : t.surface2,
            border: isOver ? `2px dashed ${col.color}60` : `2px solid transparent`,
            borderTop: "none",
          }}>
          {colClients.map(c => (
            <div key={c.id}
              onDragStart={() => onDragStart(c)}
              onDragEnd={onDragEnd}>
              <KanbanCard
                client={c}
                colColor={col.color}
                dragging={dragging?.id === c.id}
                onOpen={() => onOpen(c)}
                onNextStep={onNextStep}
              />
            </div>
          ))}

          {colClients.length === 0 && !isOver && (
            <div className="flex flex-col items-center justify-center py-8 gap-2 opacity-40">
              <Icon name="Inbox" size={20} style={{ color: t.textMute }} />
              <span className="text-xs" style={{ color: t.textMute }}>Нет клиентов</span>
            </div>
          )}

          {isOver && (
            <div className="rounded-xl border-2 border-dashed py-6 flex items-center justify-center"
              style={{ borderColor: col.color, background: col.color + "08" }}>
              <span className="text-xs font-semibold" style={{ color: col.color }}>Переместить сюда</span>
            </div>
          )}

          {/* Кнопка добавить карточку */}
          {onAddCard && (
            <button
              onClick={() => onAddCard(col.id)}
              className="w-full flex items-center gap-1.5 px-2 py-2 rounded-xl text-xs font-medium transition opacity-40 hover:opacity-100 mt-1"
              style={{ color: col.color }}>
              <Icon name="Plus" size={13} /> Добавить карточку
            </button>
          )}
        </div>
      </div>

      {/* Ручка resize */}
      {!isLast && (
        <div
          className="flex-shrink-0 flex items-center justify-center group"
          style={{ width: 8, cursor: "col-resize", zIndex: 10 }}
          onMouseDown={e => onStartResize(e, col.id)}>
          <div
            className="rounded-full transition-all group-hover:opacity-100 opacity-0"
            style={{ width: 3, height: 40, background: resizeBorderColor }}
            onMouseEnter={e => (e.currentTarget.style.background = "#7c3aed")}
            onMouseLeave={e => (e.currentTarget.style.background = resizeBorderColor)}
          />
        </div>
      )}
    </div>
  );
}