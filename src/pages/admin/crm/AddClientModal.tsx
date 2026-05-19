import { useState } from "react";
import { crmFetch } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function AddClientModal({ onClose, onCreated }: Props) {
  const t = useTheme();
  const [name,    setName]    = useState("");
  const [phone,   setPhone]   = useState("");
  const [address, setAddress] = useState("");
  const [notes,   setNotes]   = useState("");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  const formatPhone = (raw: string): string => {
    // Оставляем только цифры
    const digits = raw.replace(/\D/g, "");
    // Нормализуем: 8 → 7, остальное как есть
    const normalized = digits.startsWith("8") ? "7" + digits.slice(1) : digits.startsWith("7") ? digits : "7" + digits;
    const d = normalized.slice(1); // цифры после кода страны
    let result = "+7";
    if (d.length > 0) result += " " + d.slice(0, 3);
    if (d.length > 3) result += " " + d.slice(3, 6);
    if (d.length > 6) result += "-" + d.slice(6, 8);
    if (d.length > 8) result += "-" + d.slice(8, 10);
    return result;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Разрешаем стирать до пустой строки
    if (!raw.replace(/\D/g, "")) { setPhone(""); return; }
    setPhone(formatPhone(raw));
  };

  const handlePhoneFocus = () => {
    if (!phone) setPhone("+7 ");
  };

  const handlePhoneBlur = () => {
    if (phone === "+7 " || phone === "+7") setPhone("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Введите имя клиента"); return; }
    setSaving(true); setError("");
    try {
      await crmFetch("clients", {
        method: "POST",
        body: JSON.stringify({
          client_name: name.trim(),
          phone:       phone.trim() || undefined,
          address:     address.trim() || undefined,
          notes:       notes.trim() || undefined,
          status:      "new",
          source:      "manual",
        }),
      });
      onCreated();
      onClose();
    } catch {
      setError("Ошибка при создании заявки");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: t.surface, border: `1px solid ${t.border}` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: t.accent + "20" }}>
              <Icon name="UserPlus" size={16} style={{ color: t.accentLight }} />
            </div>
            <span className="font-bold text-base" style={{ color: t.text }}>Новая заявка</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition hover:opacity-70"
            style={{ color: t.textMute }}>
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Форма */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3">
          {/* Имя */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: t.textSub }}>
              Имя клиента <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Иван Иванов"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none transition"
              style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}
            />
          </div>

          {/* Телефон */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: t.textSub }}>Телефон</label>
            <input
              value={phone}
              onChange={handlePhoneChange}
              onFocus={handlePhoneFocus}
              onBlur={handlePhoneBlur}
              placeholder="+7 977 606-89-01"
              type="tel"
              inputMode="numeric"
              maxLength={16}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none transition"
              style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}
            />
          </div>

          {/* Адрес */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: t.textSub }}>Адрес объекта</label>
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="ул. Пушкина, д. 1"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none transition"
              style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}
            />
          </div>

          {/* Заметка */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: t.textSub }}>Заметка</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Комментарий к заявке..."
              rows={3}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none transition resize-none"
              style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              <Icon name="AlertCircle" size={12} /> {error}
            </p>
          )}

          {/* Кнопки */}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition hover:opacity-80"
              style={{ background: t.surface2, color: t.textSub, border: `1px solid ${t.border}` }}>
              Отмена
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: t.accent, color: "#fff" }}>
              {saving
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><Icon name="Plus" size={14} /> Создать</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}