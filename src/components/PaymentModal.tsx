import Icon from "@/components/ui/icon";

interface Props { onClose: () => void; }

const MODULES = [
  { id: "crm",       name: "CRM",          desc: "Воронка продаж, клиенты, канбан", price: 990,  icon: "LayoutDashboard", color: "#8b5cf6", active: true },
  { id: "estimate",  name: "Смета",        desc: "Расчёт смет, редактор позиций",   price: 590,  icon: "FileSpreadsheet", color: "#f97316", active: true },
  { id: "calendar",  name: "Календарь",    desc: "Замеры и монтажи по датам",       price: 390,  icon: "Calendar",        color: "#f59e0b", active: false },
  { id: "analytics", name: "Аналитика",    desc: "Графики выручки и конверсий",     price: 490,  icon: "BarChart2",       color: "#10b981", active: false },
];

export default function PaymentModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={e => e.stopPropagation()}>

        {/* Шапка */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#10b98115" }}>
              <Icon name="CreditCard" size={15} style={{ color: "#10b981" }} />
            </div>
            <span className="text-sm font-bold text-white">Оплата модулей</span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition">
            <Icon name="X" size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Статус подписки */}
          <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: "#10b98112", border: "1px solid #10b98130" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#10b98120" }}>
              <Icon name="CheckCircle2" size={17} style={{ color: "#10b981" }} />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Активная подписка</div>
              <div className="text-xs text-white/40">Оплачено вручную · Действует до 31 декабря 2026</div>
            </div>
          </div>

          {/* Модули */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider mb-3 text-white/30">Модули</div>
            <div className="space-y-2">
              {MODULES.map(m => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${m.active ? m.color + "25" : "rgba(255,255,255,0.05)"}` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: m.color + "18" }}>
                    <Icon name={m.icon} size={14} style={{ color: m.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white/80">{m.name}</div>
                    <div className="text-[10px] text-white/30">{m.desc}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-bold" style={{ color: m.active ? m.color : "rgba(255,255,255,0.2)" }}>
                      {m.price} ₽/мес
                    </span>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: m.active ? m.color : "rgba(255,255,255,0.06)" }}>
                      {m.active
                        ? <Icon name="Check" size={11} style={{ color: "#fff" }} />
                        : <Icon name="Lock" size={10} style={{ color: "rgba(255,255,255,0.2)" }} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Инфо */}
          <div className="rounded-xl px-4 py-3 text-xs text-white/25 text-center" style={{ background: "rgba(255,255,255,0.02)" }}>
            Для подключения модулей или изменения тарифа — свяжитесь с нами
          </div>

          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.07)" }}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
