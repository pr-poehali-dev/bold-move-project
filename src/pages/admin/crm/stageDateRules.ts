import { Client } from "./crmApi";

/**
 * Этапы, на которые нельзя перевести заявку без даты.
 * Единый источник правды — используется и модалкой выбора даты, и проверками
 * при закрытии карточки. Backend дублирует эту же проверку (crm-manager), чтобы
 * статус нельзя было проставить в обход интерфейса.
 *
 * Чтобы добавить/убрать требование — правится только этот объект.
 */
export const STAGE_DATE_RULES: Record<string, {
  field: "measure_date" | "install_date";
  /** Заголовок модалки */
  title: string;
  /** Подпись под заголовком */
  hint: string;
  /** Иконка и цвет — в стиле этапа (замер оранжевый, монтаж — тёмно-оранжевый) */
  icon: string;
  color: string;
  /** Поле комментария этого этапа — заполняется тут же, чтобы не открывать карточку */
  commentField: "comment_measure" | "comment_install";
  commentLabel: string;
}> = {
  measure: {
    field: "measure_date",
    title: "Когда назначен замер?",
    hint: "Без даты замер назначить нельзя",
    icon: "Ruler",
    color: "#f59e0b",
    commentField: "comment_measure",
    commentLabel: "Комментарий к замеру",
  },
  install_scheduled: {
    field: "install_date",
    title: "Когда назначен монтаж?",
    hint: "Без даты монтаж назначить нельзя",
    icon: "Wrench",
    color: "#f97316",
    commentField: "comment_install",
    commentLabel: "Комментарий к монтажу",
  },
};

/** Требует ли этот статус даты — и какой именно. Undefined, если не требует. */
export function stageDateRule(status: string | null | undefined) {
  return status ? STAGE_DATE_RULES[status] : undefined;
}

/**
 * Нужно ли спросить дату, прежде чем переводить заявку в новый статус.
 * Возвращает правило, если дата обязательна и её ещё нет в карточке.
 */
export function needStageDate(client: Client, nextStatus: string) {
  const rule = stageDateRule(nextStatus);
  if (!rule) return undefined;
  return client[rule.field] ? undefined : rule;
}
