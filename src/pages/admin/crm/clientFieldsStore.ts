// Хранилище кастомных меток и полей клиента (localStorage, глобально)

export interface CustomTag {
  id: string;
  label: string;
  color: string;
}

export interface CustomClientField {
  id: string;
  label: string;
}

const LS_CUSTOM_TAGS   = "crm_custom_tags";
const LS_CLIENT_FIELDS = "crm_client_fields";
const LS_CLIENT_EXTRA  = "crm_client_extra_"; // + client_id

export const PRESET_TAG_COLORS = [
  "#8b5cf6","#3b82f6","#10b981","#f59e0b","#f97316",
  "#ef4444","#ec4899","#06b6d4","#a78bfa","#84cc16",
];

// ── Кастомные метки ────────────────────────────────────────────────────────

export function loadCustomTags(): CustomTag[] {
  try { return JSON.parse(localStorage.getItem(LS_CUSTOM_TAGS) || "[]"); }
  catch { return []; }
}

export function saveCustomTags(tags: CustomTag[]) {
  localStorage.setItem(LS_CUSTOM_TAGS, JSON.stringify(tags));
}

// ── Кастомные поля (названия, глобально) ──────────────────────────────────

export function loadClientFields(): CustomClientField[] {
  try { return JSON.parse(localStorage.getItem(LS_CLIENT_FIELDS) || "[]"); }
  catch { return []; }
}

export function saveClientFields(fields: CustomClientField[]) {
  localStorage.setItem(LS_CLIENT_FIELDS, JSON.stringify(fields));
}

// ── Значения кастомных полей (per-client) ─────────────────────────────────

export function loadClientExtraValues(clientId: number): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_CLIENT_EXTRA + clientId) || "{}"); }
  catch { return {}; }
}

export function saveClientExtraValues(clientId: number, values: Record<string, string>) {
  localStorage.setItem(LS_CLIENT_EXTRA + clientId, JSON.stringify(values));
}
