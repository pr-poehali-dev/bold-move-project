// ── Справочники и общие типы для баг-репортов ────────────────────────────────

export const SEVERITY = [
  { id: "critical",  label: "Критично", color: "#ef4444", icon: "AlertOctagon" },
  { id: "important", label: "Важно",    color: "#f59e0b", icon: "AlertTriangle" },
  { id: "normal",    label: "Обычное",  color: "#3b82f6", icon: "Info" },
];

export const REPORT_TYPE = [
  { id: "bug",         label: "Ошибка",     icon: "Bug" },
  { id: "improvement", label: "Доработка",  icon: "Wrench" },
  { id: "idea",        label: "Идея",       icon: "Sparkles" },
];

export const STATUS = [
  { id: "new",         label: "Новый",       color: "#3b82f6", masterOnly: false },
  { id: "in_progress", label: "В работе",    color: "#f59e0b", masterOnly: true },
  { id: "done",        label: "Выполнен",    color: "#10b981", masterOnly: true },
  { id: "rejected",    label: "Не выполнен", color: "#ef4444", masterOnly: true },
];

export const sevById = (id: string) => SEVERITY.find(s => s.id === id) ?? SEVERITY[2];
export const typeById = (id: string) => REPORT_TYPE.find(t => t.id === id) ?? REPORT_TYPE[0];
export const statusById = (id: string) => STATUS.find(s => s.id === id) ?? STATUS[0];

export interface Attachment { url: string; name: string; type: string; }

export interface Report {
  id: number;
  title: string;
  description: string;
  severity: string;
  report_type: string;
  status: string;
  attachments: Attachment[];
  author_name: string;
  created_at: string;
}