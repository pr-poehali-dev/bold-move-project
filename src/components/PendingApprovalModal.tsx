import Icon from "@/components/ui/icon";

const ROLE_LABELS: Record<string, { label: string; icon: string; color: string; msg: string }> = {
  installer: {
    label: "Монтажник",
    icon: "Wrench",
    color: "#60a5fa",
    msg: "Мы проверим вашу заявку и откроем доступ к CRM и управлению агентом.",
  },
  company: {
    label: "Компания",
    icon: "Building2",
    color: "#f59e0b",
    msg: "Мы проверим вашу заявку и откроем доступ к CRM, аналитике и управлению командой.",
  },
};

interface Props {
  role: string;
  onClose: () => void;
}

export default function PendingApprovalModal({ role, onClose }: Props) {
  const info = ROLE_LABELS[role] ?? {
    label: role,
    icon: "Clock",
    color: "#a78bfa",
    msg: "Мы рассмотрим вашу заявку и свяжемся с вами.",
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.80)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl text-center"
        style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={e => e.stopPropagation()}>

        <div className="h-1" style={{ background: info.color }} />

        <div className="px-6 py-8">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: `${info.color}20` }}>
            <Icon name="Clock" size={28} style={{ color: info.color }} />
          </div>

          <div className="text-white font-bold text-lg mb-2">Заявка отправлена!</div>
          <div className="text-white/50 text-sm leading-relaxed mb-1">
            Вы зарегистрированы как <span className="font-semibold" style={{ color: info.color }}>{info.label}</span>.
          </div>
          <div className="text-white/40 text-sm leading-relaxed mb-6">
            {info.msg}
          </div>

          <div className="rounded-xl px-4 py-3 mb-5 text-left"
            style={{ background: `${info.color}10`, border: `1px solid ${info.color}30` }}>
            <div className="flex items-center gap-2 text-xs text-white/60">
              <Icon name="CheckCircle2" size={13} style={{ color: info.color }} />
              Заявка получена и ждёт проверки
            </div>
            <div className="flex items-center gap-2 text-xs text-white/40 mt-1.5">
              <Icon name="Mail" size={13} />
              Ответ придёт на вашу почту в течение 24 часов
            </div>
          </div>

          <button onClick={onClose}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition"
            style={{ background: info.color }}>
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}
