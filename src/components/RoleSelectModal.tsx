// Модалка выбора роли — показывается один раз новому пользователю, вошедшему через
// Google/Яндекс (user.role_selected === false). Закрыть без выбора нельзя.
import { useState } from "react";
import { useAuth, BUSINESS_ROLES } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";
import { ROLE_OPTIONS } from "@/components/roleOptions";
import type { UserRole } from "@/context/AuthContext";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

export default function RoleSelectModal() {
  const { token, user, updateUser } = useAuth();
  const [role, setRole] = useState<UserRole>("client");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedRole = ROLE_OPTIONS.find(r => r.value === role)!;
  const isBusiness = BUSINESS_ROLES.includes(role);

  const confirm = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${AUTH_URL}?action=update-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          name: user?.name || "",
          role,
          company_name: isBusiness ? undefined : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Не удалось сохранить роль");
      updateUser({ role: data.user.role, approved: data.user.approved, discount: data.user.discount, role_selected: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Произошла ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)" }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
        style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.08)" }}>

        <div className="flex items-center gap-2.5 px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-orange-500/15 flex items-center justify-center">
            <Icon name="User" size={15} style={{ color: "#f97316" }} />
          </div>
          <span className="text-sm font-bold text-white">Давайте познакомимся</span>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          <p className="text-xs text-white/40 mb-4 text-center">Выберите, кто вы — мы настроим кабинет под вас</p>
          <div className="grid grid-cols-1 gap-2">
            {ROLE_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setRole(opt.value)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition"
                style={{
                  background: role === opt.value ? `${opt.color}18` : "rgba(255,255,255,0.03)",
                  border: role === opt.value ? `1.5px solid ${opt.color}60` : "1.5px solid rgba(255,255,255,0.06)",
                }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${opt.color}20` }}>
                  <Icon name={opt.icon} size={16} style={{ color: opt.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{opt.label}</span>
                    <span className="text-[10px] text-white/30">{opt.desc}</span>
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: opt.color + "cc" }}>{opt.benefit}</div>
                </div>
                {role === opt.value && <Icon name="CheckCircle2" size={16} style={{ color: opt.color }} />}
              </button>
            ))}
          </div>

          {isBusiness && (
            <div className="mt-3 rounded-xl px-3.5 py-2.5 text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
              <Icon name="Clock" size={13} className="mt-0.5 flex-shrink-0" style={{ color: "#fbbf24" }} />
              <span>После выбора ваша заявка отправится на проверку. Мы откроем доступ в течение 24 часов.</span>
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-xl px-3.5 py-2.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20">{error}</div>
          )}

          <button onClick={confirm} disabled={loading}
            className="w-full mt-4 py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-40"
            style={{ background: selectedRole.color }}>
            {loading ? "Сохраняем..." : `Продолжить как ${selectedRole.label} →`}
          </button>
        </div>
      </div>
    </div>
  );
}
