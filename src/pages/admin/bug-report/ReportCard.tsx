import { useState } from "react";
import Icon from "@/components/ui/icon";
import { STATUS, sevById, typeById, statusById, type Report } from "./bugReportTypes";

// ── Карточка репорта ───────────────────────────────────────────────────────
export default function ReportCard({ report, isMaster, onStatusChange, onRemove }: {
  report: Report; isMaster: boolean;
  onStatusChange: (id: number, status: string) => void;
  onRemove: (id: number) => void;
}) {
  const sev = sevById(report.severity);
  const typ = typeById(report.report_type);
  const st = statusById(report.status);
  const [statusOpen, setStatusOpen] = useState(false);

  const date = new Date(report.created_at).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${sev.color}22` }}>
      <div className="flex items-start gap-3">
        {/* Иконка важности */}
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: sev.color + "1f" }}>
          <Icon name={sev.icon} size={18} style={{ color: sev.color }} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Бейджи */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold" style={{ background: sev.color + "22", color: sev.color }}>
              {sev.label}
            </span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium flex items-center gap-1" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)" }}>
              <Icon name={typ.icon} size={11} /> {typ.label}
            </span>
          </div>

          {report.title && <div className="text-sm font-semibold text-white mb-0.5">{report.title}</div>}
          <div className="text-sm text-white/70 whitespace-pre-wrap break-words">{report.description}</div>

          {/* Вложения */}
          {report.attachments?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2.5">
              {report.attachments.map((a, i) => (
                a.type?.startsWith("image") ? (
                  <a key={i} href={a.url} target="_blank" rel="noreferrer">
                    <img src={a.url} alt={a.name} className="w-16 h-16 object-cover rounded-lg border border-white/10" />
                  </a>
                ) : (
                  <a key={i} href={a.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs text-white/70"
                    style={{ background: "rgba(255,255,255,0.06)" }}>
                    <Icon name="Paperclip" size={13} /> {a.name}
                  </a>
                )
              ))}
            </div>
          )}

          {/* Футер */}
          <div className="flex items-center gap-2 mt-3 text-[11px] text-white/40">
            <Icon name="User" size={12} /> {report.author_name || "Аноним"}
            <span>·</span>
            <Icon name="Clock" size={12} /> {date}
          </div>
        </div>

        {/* Статус + управление */}
        <div className="flex-shrink-0 flex flex-col items-end gap-2 relative">
          <button
            onClick={() => setStatusOpen(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition"
            style={{ background: st.color + "22", color: st.color, border: `1px solid ${st.color}44` }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: st.color }} />
            {st.label}
            <Icon name="ChevronDown" size={13} />
          </button>

          {statusOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setStatusOpen(false)} />
              <div className="absolute top-9 right-0 z-20 rounded-xl overflow-hidden min-w-[150px]"
                style={{ background: "#1a1a24", border: "1px solid rgba(255,255,255,0.1)" }}>
                {STATUS.map(s => {
                  const locked = s.masterOnly && !isMaster;
                  return (
                    <button
                      key={s.id}
                      disabled={locked}
                      onClick={() => { if (!locked) { onStatusChange(report.id, s.id); setStatusOpen(false); } }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition disabled:opacity-35"
                      style={{ color: s.color, background: report.status === s.id ? s.color + "18" : "transparent" }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                      {s.label}
                      {locked && <Icon name="Lock" size={11} className="ml-auto text-white/30" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {isMaster && (
            <button onClick={() => onRemove(report.id)} className="text-white/25 hover:text-red-400 transition p-1">
              <Icon name="Trash2" size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
