import { Client } from "./crmApi";
import { useSubstatuses } from "./substatusContext";

export const SNAP_WIDTH = 88;
export const THRESHOLD  = 44;

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
