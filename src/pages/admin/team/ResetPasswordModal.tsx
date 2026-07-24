import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { resetMemberPassword, type TeamMember } from "./teamApi";

interface Props {
  isDark: boolean;
  member: TeamMember;
  onClose: () => void;
  onReset?: () => void;
}

export default function ResetPasswordModal({ isDark, member, onClose, onReset }: Props) {
  const { token } = useAuth();
  const [confirmed, setConfirmed] = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [tempPwd, setTempPwd] = useState<string | null>(null);
  const [err,     setErr]     = useState("");
  const [copied,  setCopied]  = useState(false);

  const doReset = async () => {
    setConfirmed(true);
    setBusy(true);
    setErr("");
    try {
      const pwd = await resetMemberPassword(token, member.id);
      setTempPwd(pwd); onReset?.();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const copyAll = async () => {
    if (!tempPwd) return;
    const text = `Логин: ${member.email}\nПароль: ${tempPwd}\n\nВходи на сайте, в разделе «Войти».`;
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* ignore */ }
  };

  const bg     = isDark ? "#0e0e1c" : "#ffffff";
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const text   = isDark ? "#fff"    : "#0f1623";
  const muted  = isDark ? "rgba(255,255,255,0.4)" : "#6b7280";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.78)" }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: bg, border: `1px solid ${border}`, color: text }}
        onClick={e => e.stopPropagation()}>

        <div className="px-6 py-5 border-b flex items-center gap-2.5" style={{ borderColor: border }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(167,139,250,0.18)" }}>
            <Icon name="KeyRound" size={18} style={{ color: "#a78bfa" }} />
          </div>
          <div>
            <div className="text-base font-bold">Сброс пароля</div>
            <div className="text-[11px]" style={{ color: muted }}>{member.email}</div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Шаг 1 — подтверждение */}
          {!confirmed && (
            <>
              <div className="rounded-xl px-4 py-3.5 text-[13px] flex items-start gap-2.5"
                style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.28)", color: "#fbbf24" }}>
                <Icon name="TriangleAlert" size={16} className="mt-0.5 flex-shrink-0" />
                <span>
                  Точно сбросить пароль сотруднику <b>{member.name || member.email}</b>?
                  <br /><br />
                  Он <b>потеряет доступ</b> и не сможет войти в систему, пока вы не передадите ему новый пароль для входа.
                  Все его активные сессии будут завершены.
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={onClose}
                  className="flex-1 py-3 rounded-xl text-sm font-bold transition"
                  style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", color: muted, border: `1px solid ${border}` }}>
                  Отмена
                </button>
                <button onClick={doReset}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition flex items-center justify-center gap-2"
                  style={{ background: "#7c3aed" }}>
                  <Icon name="KeyRound" size={14} />
                  Да, сбросить
                </button>
              </div>
            </>
          )}

          {busy && (
            <div className="flex items-center justify-center py-6">
              <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {err && (
            <div className="rounded-xl px-3.5 py-2.5 text-xs"
              style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
              {err}
            </div>
          )}

          {tempPwd && !busy && (
            <>
              <div className="rounded-xl px-4 py-3"
                style={{ background: "rgba(124,58,237,0.10)", border: "1.5px solid rgba(124,58,237,0.35)" }}>
                <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#a78bfa" }}>Новый временный пароль</div>
                <div className="text-lg font-mono font-black" style={{ color: "#a78bfa" }}>{tempPwd}</div>
              </div>
              <div className="rounded-xl px-3 py-2.5 text-[11px] flex items-start gap-2"
                style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" }}>
                <Icon name="AlertTriangle" size={12} className="mt-0.5 flex-shrink-0" />
                <span>Все активные сессии сотрудника завершены. Старый пароль больше не работает.</span>
              </div>
              <button onClick={copyAll}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition flex items-center justify-center gap-2"
                style={{ background: copied ? "#10b981" : "#7c3aed" }}>
                <Icon name={copied ? "Check" : "Copy"} size={14} />
                {copied ? "Скопировано" : "Скопировать логин и пароль"}
              </button>
            </>
          )}

          {confirmed && (
            <button onClick={onClose}
              className="w-full py-2.5 rounded-xl text-xs font-medium transition"
              style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", color: muted, border: `1px solid ${border}` }}>
              Закрыть
            </button>
          )}
        </div>
      </div>
    </div>
  );
}