// ── Shared types, constants and localStorage utils for DrawerInfoTab ──────────

export type BuiltinBlockId =
  | "status" | "tags" | "contacts" | "object" | "dates" | "notes"
  | "pl" | "income" | "costs" | "files" | "cancel";

export type BlockId = BuiltinBlockId | string; // custom_TIMESTAMP

export interface BlockDef { id: BlockId; col: 0 | 1; order: number; wide?: boolean; }

export interface CustomBlockRow { label: string; type: "text" | "file"; value: string; }
export interface CustomBlockData { id: string; title: string; icon: string; color: string; rows: CustomBlockRow[]; wide?: boolean; }

export interface EditRow { label: string; value: string; key: string; }

export const LS_BLOCKS  = "drawer_blocks_order";
export const LS_HIDDEN  = "drawer_blocks_hidden";
export const LS_CUSTOM  = "drawer_custom_blocks";

export const ICON_OPTIONS = [
  "Star","Briefcase","Building","Car","Clock","CreditCard","Globe","Heart",
  "Home","Info","Key","Layers","List","Lock","Mail","Map","Monitor","Music",
  "Package","Palette","PenTool","Phone","Printer","Shield","ShoppingCart","Truck","Users","Zap",
];
export const COLOR_OPTIONS = [
  "#8b5cf6","#06b6d4","#10b981","#f59e0b","#f97316","#ef4444","#ec4899","#3b82f6","#a78bfa",
];

export const DEFAULT_BLOCKS: BlockDef[] = [
  { id: "status",   col: 0, order: 0 },
  { id: "tags",     col: 0, order: 1 },
  { id: "contacts", col: 0, order: 2 },
  { id: "object",   col: 0, order: 3 },
  { id: "dates",    col: 0, order: 4 },
  { id: "notes",    col: 0, order: 5, wide: true },
  { id: "income",   col: 1, order: 0 },
  { id: "costs",    col: 1, order: 1 },
  { id: "files",    col: 1, order: 2 },
  { id: "cancel",   col: 1, order: 3 },
];

// Блоки у которых wide задан жёстко и не меняется пользователем
const FORCED_WIDE: Record<string, boolean> = { notes: true };

export function loadBlocks(): BlockDef[] {
  try {
    const s = JSON.parse(localStorage.getItem(LS_BLOCKS) || "null");
    if (Array.isArray(s) && s.length) {
      const savedIds = new Set(s.map((b: BlockDef) => b.id));
      const missing = DEFAULT_BLOCKS.filter(b => !savedIds.has(b.id));
      // Мержим: добавляем отсутствующие + принудительно применяем FORCED_WIDE
      const merged = s.map((b: BlockDef) =>
        FORCED_WIDE[b.id as string] !== undefined
          ? { ...b, wide: FORCED_WIDE[b.id as string] }
          : b
      );
      return missing.length > 0 ? [...merged, ...missing] : merged;
    }
  } catch { /**/ }
  return DEFAULT_BLOCKS;
}

export function loadHidden(): Set<BlockId> {
  try { return new Set(JSON.parse(localStorage.getItem(LS_HIDDEN) || "[]") as BlockId[]); }
  catch { return new Set(); }
}

export function loadCustomBlocks(): CustomBlockData[] {
  try { return JSON.parse(localStorage.getItem(LS_CUSTOM) || "[]"); }
  catch { return []; }
}

export function saveCustomBlocks(blocks: CustomBlockData[]) {
  localStorage.setItem(LS_CUSTOM, JSON.stringify(blocks));
}