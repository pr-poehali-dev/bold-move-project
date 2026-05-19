import Icon from "@/components/ui/icon";

export type ExportScope = "project" | "room";
export type ExportType =
  | "kp_light"      // КП: лайт — без чертежей и без подписей стен
  | "kp_detail"     // КП: детализация — с чертежами и подписями
  | "kp_materials"  // КП: материалы (только материалы и количество, без цен)
  | "kp_works"      // КП: работы (только монтажные работы и цены монтажа из прайса)
  | "zp_install"    // ЗП монтажники — только чертежи, работы и цены из колонки Монтаж
  | "zp_measure"    // ЗП замерщика — без чертежей, цены из колонки Замер
  | "analytics";    // Аналитика по объекту (себестоимость, ЗП, продажа, прибыль)

export interface ExportConfig {
  scope: ExportScope;
  type: ExportType;
}

interface ExportTypeItem {
  id: ExportType;
  label: string;
  icon: string;
  supportsScope: boolean; // Поддерживает ли переключатель Общий/Покомнатный
}

export const EXPORT_TYPES: ExportTypeItem[] = [
  { id: "kp_light",     label: "КП: Лайт",            icon: "ClipboardCheck",  supportsScope: true  },
  { id: "kp_detail",    label: "КП: Детализация",     icon: "ClipboardList",   supportsScope: true  },
  { id: "kp_materials", label: "КП: Материалы",       icon: "Package",         supportsScope: true  },
  { id: "kp_works",     label: "КП: Работы",          icon: "FileEdit",        supportsScope: true  },
  { id: "zp_install",   label: "ЗП монтажники",       icon: "Wrench",          supportsScope: false },
  { id: "zp_measure",   label: "ЗП замерщика",        icon: "Ruler",           supportsScope: false },
  { id: "analytics",    label: "Аналитика по объекту", icon: "TrendingUp",     supportsScope: false },
];

// ─── Inline-панель (для тулбара — раскрывается в строку) ─────────────────────
interface InlineProps {
  selected: ExportConfig;
  onChange: (cfg: ExportConfig) => void;
  /** показывать ли переключатель проект/комната (когда есть несколько комнат) */
  showScope?: boolean;
}

export function PlanExportInline({ selected, onChange, showScope = true }: InlineProps) {
  return (
    <div className="flex items-center gap-1">
      {/* Переключатель Общий / Покомнатный */}
      {showScope && (
        <div className="flex items-center shrink-0 rounded-lg overflow-hidden"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}>
          {(["project", "room"] as ExportScope[]).map(s => (
            <button
              key={s}
              onClick={() => onChange({ ...selected, scope: s })}
              className="h-8 px-2.5 text-[10px] font-bold transition"
              style={{
                background: selected.scope === s ? "rgba(124,58,237,0.35)" : "transparent",
                color: selected.scope === s ? "#c4b5fd" : "rgba(255,255,255,0.4)",
                borderRight: s === "project" ? "1px solid rgba(255,255,255,0.08)" : undefined,
              }}
            >
              {s === "project" ? "Общий" : "Покомнатный"}
            </button>
          ))}
        </div>
      )}

      {/* 7 типов смет — иконки */}
      {EXPORT_TYPES.map(t => (
        <button
          key={t.id}
          onClick={() => onChange({ ...selected, type: t.id })}
          title={t.label}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition shrink-0"
          style={{
            background: selected.type === t.id ? "rgba(124,58,237,0.35)" : "rgba(255,255,255,0.05)",
            border: selected.type === t.id
              ? "1px solid rgba(124,58,237,0.5)"
              : "1px solid rgba(255,255,255,0.08)",
            color: selected.type === t.id ? "#c4b5fd" : "rgba(255,255,255,0.45)",
          }}
        >
          <Icon name={t.icon} size={14} fallback="FileText" />
        </button>
      ))}
    </div>
  );
}

// ─── Модалка (для экранов проектов и комнат) ──────────────────────────────────
interface ModalProps {
  open: boolean;
  onClose: () => void;
  onExport: (cfg: ExportConfig) => void;
  showScope?: boolean;
}

export function PlanExportModal({ open, onClose, onExport, showScope = true }: ModalProps) {
  const [scope, setScope] = React.useState<ExportScope>("project");
  const [type,  setType]  = React.useState<ExportType>("kp_light");

  if (!open) return null;

  const currentType = EXPORT_TYPES.find(t => t.id === type);
  const scopeVisible = showScope && currentType?.supportsScope !== false;

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
        {/* Шапка */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(124,58,237,0.2)" }}>
              <Icon name="FileDown" size={15} style={{ color: "#a78bfa" }} />
            </div>
            <span className="text-white font-bold text-[15px]">Выгрузка сметы</span>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.4)" }}>
            <Icon name="X" size={15} />
          </button>
        </div>

        {/* Переключатель — только для типов поддерживающих покомнатный режим */}
        {scopeVisible && (
          <div>
            <p className="text-[11px] uppercase tracking-wider font-bold mb-2"
              style={{ color: "rgba(255,255,255,0.3)" }}>Смета по</p>
            <div className="flex rounded-xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {(["project", "room"] as ExportScope[]).map(s => (
                <button key={s} onClick={() => setScope(s)}
                  className="flex-1 py-2 text-[12px] font-bold transition"
                  style={{
                    background: scope === s ? "rgba(124,58,237,0.3)" : "transparent",
                    color: scope === s ? "#c4b5fd" : "rgba(255,255,255,0.4)",
                  }}>
                  {s === "project" ? "Общий" : "Покомнатный"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Типы смет */}
        <div>
          <p className="text-[11px] uppercase tracking-wider font-bold mb-2"
            style={{ color: "rgba(255,255,255,0.3)" }}>Тип сметы</p>
          <div className="grid grid-cols-7 gap-1.5">
            {EXPORT_TYPES.map(t => (
              <button key={t.id} onClick={() => setType(t.id)}
                title={t.label}
                className="flex flex-col items-center justify-center rounded-xl py-2.5 gap-1.5 transition"
                style={{
                  background: type === t.id ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.04)",
                  border: type === t.id
                    ? "1px solid rgba(124,58,237,0.5)"
                    : "1px solid rgba(255,255,255,0.07)",
                  color: type === t.id ? "#c4b5fd" : "rgba(255,255,255,0.4)",
                }}>
                <Icon name={t.icon} size={18} fallback="FileText" />
              </button>
            ))}
          </div>
          {/* Подпись выбранного типа */}
          <p className="text-[11px] text-center mt-2" style={{ color: "rgba(255,255,255,0.45)" }}>
            {EXPORT_TYPES.find(t => t.id === type)?.label}
          </p>
        </div>

        {/* Кнопка */}
        <button
          onClick={() => { onExport({ scope, type }); onClose(); }}
          className="w-full py-2.5 rounded-xl text-sm font-bold transition hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff" }}
        >
          Выгрузить PDF
        </button>
      </div>
    </div>
  );
}

import React from "react";
export default PlanExportModal;