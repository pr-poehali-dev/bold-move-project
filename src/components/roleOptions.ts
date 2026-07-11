// ── Общий список ролей для AuthModal (регистрация) и RoleSelectModal (после соц-входа) ──
import type { UserRole } from "@/context/AuthContext";

export type RoleOption = {
  value: UserRole;
  label: string;
  icon: string;
  desc: string;
  color: string;
  benefit: string;
};

export const ROLE_OPTIONS: RoleOption[] = [
  { value: "client",    label: "Заказчик",  icon: "Home",      desc: "Хочу натяжные потолки",    color: "#f97316", benefit: "Получите смету за 30 секунд и контролируйте каждый этап монтажа" },
  { value: "designer",  label: "Дизайнер",  icon: "Pencil",    desc: "Работаю с интерьерами",    color: "#a78bfa", benefit: "Партнёрская программа — зарабатывайте на каждом клиенте" },
  { value: "foreman",   label: "Прораб",    icon: "HardHat",   desc: "Веду строительные проекты", color: "#34d399", benefit: "Партнёрская программа — получайте бонус с каждого объекта" },
  { value: "installer", label: "Монтажник", icon: "Wrench",    desc: "Монтирую натяжные потолки", color: "#60a5fa", benefit: "Свой бизнес под ключ: CRM, AI-агент и поток заявок — всё готово" },
  { value: "company",   label: "Компания",  icon: "Building2", desc: "Продаю и монтирую потолки", color: "#f59e0b", benefit: "Масштабируйте команду: CRM, аналитика и AI работают за вас" },
];