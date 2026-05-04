import { Client } from "./crmApi";
import { BlockId, CustomFinRow } from "./drawerTypes";

export const LS_FIN_LABELS = "crm_fin_row_labels";

export function loadFinLabels(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_FIN_LABELS) || "{}"); } catch { return {}; }
}

export function saveFinLabel(key: string, label: string) {
  const curr = loadFinLabels();
  curr[key] = label;
  localStorage.setItem(LS_FIN_LABELS, JSON.stringify(curr));
}

export interface FinBlockProps {
  data: Client;
  editingBlock: BlockId | null;
  hiddenBlocks: Set<BlockId>;
  rowVisibility: Record<string, boolean>;
  customFinRows: CustomFinRow[];
  toggleHidden: (id: BlockId) => void;
  setEditingBlock: (id: BlockId | null) => void;
  saveWithLog: (patch: Partial<Client>, logText: string, icon?: string, color?: string) => void;
  logAction: (icon: string, color: string, text: string) => void;
  toggleRowVisibility: (key: string) => void;
  addCustomFinRow: (label: string, block: "income" | "costs") => void;
  deleteCustomFinRow: (key: string) => void;
  updateCustomFinRow: (key: string, label: string) => void;
  onReload?: () => void;
}
