import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";

export interface PdfOptions {
  perRoom: boolean;
  includeDrawings: boolean;
}

interface Props {
  onConfirm: (opts: PdfOptions) => void;
  onClose: () => void;
}

export default function PdfOptionsModal({ onConfirm, onClose }: Props) {
  const t = useTheme();
  const [perRoom, setPerRoom] = useState(false);
  const [includeDrawings, setIncludeDrawings] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden bg-gray-900"
        style={{ background: t.card, border: `1px solid ${t.border}` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2">
            <Icon name="Printer" size={16} style={{ color: t.textMute }} />
            <span className="text-sm font-bold" style={{ color: t.text }}>Настройки PDF</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg transition hover:opacity-70" style={{ background: t.surface2 }}>
            <Icon name="X" size={14} style={{ color: t.textMute }} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Вопрос 1: Всё вместе или по комнатно */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: t.textMute }}>Формат сметы</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPerRoom(false)}
                className="flex flex-col items-center gap-2 p-3 rounded-xl transition"
                style={{
                  background: !perRoom ? "rgba(124,58,237,0.15)" : t.surface2,
                  border: `1.5px solid ${!perRoom ? "#7c3aed" : t.border}`,
                }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: !perRoom ? "rgba(124,58,237,0.2)" : t.surface }}>
                  <Icon name="FileText" size={20} style={{ color: !perRoom ? "#a78bfa" : t.textMute }} />
                </div>
                <span className="text-xs font-semibold text-center" style={{ color: !perRoom ? "#a78bfa" : t.text }}>Всё вместе</span>
                <span className="text-[10px] text-center" style={{ color: t.textMute }}>Одна общая смета</span>
              </button>
              <button
                onClick={() => setPerRoom(true)}
                className="flex flex-col items-center gap-2 p-3 rounded-xl transition"
                style={{
                  background: perRoom ? "rgba(124,58,237,0.15)" : t.surface2,
                  border: `1.5px solid ${perRoom ? "#7c3aed" : t.border}`,
                }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: perRoom ? "rgba(124,58,237,0.2)" : t.surface }}>
                  <Icon name="Files" size={20} style={{ color: perRoom ? "#a78bfa" : t.textMute }} />
                </div>
                <span className="text-xs font-semibold text-center" style={{ color: perRoom ? "#a78bfa" : t.text }}>По комнатам</span>
                <span className="text-[10px] text-center" style={{ color: t.textMute }}>Раздел на каждую комнату</span>
              </button>
            </div>
          </div>

          {/* Вопрос 2: Добавить чертежи */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: t.textMute }}>Чертежи в смете</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setIncludeDrawings(false)}
                className="flex flex-col items-center gap-2 p-3 rounded-xl transition"
                style={{
                  background: !includeDrawings ? "rgba(124,58,237,0.15)" : t.surface2,
                  border: `1.5px solid ${!includeDrawings ? "#7c3aed" : t.border}`,
                }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: !includeDrawings ? "rgba(124,58,237,0.2)" : t.surface }}>
                  <Icon name="FileX" size={20} style={{ color: !includeDrawings ? "#a78bfa" : t.textMute }} />
                </div>
                <span className="text-xs font-semibold text-center" style={{ color: !includeDrawings ? "#a78bfa" : t.text }}>Без чертежей</span>
                <span className="text-[10px] text-center" style={{ color: t.textMute }}>Только позиции</span>
              </button>
              <button
                onClick={() => setIncludeDrawings(true)}
                className="flex flex-col items-center gap-2 p-3 rounded-xl transition"
                style={{
                  background: includeDrawings ? "rgba(124,58,237,0.15)" : t.surface2,
                  border: `1.5px solid ${includeDrawings ? "#7c3aed" : t.border}`,
                }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: includeDrawings ? "rgba(124,58,237,0.2)" : t.surface }}>
                  <Icon name="LayoutDashboard" size={20} style={{ color: includeDrawings ? "#a78bfa" : t.textMute }} />
                </div>
                <span className="text-xs font-semibold text-center" style={{ color: includeDrawings ? "#a78bfa" : t.text }}>С чертежами</span>
                <span className="text-[10px] text-center" style={{ color: t.textMute }}>Добавить превью</span>
              </button>
            </div>
          </div>
        </div>

        {/* Кнопка */}
        <div className="px-5 pb-5">
          <button
            onClick={() => onConfirm({ perRoom, includeDrawings })}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg,#6d28d9,#7c3aed)" }}
          >
            <Icon name="Printer" size={15} />
            Создать PDF
          </button>
        </div>
      </div>
    </div>
  );
}