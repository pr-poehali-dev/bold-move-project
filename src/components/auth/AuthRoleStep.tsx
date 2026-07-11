import Icon from "@/components/ui/icon";
import { type UserRole } from "@/context/AuthContext";
import { ROLE_OPTIONS, type RoleOption } from "@/components/roleOptions";

interface Props {
  role: UserRole;
  setRole: (r: UserRole) => void;
  selectedRole: RoleOption;
  isBusiness: boolean;
  onContinue: () => void;
}

export default function AuthRoleStep({ role, setRole, selectedRole, isBusiness, onContinue }: Props) {
  return (
    <div className="px-6 py-5">
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
          <span>После регистрации ваша заявка отправится на проверку. Мы откроем доступ в течение 24 часов.</span>
        </div>
      )}
      <button onClick={onContinue}
        className="w-full mt-4 py-3 rounded-xl text-sm font-bold text-white transition"
        style={{ background: selectedRole.color }}>
        Продолжить как {selectedRole.label} →
      </button>
    </div>
  );
}
