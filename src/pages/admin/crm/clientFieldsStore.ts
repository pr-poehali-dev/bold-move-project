// Хранилище кастомных меток и полей клиента (localStorage, глобально)

export interface CustomTag {
  id: string;
  label: string;
  color: string;
}

export interface CustomClientField {
  id: string;
  label: string;
  clientKey?: string;  // для встроенных полей — ключ поля Client
  builtin?: boolean;
  hidden?: boolean;    // скрыто пользователем
}

const LS_CUSTOM_TAGS    = "crm_custom_tags";
const LS_HIDDEN_TAGS    = "crm_hidden_builtin_tags";   // скрытые встроенные метки
const LS_CLIENT_FIELDS  = "crm_client_fields";         // полный список полей (встроенные + кастомные)
const LS_CLIENT_EXTRA   = "crm_client_extra_";         // значения кастомных полей per-client

export const PRESET_TAG_COLORS = [
  "#8b5cf6","#3b82f6","#10b981","#f59e0b","#f97316",
  "#ef4444","#ec4899","#06b6d4","#a78bfa","#84cc16",
];

// ── Встроенные поля (дефолтный порядок) ────────────────────────────────────
export const BUILTIN_FIELDS: CustomClientField[] = [
  { id: "builtin_name",        label: "Имя клиента",                       clientKey: "client_name",       builtin: true },
  { id: "builtin_phone",       label: "Телефон",                           clientKey: "phone",             builtin: true },
  { id: "builtin_responsible", label: "Ответственный (прораб / дизайнер)", clientKey: "responsible_phone", builtin: true },
  { id: "builtin_notes",       label: "Заметка о клиенте",                 clientKey: "notes",             builtin: true },
];

// ── Список полей (встроенные + кастомные, порядок и скрытые) ───────────────

export function loadClientFields(): CustomClientField[] {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_CLIENT_FIELDS) || "null");
    if (Array.isArray(saved) && saved.length > 0) {
      // Мержим: добавляем новые встроенные если их нет
      const savedIds = new Set(saved.map((f: CustomClientField) => f.id));
      const missing = BUILTIN_FIELDS.filter(f => !savedIds.has(f.id));
      return [...saved, ...missing];
    }
  } catch { /**/ }
  return [...BUILTIN_FIELDS];
}

export function saveClientFields(fields: CustomClientField[]) {
  localStorage.setItem(LS_CLIENT_FIELDS, JSON.stringify(fields));
}

// ── Скрытые встроенные метки ────────────────────────────────────────────────

export function loadHiddenBuiltinTags(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(LS_HIDDEN_TAGS) || "[]")); }
  catch { return new Set(); }
}

export function saveHiddenBuiltinTags(hidden: Set<string>) {
  localStorage.setItem(LS_HIDDEN_TAGS, JSON.stringify([...hidden]));
}

// ── Кастомные метки ─────────────────────────────────────────────────────────

export function loadCustomTags(): CustomTag[] {
  try { return JSON.parse(localStorage.getItem(LS_CUSTOM_TAGS) || "[]"); }
  catch { return []; }
}

export function saveCustomTags(tags: CustomTag[]) {
  localStorage.setItem(LS_CUSTOM_TAGS, JSON.stringify(tags));
}

// ── Значения кастомных полей (per-client) ───────────────────────────────────

export function loadClientExtraValues(clientId: number): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_CLIENT_EXTRA + clientId) || "{}"); }
  catch { return {}; }
}

export function saveClientExtraValues(clientId: number, values: Record<string, string>) {
  localStorage.setItem(LS_CLIENT_EXTRA + clientId, JSON.stringify(values));
}