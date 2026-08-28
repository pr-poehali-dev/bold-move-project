import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { Client, crmFetch } from "./crmApi";

// Типы ответственности — совпадают с полями Client. Чтобы добавить новую роль,
// достаточно дописать строку сюда: фильтр, счётчики и попап подхватят её сами.
export const ASSIGNEE_ROLES = [
  { field: "assigned_to",           nameField: "assigned_name",              label: "Менеджер 1 линии", icon: "Headset",   color: "#a78bfa" },
  { field: "assigned_manager2",     nameField: "assigned_manager2_name",     label: "Менеджер 2 линии", icon: "UserCog",   color: "#60a5fa" },
  { field: "assigned_measurer",     nameField: "assigned_measurer_name",     label: "Замерщик",         icon: "Ruler",     color: "#f59e0b" },
  { field: "assigned_technologist", nameField: "assigned_technologist_name", label: "Технолог",         icon: "Calculator", color: "#34d399" },
  { field: "assigned_installer",    nameField: "assigned_installer_name",    label: "Монтажник",        icon: "Wrench",    color: "#f97316" },
] as const;

export type AssigneeRoleField = typeof ASSIGNEE_ROLES[number]["field"];

// Состояние фильтра: роль + конкретный сотрудник.
// userId === null — фильтр по человеку не выбран (показываем всех).
// userId === 0 — особый случай «не назначен» (поле пустое у заявки).
export interface AssigneeFilterValue {
  role: AssigneeRoleField;
  userId: number | null;
}

export const EMPTY_ASSIGNEE: AssigneeFilterValue = { role: "assigned_to", userId: null };

// Применение фильтра к списку заявок — вынесено отдельно, чтобы использовать
// и для самой фильтрации, и для подсчёта цифр на кнопках.
export function applyAssigneeFilter(list: Client[], f: AssigneeFilterValue): Client[] {
  if (f.userId === null) return list;
  if (f.userId === 0) return list.filter(c => !c[f.role]);
  return list.filter(c => c[f.role] === f.userId);
}

interface Props {
  /** Заявки, по которым считаем счётчики (уже отфильтрованные остальными фильтрами) */
  pool: Client[];
  value: AssigneeFilterValue;
  onChange: (v: AssigneeFilterValue) => void;
}

export default function OrdersAssigneeFilter({ pool, value, onChange }: Props) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<{ id: number; name: string }[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || members.length) return;
    crmFetch("team-members")
      .then(d => setMembers(((d as { members?: { id: number; name: string }[] })?.members) || []))
      .catch(() => {});
  }, [open, members.length]);

  // Клик мимо — закрываем попап
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const roleDef = ASSIGNEE_ROLES.find(r => r.field === value.role) ?? ASSIGNEE_ROLES[0];
  const active = value.userId !== null;

  // Сотрудники, реально встречающиеся в текущем срезе по выбранной роли,
  // со счётчиком заявок. Пустые (никому не назначено) — отдельной строкой.
  const countFor = (uid: number | null) =>
    uid === null ? pool.filter(c => !c[value.role]).length : pool.filter(c => c[value.role] === uid).length;

  const presentIds = Array.from(new Set(
    pool.map(c => c[value.role]).filter((x): x is number => typeof x === "number" && x > 0)
  ));
  // Имя берём из заявки (сервер уже прислал), если сотрудника нет в списке команды
  const nameOf = (uid: number) =>
    members.find(m => m.id === uid)?.name
    ?? (pool.find(c => c[value.role] === uid)?.[roleDef.nameField] as string | null)
    ?? `ID ${uid}`;

  const people = presentIds
    .map(uid => ({ uid, name: nameOf(uid), cnt: countFor(uid) }))
    .sort((a, b) => b.cnt - a.cnt);
  const unassignedCnt = countFor(null);

  const selectedLabel = value.userId === null ? roleDef.label
    : value.userId === 0 ? `${roleDef.label}: не назначен`
    : `${roleDef.label}: ${nameOf(value.userId)}`;

  return (
    <div className="relative" ref={boxRef}>
      <button className="flex items-center gap-1.5 px-3 rounded-lg text-xs border font-medium transition py-2.5" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border font-medium transition"
        style={{
          background: active ? roleDef.color : roleDef.color + "18",
          borderColor: roleDef.color,
          color: active ? "#fff" : roleDef.color,
        }}>
        <Icon name={roleDef.icon} size={13} />
        <span className="max-w-[190px] truncate">{selectedLabel}</span>
        {active && (
          <span onClick={e => { e.stopPropagation(); onChange({ ...value, userId: null }); }}
            className="ml-0.5 opacity-70 hover:opacity-100" title="Сбросить">
            <Icon name="X" size={12} />
          </span>
        )}
        <Icon name={open ? "ChevronUp" : "ChevronDown"} size={12} className="opacity-60" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-[290px] rounded-xl overflow-hidden shadow-2xl"
          style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          {/* Тип ответственности */}
          <div className="px-3 py-2" style={{ borderBottom: `1px solid ${t.border}` }}>
            <div className="text-[9px] uppercase tracking-wider font-bold mb-1.5" style={{ color: t.textMute }}>
              Тип ответственности
            </div>
            <div className="flex flex-wrap gap-1">
              {ASSIGNEE_ROLES.map(r => {
                const sel = r.field === value.role;
                return (
                  <button key={r.field}
                    onClick={() => onChange({ role: r.field, userId: null })}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] border font-medium transition"
                    style={{
                      background: sel ? r.color : "transparent",
                      borderColor: sel ? r.color : t.border,
                      color: sel ? "#fff" : t.textSub,
                    }}>
                    <Icon name={r.icon} size={11} />
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Сотрудники */}
          <div className="px-3 py-2 max-h-[280px] overflow-y-auto">
            <div className="text-[9px] uppercase tracking-wider font-bold mb-1.5" style={{ color: t.textMute }}>
              Сотрудник
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => { onChange({ ...value, userId: null }); setOpen(false); }}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition"
                style={{
                  background: value.userId === null ? roleDef.color + "22" : "transparent",
                  color: value.userId === null ? roleDef.color : t.textSub,
                }}>
                <span>Все</span>
                <span className="font-bold">{pool.length}</span>
              </button>

              {people.map(p => (
                <button key={p.uid}
                  onClick={() => { onChange({ ...value, userId: p.uid }); setOpen(false); }}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition"
                  style={{
                    background: value.userId === p.uid ? roleDef.color + "22" : "transparent",
                    color: value.userId === p.uid ? roleDef.color : t.textSub,
                  }}>
                  <span className="truncate">{p.name}</span>
                  <span className="font-bold flex-shrink-0">{p.cnt}</span>
                </button>
              ))}

              {unassignedCnt > 0 && (
                <button onClick={() => { onChange({ ...value, userId: 0 }); setOpen(false); }}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition"
                  style={{
                    background: value.userId === 0 ? roleDef.color + "22" : "transparent",
                    color: value.userId === 0 ? roleDef.color : t.textMute,
                  }}>
                  <span>Не назначен</span>
                  <span className="font-bold">{unassignedCnt}</span>
                </button>
              )}

              {people.length === 0 && unassignedCnt === 0 && (
                <div className="px-2.5 py-3 text-[11px] text-center" style={{ color: t.textMute }}>
                  Нет заявок с этой ролью
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}