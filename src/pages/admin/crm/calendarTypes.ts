import { EVENT_TYPE_COLORS } from "./crmApi";

export interface CalEvent {
  id: number;
  client_id: number | null;
  title: string;
  description: string;
  event_type: string;
  start_time: string;
  end_time: string | null;
  color: string;
  client_name?: string;
  phone?: string;
  address?: string | null;
}

export const MONTH_NAMES = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
export const DAY_NAMES   = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
export const DAY_SHORT   = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
export const EVENT_COLORS = EVENT_TYPE_COLORS;
export const HOURS = Array.from({ length: 17 }, (_, i) => i + 7); // 07:00–23:00