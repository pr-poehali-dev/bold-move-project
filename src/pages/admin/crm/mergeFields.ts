import { Client } from "./crmApi";

// Поля, которые сравниваются и выбираются при объединении дублей.
// Порядок = порядок строк в модалке. Чтобы добавить поле — достаточно дописать
// строку сюда: и таблица сравнения, и отправка на сервер подхватят его сами
// (на бэке поле должно входить в MERGE_FIELDS, см. crm-manager).
export interface MergeFieldDef {
  key: keyof Client;
  label: string;
  group: string;
  type?: "money" | "date" | "text";
}

export const MERGE_FIELD_GROUPS: MergeFieldDef[] = [
  { key: "client_name",        label: "Имя клиента",        group: "Контакты" },
  { key: "phone",              label: "Телефон",            group: "Контакты" },
  { key: "responsible_phone",  label: "Доп. телефон",       group: "Контакты" },
  { key: "source",             label: "Источник",           group: "Контакты" },

  { key: "address",            label: "Адрес",              group: "Объект" },
  { key: "area",               label: "Площадь, м²",        group: "Объект" },
  { key: "map_link",           label: "Ссылка на карту",    group: "Объект" },
  { key: "budget",             label: "Бюджет",             group: "Объект", type: "money" },

  { key: "desired_measure_date", label: "Желаемый замер",   group: "Даты", type: "date" },
  { key: "desired_install_date", label: "Желаемый монтаж",  group: "Даты", type: "date" },
  { key: "measure_date",         label: "Дата замера",      group: "Даты", type: "date" },
  { key: "install_date",         label: "Дата монтажа",     group: "Даты", type: "date" },
  { key: "next_call_date",       label: "Следующий звонок", group: "Даты", type: "date" },

  { key: "contract_sum",       label: "Сумма договора",     group: "Деньги", type: "money" },
  { key: "prepayment",         label: "Предоплата",         group: "Деньги", type: "money" },
  { key: "extra_payment",      label: "Доплата",            group: "Деньги", type: "money" },

  { key: "assigned_to",           label: "Менеджер (1 линия)", group: "Ответственные" },
  { key: "assigned_manager2",     label: "Менеджер (2 линия)", group: "Ответственные" },
  { key: "assigned_measurer",     label: "Замерщик",           group: "Ответственные" },
  { key: "assigned_technologist", label: "Технолог",           group: "Ответственные" },
  { key: "assigned_installer",    label: "Монтажник",          group: "Ответственные" },

  { key: "notes",              label: "Заметки",            group: "Комментарии" },
  { key: "comment_order",      label: "Комментарий к заявке",  group: "Комментарии" },
  { key: "comment_measure",    label: "Комментарий к замеру",  group: "Комментарии" },
  { key: "comment_install",    label: "Комментарий к монтажу", group: "Комментарии" },
  { key: "comment_client",     label: "Комментарий о клиенте", group: "Комментарии" },
];

// Значение поля «пустое»: сюда же относим 0 у денег/площади — такое значение
// не несёт информации и не должно перебивать заполненное в другой заявке.
export function isEmptyValue(v: unknown): boolean {
  return v === null || v === undefined || v === "" || v === 0;
}

// Человекочитаемое значение поля для таблицы сравнения.
// Имена ответственных лежат в отдельных полях *_name — подставляем их вместо id.
export function displayValue(c: Client, f: MergeFieldDef): string {
  const raw = c[f.key];
  if (isEmptyValue(raw)) return "";
  if (String(f.key).startsWith("assigned_")) {
    const nameKey = `${String(f.key)}_name` as keyof Client;
    return (c[nameKey] as string) || String(raw);
  }
  if (f.type === "money") return `${Number(raw).toLocaleString("ru-RU")} ₽`;
  if (f.type === "date") {
    const d = new Date(String(raw));
    return isNaN(d.getTime())
      ? String(raw)
      : d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  }
  return String(raw);
}

// Ключ группы дублей — отсортированные id через запятую. Тот же формат
// использует сервер (not_duplicate_groups.group_key), чтобы пометка «не дубль»
// сходилась между фронтом и базой.
export function groupKeyOf(ids: number[]): string {
  return [...ids].sort((a, b) => a - b).join(",");
}
