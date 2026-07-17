import { useState } from "react";
import { useAuth, type UserRole } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";
import { isPhoneValid } from "@/hooks/use-phone";
import func2url from "@/../backend/func2url.json";
import ProfileRoleSection from "@/components/profile/ProfileRoleSection";
import ProfileInfoSections, { type ProfileFormData } from "@/components/profile/ProfileInfoSections";
import ProfileSecuritySection from "@/components/profile/ProfileSecuritySection";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

interface Props { onClose: () => void; open?: boolean; }

export default function ProfileModal({ onClose, open = true }: Props) {
  const { user, token, updateUser } = useAuth();
  const [form, setForm] = useState<ProfileFormData & { role: UserRole }>({
    name:         user?.name         || "",
    phone:        user?.phone        || "",
    company_name: user?.company_name || "",
    company_inn:  user?.company_inn  || "",
    company_addr: user?.company_addr || "",
    website:      user?.website      || "",
    telegram:     user?.telegram     || "",
    role:         (user?.role || "client") as UserRole,
  });
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [error,       setError]       = useState("");
  const [showRolePicker, setShowRolePicker] = useState(false);

  const roleChanged = form.role !== user?.role;

  const save = async () => {
    setError("");
    // Валидация телефона: если введён хоть какой-то набор цифр — должно быть полных 11
    const phoneDigits = (form.phone || "").replace(/\D/g, "").length;
    if (phoneDigits > 1 && !isPhoneValid(form.phone)) {
      setError("Введите корректный телефон или оставьте поле пустым");
      return;
    }
    setSaving(true); setSaved(false);
    try {
      const res = await fetch(`${AUTH_URL}?action=update-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      if (d.user) updateUser(d.user);
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="w-full max-w-lg sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl max-h-[92dvh] flex flex-col"
        style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#f9731615" }}>
              <Icon name="User" size={15} style={{ color: "#f97316" }} />
            </div>
            <span className="text-sm font-bold text-white">Профиль</span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition">
            <Icon name="X" size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">

          <ProfileRoleSection
            role={form.role}
            onRoleChange={v => setForm(f => ({ ...f, role: v }))}
            showRolePicker={showRolePicker}
            setShowRolePicker={setShowRolePicker}
            roleChanged={roleChanged}
          />

          <ProfileInfoSections form={form} setForm={setForm} email={user?.email || ""} />

          <ProfileSecuritySection
            loginMethods={user?.login_methods || []}
            hasPassword={user?.has_password !== false}
          />

          {error && (
            <div className="rounded-xl px-3.5 py-2.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20">{error}</div>
          )}
        </div>

        <div className="flex gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-white/[0.06] flex-shrink-0">
          <button onClick={save} disabled={saving}
            className="flex-1 py-3 sm:py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: saved ? "#10b981" : "#f97316" }}>
            {saving
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Сохранение...</>
              : saved
              ? <><Icon name="CheckCircle2" size={14} /> Сохранено</>
              : <><Icon name="Save" size={14} /> Сохранить</>}
          </button>
          <button onClick={onClose}
            className="px-5 py-3 sm:py-2.5 rounded-xl text-sm font-medium transition"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.07)" }}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
