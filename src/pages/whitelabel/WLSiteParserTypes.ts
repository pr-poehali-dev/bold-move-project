export interface FilledField  { field: string; label: string; value: string }
export interface MissingField { field: string; label: string }
export interface ParseReport  { filled: FilledField[]; missing: MissingField[] }

// Стадии: idle → parsed (данные есть, компания ещё не создана) → animating → banner → collapsed
export type Phase = "idle" | "parsed" | "animating" | "banner" | "collapsed";
