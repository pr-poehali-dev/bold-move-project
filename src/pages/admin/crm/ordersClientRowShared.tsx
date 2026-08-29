import { Client } from "./crmApi";
import { useSubstatuses } from "./substatusContext";
import Icon from "@/components/ui/icon";

export const SNAP_WIDTH = 88;
export const THRESHOLD  = 44;

// Заявка считается дублем, если у компании есть ещё заявки с тем же телефоном.
// Признак приходит с сервера (duplicate_count), см. crm-manager: телефон там
// нормализуется до последних 10 цифр, поэтому «+7…» и «8…» считаются одним номером.
export function isDuplicate(c: Client): boolean {
  return (c.duplicate_count ?? 1) > 1;
}

// Яркая плашка «ДУБЛЬ» — намеренно контрастная (заливка, а не полупрозрачный фон),
// чтобы менеджер сразу видел повтор и не вёл одного клиента дважды.
export function DuplicateBadge({ client }: { client: Client }) {
  if (!isDuplicate(client)) return null;
  const others = (client.duplicate_ids ?? []).filter(id => id !== client.id);
  return (
    <span
      className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md font-black tracking-wide flex-shrink-0"
      title={others.length > 0
        ? `Дубль: тот же телефон в заявках №${others.join(", №")}`
        : "Дубль: этот телефон встречается в нескольких заявках"}
      style={{ background: "#ef4444", color: "#fff", boxShadow: "0 0 0 1px #ef444488" }}>
      <Icon name="Copy" size={9} /> ДУБЛЬ {client.duplicate_count}
    </span>
  );
}

export function vibe(ms: number | number[]) {
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ms);
}

export function InstallProgress({ client }: { client: Client }) {
  const allSubs = useSubstatuses();
  const steps = allSubs.filter(s => s.parent_status === "installs");
  if (steps.length === 0) return null;
  const idx = steps.findIndex(s => String(s.id) === client.sub_status);
  return (
    <div className="flex items-center gap-0.5">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-0.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: i <= idx ? s.color : "rgba(128,128,128,0.2)" }} />
          {i < steps.length - 1 && <div className="w-2 h-px" style={{ background: i < idx ? s.color : "rgba(128,128,128,0.15)" }} />}
        </div>
      ))}
      {idx >= 0 && (
        <span className="ml-1 text-[9px] font-medium" style={{ color: steps[idx].color }}>
          {steps[idx].label}
        </span>
      )}
    </div>
  );
}