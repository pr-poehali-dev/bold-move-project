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

/**
 * Ярлык подэтапа замера, для которого дата специально необязательна — клиент
 * ещё не согласовал время, но заявку уже нужно видеть на этапе «Замер».
 * Название должно совпадать с label в order_substatuses (backend дублирует
 * эту же проверку по тому же тексту, см. crm-manager).
 */
export const MEASURE_DATE_OPTIONAL_SUBSTATUS_LABEL = "Дата замера не назначена";

/** Требует ли этот статус даты — и какой именно. Undefined, если не требует. */
export function stageDateRule(status: string | null | undefined) {
  return status ? STAGE_DATE_RULES[status] : undefined;
}

/**
 * Нужно ли спросить дату, прежде чем переводить заявку в новый статус.
 * Возвращает правило, если дата обязательна и её ещё нет в карточке.
 * subStatusLabel — ярлык уже выбранного (или проставляемого автоматически)
 * подэтапа; для «Дата замера не назначена» дату не спрашиваем.
 */
export function needStageDate(client: Client, nextStatus: string, subStatusLabel?: string | null) {
  const rule = stageDateRule(nextStatus);
  if (!rule) return undefined;
  if (nextStatus === "measure" && subStatusLabel === MEASURE_DATE_OPTIONAL_SUBSTATUS_LABEL) return undefined;
  return client[rule.field] ? undefined : rule;
}