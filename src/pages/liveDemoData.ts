export const ITEMS = [
  { name: "Полотно ПВХ матовое", qty: "32 м²",   price: 11200 },
  { name: "Багет алюминиевый",   qty: "24 м.п.", price:  4800 },
  { name: "Светильники LED",     qty: "6 шт",   price:  6900 },
  { name: "Замер и доставка",    qty: "—",       price:  2500 },
  { name: "Монтаж под ключ",     qty: "32 м²",   price: 18400 },
];

export const TOTAL    = 84000;
export const COSTS    = 51600;
export const PROFIT   = 32400;
export const MAX_DISC = 18; // %

export const STEP_TIMINGS: Record<number, number> = {
  0: 1200,
  1: 2200,
  2: 1300,
  3: 1800,
  4: 1800,
  5: 3500,
  6: 3000,
};

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
