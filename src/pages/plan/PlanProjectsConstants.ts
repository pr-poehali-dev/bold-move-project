export const STATUSES = [
  { id: "all",       label: "Все" },
  { id: "draft",     label: "Черновик" },
  { id: "estimate",  label: "Предрасчёт ознакомлен" },
  { id: "contract",  label: "Договор заключён" },
  { id: "scheduled", label: "Монтаж запланирован" },
  { id: "installed", label: "Монтаж завершён" },
  { id: "done",      label: "Завершён" },
];

export const STATUS_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  draft:     { bg: "rgba(148,163,184,0.15)",  text: "#94a3b8", glow: "rgba(148,163,184,0.3)" },
  estimate:  { bg: "rgba(251,191,36,0.18)",   text: "#fbbf24", glow: "rgba(251,191,36,0.4)" },
  contract:  { bg: "rgba(59,130,246,0.18)",   text: "#60a5fa", glow: "rgba(59,130,246,0.4)" },
  scheduled: { bg: "rgba(249,115,22,0.18)",   text: "#fb923c", glow: "rgba(249,115,22,0.4)" },
  installed: { bg: "rgba(34,197,94,0.18)",    text: "#4ade80", glow: "rgba(34,197,94,0.4)" },
  done:      { bg: "rgba(99,102,241,0.18)",   text: "#818cf8", glow: "rgba(99,102,241,0.4)" },
};

export interface FormData {
  name: string;
  client_name: string;
  address: string;
  phone: string;
  status: string;
}

export const EMPTY_FORM: FormData = { name: "", client_name: "", address: "", phone: "", status: "draft" };
