// ── Calendar grid utilities ───────────────────────────────────────────────────
import { CalEvent } from "./calendarTypes";
import { moscowDateParts } from "./timeMoscow";

export interface GridCell { day: number; cur: boolean; }

export function buildMonthGrid(year: number, month: number): GridCell[] {
  const firstDay     = new Date(year, month - 1, 1);
  const daysInMonth  = new Date(year, month, 0).getDate();
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;
  const prevMonthDays = new Date(year, month - 1, 0).getDate();

  const prefill  = Array.from({ length: startDow }, (_, i) => ({ day: prevMonthDays - startDow + i + 1, cur: false }));
  const current  = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, cur: true }));
  const cells    = [...prefill, ...current];
  const postfill = Array.from({ length: 42 - cells.length }, (_, i) => ({ day: i + 1, cur: false }));
  return [...cells, ...postfill];
}

export function eventsForDay(events: CalEvent[], day: number, month: number, year: number, cur = true): CalEvent[] {
  if (!cur) return [];
  return events.filter(e => {
    // Определяем день события в МОСКОВСКОМ поясе, чтобы событие попадало на верный
    // день независимо от часового пояса устройства пользователя.
    const p = moscowDateParts(e.start_time);
    return !!p && p.day === day && p.month === month && p.year === year;
  });
}

export function mondayWeekStart(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return d;
}