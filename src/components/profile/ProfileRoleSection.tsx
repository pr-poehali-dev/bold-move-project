import { type UserRole, BUSINESS_ROLES, CLIENT_ROLES } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";
import { Section } from "./ProfileFieldControls";

export const ROLE_OPTIONS: { value: UserRole; label: string; icon: string; color: string; desc: string }[] = [
  { value: "client",    label: "Клиент",    icon: "Home",      color: "#f97316", desc: "Хочу натяжные потолки" },
  { value: "designer",  label: "Дизайнер",  icon: "Pencil",    color: "#a78bfa", desc: "Работаю с интерьерами" },
  { value: "foreman",   label: "Прораб",    icon: "HardHat",   color: "#34d399", desc: "Веду строительные проекты" },
  { value: "installer", label: "Монтажник", icon: "Wrench",    color: "#60a5fa", desc: "Монтирую натяжные потолки" },
  { value: "company",   label: "Компания",  icon: "Building2", color: "#f59e0b", desc: "Продаю и монтирую потолки" },
];

interface Props {
  role: UserRole;
  onRoleChange: (role: UserRole) => void;
  showRolePicker: boolean;
  setShowRolePicker: (v: boolean) => void;
  roleChanged: boolean;
}

export default function ProfileRoleSection({ role, onRoleChange, showRolePicker, setShowRolePicker, roleChanged }: Props) {
  const currentRoleOpt = ROLE_OPTIONS.find(r => r.value === role)!;
  const isBusiness = BUSINESS_ROLES.includes(role);

  return (
    <Section title="Роль" icon="BadgeCheck">
      <div className="px-4 py-3">
        {!showRolePicker ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${currentRoleOpt.color}20` }}>
                <Icon name={currentRoleOpt.icon} size={15} style={{ color: currentRoleOpt.color }} />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">{currentRoleOpt.label}</div>
                <div className="text-[10px] text-white/30">{currentRoleOpt.desc}</div>
              </div>
            </div>
            <button onClick={() => setShowRolePicker(true)}
              className="text-[11px] px-3 py-1.5 rounded-lg transition"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
              Сменить
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] text-white/40">Выберите новую роль</span>
              <button onClick={() => setShowRolePicker(false)} className="text-white/30 hover:text-white/60 transition">
                <Icon name="X" size={14} />
              </button>
            </div>
            {ROLE_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => { onRoleChange(opt.value); setShowRolePicker(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition"
                style={{
                  background: role === opt.value ? `${opt.color}18` : "rgba(255,255,255,0.03)",
                  border: role === opt.value ? `1.5px solid ${opt.color}50` : "1.5px solid rgba(255,255,255,0.06)",
                }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${opt.color}20` }}>
                  <Icon name={opt.icon} size={13} style={{ color: opt.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-white">{opt.label}</span>
                  <span className="text-[10px] text-white/30 ml-2">{opt.desc}</span>
                </div>
                {role === opt.value && <Icon name="Check" size={13} style={{ color: opt.color }} />}
              </button>
            ))}
          </div>
        )}

        {/* Предупреждение при смене на бизнес-роль */}
        {roleChanged && isBusiness && (
          <div className="mt-3 rounded-xl px-3 py-2.5 text-[11px] text-amber-300/80 bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
            <Icon name="Clock" size={12} className="mt-0.5 flex-shrink-0" style={{ color: "#fbbf24" }} />
            <span>После сохранения заявка уйдёт на проверку. Доступ к CRM откроется в течение 24 часов.</span>
          </div>
        )}
        {roleChanged && CLIENT_ROLES.includes(role) && (
          <div className="mt-3 rounded-xl px-3 py-2.5 text-[11px] text-green-300/80 bg-green-500/10 border border-green-500/20 flex items-start gap-2">
            <Icon name="CheckCircle2" size={12} className="mt-0.5 flex-shrink-0" style={{ color: "#34d399" }} />
            <span>Роль будет изменена сразу после сохранения.</span>
          </div>
        )}
      </div>
    </Section>
  );
}
