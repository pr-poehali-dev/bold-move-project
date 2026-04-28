import Icon from "@/components/ui/icon";
import PhoneInput from "@/components/ui/PhoneInput";

interface Props {
  show: boolean;
  done: boolean;
  saving: boolean;
  name: string;
  phone: string;
  addr: string;
  onChangeName: (v: string) => void;
  onChangePhone: (v: string) => void;
  onChangeAddr: (v: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function EstimateContactModal({
  show, done, saving, name, phone, addr,
  onChangeName, onChangePhone, onChangeAddr,
  onSave, onClose,
}: Props) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: "#16100a", border: "1px solid rgba(249,115,22,0.25)" }}>
        <div className="h-1.5 bg-gradient-to-r from-orange-500 to-rose-500" />
        <div className="p-6">
          {done ? (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center mb-3">
                <Icon name="CheckCircle2" size={28} className="text-emerald-400" />
              </div>
              <div className="text-white font-bold text-base mb-1">Данные сохранены!</div>
              <div className="text-white/40 text-sm">Мы свяжемся с вами в ближайшее время</div>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center text-center mb-5">
                <div className="w-14 h-14 rounded-2xl bg-orange-500/15 flex items-center justify-center mb-3">
                  <Icon name="ClipboardList" size={26} className="text-orange-400" />
                </div>
                <div className="text-white font-bold text-base mb-1">Заполни карточку заказа</div>
                <div className="text-white/40 text-sm leading-relaxed">
                  Укажите данные клиента — запишем на замер и уточним детали
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Имя клиента</label>
                  <input value={name} onChange={e => onChangeName(e.target.value)}
                    placeholder="Иван Иванов"
                    className="w-full rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(249,115,22,0.25)" }} />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Телефон клиента</label>
                  <PhoneInput value={phone} onChange={onChangePhone} showValidation
                    className="w-full rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(249,115,22,0.25)" }} />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Адрес монтажа</label>
                  <input value={addr} onChange={e => onChangeAddr(e.target.value)}
                    placeholder="ул. Пушкина, д. 10, кв. 5"
                    className="w-full rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(249,115,22,0.25)" }} />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={onSave} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 bg-gradient-to-r from-orange-500 to-rose-500">
                  {saving ? "Сохраняем..." : "Отправить"}
                </button>
                <button onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-sm transition"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                  Позже
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}