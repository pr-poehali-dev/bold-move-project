import { useState } from "react";
import { useAuth, type UserRole, BUSINESS_ROLES } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";
import TermsModal from "@/components/TermsModal";
import PersonalDataModal from "@/components/PersonalDataModal";
import DisclaimerModal from "@/components/DisclaimerModal";

interface Props {
  onClose: () => void;
  defaultTab?: "login" | "register";
  onPending?: (role: string) => void;
  onSuccess?: () => void;
}

type RoleOption = {
  value: UserRole;
  label: string;
  icon: string;
  desc: string;
  color: string;
  benefit: string;
};

const ROLE_OPTIONS: RoleOption[] = [
  {
    value: "client",
    label: "Клиент",
    icon: "Home",
    desc: "Хочу натяжные потолки",
    color: "#f97316",
    benefit: "Сохраните смету и следите за статусом заявки",
  },
  {
    value: "designer",
    label: "Дизайнер",
    icon: "Pencil",
    desc: "Работаю с интерьерами",
    color: "#a78bfa",
    benefit: "Скидка 10% на все расчёты для ваших клиентов",
  },
  {
    value: "foreman",
    label: "Прораб",
    icon: "HardHat",
    desc: "Веду строительные проекты",
    color: "#34d399",
    benefit: "Скидка 10% на все расчёты для ваших объектов",
  },
  {
    value: "installer",
    label: "Монтажник",
    icon: "Wrench",
    desc: "Монтирую натяжные потолки",
    color: "#60a5fa",
    benefit: "Полный доступ к CRM и управлению агентом после одобрения",
  },
  {
    value: "company",
    label: "Компания",
    icon: "Building2",
    desc: "Продаю и монтирую потолки",
    color: "#f59e0b",
    benefit: "CRM, агент, аналитика и управление командой после одобрения",
  },
];

export default function AuthModal({ onClose, defaultTab = "login", onPending, onSuccess }: Props) {
  const { login, register } = useAuth();
  const [tab,      setTab]      = useState<"login" | "register">(defaultTab);
  const [step,     setStep]     = useState<"role" | "form">(defaultTab === "register" ? "role" : "form");
  const [role,     setRole]     = useState<UserRole>("client");
  const [name,     setName]     = useState("");
  const [phone,    setPhone]    = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,           setError]           = useState("");
  const [loading,         setLoading]         = useState(false);
  const [termsAccepted,   setTermsAccepted]   = useState(true);
  const [pdAccepted,      setPdAccepted]      = useState(true);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(true);
  const [showTerms,       setShowTerms]       = useState(false);
  const [showPd,          setShowPd]          = useState(false);
  const [showDisclaimer,  setShowDisclaimer]  = useState(false);

  const selectedRole = ROLE_OPTIONS.find(r => r.value === role)!;
  const isBusiness   = BUSINESS_ROLES.includes(role);

  const switchTab = (t: "login" | "register") => {
    setTab(t);
    setStep(t === "register" ? "role" : "form");
    setError("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (tab === "login") {
        const res = await login(email, password);
        if (res.pending) {
          onPending?.(res.role || "company");
          onClose();
          return;
        }
      } else {
        if (!name.trim()) { setError("Введите имя"); setLoading(false); return; }
        const res = await register(email, password, name, role, phone || undefined);
        if (res.pending) {
          onPending?.(res.role || role);
          onClose();
          return;
        }
      }
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Произошла ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.80)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={e => e.stopPropagation()}>

        {/* Шапка */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500/15 flex items-center justify-center">
              <Icon name="User" size={15} style={{ color: "#f97316" }} />
            </div>
            <span className="text-sm font-bold text-white">
              {tab === "login" ? "Вход в кабинет" : step === "role" ? "Кто вы?" : `Регистрация — ${selectedRole.label}`}
            </span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition">
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Табы */}
        <div className="flex mx-6 mt-5 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          {(["login", "register"] as const).map(t => (
            <button key={t} onClick={() => switchTab(t)}
              className="flex-1 py-2 text-xs font-semibold transition"
              style={tab === t
                ? { background: "#f97316", color: "#fff" }
                : { background: "transparent", color: "rgba(255,255,255,0.4)" }}>
              {t === "login" ? "Войти" : "Создать аккаунт"}
            </button>
          ))}
        </div>

        {/* ── ШАГ 1: Выбор роли (только register) ── */}
        {tab === "register" && step === "role" && (
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
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${opt.color}20` }}>
                    <Icon name={opt.icon} size={16} style={{ color: opt.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{opt.label}</span>
                      <span className="text-[10px] text-white/30">{opt.desc}</span>
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: opt.color + "cc" }}>
                      {opt.benefit}
                    </div>
                  </div>
                  {role === opt.value && (
                    <Icon name="CheckCircle2" size={16} style={{ color: opt.color }} />
                  )}
                </button>
              ))}
            </div>

            {isBusiness && (
              <div className="mt-3 rounded-xl px-3.5 py-2.5 text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
                <Icon name="Clock" size={13} className="mt-0.5 flex-shrink-0" style={{ color: "#fbbf24" }} />
                <span>После регистрации ваша заявка отправится на проверку. Мы откроем доступ в течение 24 часов.</span>
              </div>
            )}

            <button onClick={() => setStep("form")}
              className="w-full mt-4 py-3 rounded-xl text-sm font-bold text-white transition"
              style={{ background: selectedRole.color }}>
              Продолжить как {selectedRole.label} →
            </button>
          </div>
        )}

        {/* ── ШАГ 2: Форма ── */}
        {(tab === "login" || step === "form") && (
          <form onSubmit={submit} className="px-6 py-5 space-y-3">
            {tab === "register" && (
              <>
                <button type="button" onClick={() => setStep("role")}
                  className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition mb-1">
                  <Icon name="ChevronLeft" size={13} /> Изменить роль
                </button>

                {/* Бейдж выбранной роли */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-1"
                  style={{ background: `${selectedRole.color}15`, border: `1px solid ${selectedRole.color}40` }}>
                  <Icon name={selectedRole.icon} size={13} style={{ color: selectedRole.color }} />
                  <span className="text-xs font-semibold" style={{ color: selectedRole.color }}>{selectedRole.label}</span>
                  <span className="text-xs text-white/30 ml-1">— {selectedRole.benefit}</span>
                </div>

                <div>
                  <label className="text-[11px] text-white/40 mb-1.5 block font-medium">Ваше имя *</label>
                  <input value={name} onChange={e => setName(e.target.value)}
                    placeholder="Иван Петров" autoFocus
                    className="w-full rounded-xl px-4 py-2.5 text-sm bg-white/[0.05] border border-white/[0.08] text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition" />
                </div>
                <div>
                  <label className="text-[11px] text-white/40 mb-1.5 block font-medium">Телефон</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="+7 (999) 000-00-00"
                    className="w-full rounded-xl px-4 py-2.5 text-sm bg-white/[0.05] border border-white/[0.08] text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition" />
                </div>
              </>
            )}

            <div>
              <label className="text-[11px] text-white/40 mb-1.5 block font-medium">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="email@example.com" autoFocus={tab === "login"}
                className="w-full rounded-xl px-4 py-2.5 text-sm bg-white/[0.05] border border-white/[0.08] text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition" />
            </div>

            <div>
              <label className="text-[11px] text-white/40 mb-1.5 block font-medium">Пароль</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder={tab === "register" ? "Минимум 6 символов" : "••••••••"}
                className="w-full rounded-xl px-4 py-2.5 text-sm bg-white/[0.05] border border-white/[0.08] text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition" />
            </div>

            {error && (
              <div className="rounded-xl px-3.5 py-2.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20">
                {error}
              </div>
            )}

            {/* Чекбоксы соглашений — только при регистрации */}
            {tab === "register" && (
              <div className="space-y-2.5 rounded-xl p-3"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[10px] text-white/30 mb-1">
                  Создавая аккаунт, вы соглашаетесь со всеми тремя документами:
                </p>

                {/* 1. Пользовательское соглашение */}
                <Checkbox
                  checked={termsAccepted}
                  color={selectedRole.color}
                  onChange={setTermsAccepted}
                  onLinkClick={() => setShowTerms(true)}
                  linkText="Пользовательское соглашение"
                  suffix="— включая уведомление о том, что расчёты AI-агента носят предварительный характер и не являются публичной офертой"
                />

                {/* 2. Согласие на обработку ПД */}
                <Checkbox
                  checked={pdAccepted}
                  color={selectedRole.color}
                  onChange={setPdAccepted}
                  onLinkClick={() => setShowPd(true)}
                  linkText="Согласие на обработку персональных данных"
                  suffix="(ФЗ-152)"
                />

                {/* 3. Отказ от ответственности */}
                <Checkbox
                  checked={disclaimerAccepted}
                  color={selectedRole.color}
                  onChange={setDisclaimerAccepted}
                  onLinkClick={() => setShowDisclaimer(true)}
                  linkText="Отказ от юридической ответственности"
                  suffix="— вся ответственность за решения лежит на Пользователе"
                />
              </div>
            )}

            <button type="submit" disabled={loading || !email || !password || (tab === "register" && (!termsAccepted || !pdAccepted || !disclaimerAccepted))}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-40 mt-1"
              style={{ background: loading ? "#9a3412" : (tab === "register" ? selectedRole.color : "#f97316") }}>
              {loading
                ? <span className="flex items-center justify-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {tab === "login" ? "Входим..." : "Регистрируем..."}
                  </span>
                : tab === "login" ? "Войти" : isBusiness ? "Отправить заявку на доступ" : "Зарегистрироваться"}
            </button>

            <p className="text-center text-[11px] text-white/25">
              {tab === "login" ? "Нет аккаунта? " : "Уже есть аккаунт? "}
              <button type="button" onClick={() => switchTab(tab === "login" ? "register" : "login")}
                className="text-orange-400 hover:text-orange-300 transition underline underline-offset-2">
                {tab === "login" ? "Зарегистрироваться" : "Войти"}
              </button>
            </p>
          </form>
        )}
      </div>
    </div>

    {showTerms      && <TermsModal        onClose={() => setShowTerms(false)} />}
    {showPd         && <PersonalDataModal onClose={() => setShowPd(false)} />}
    {showDisclaimer && <DisclaimerModal   onClose={() => setShowDisclaimer(false)} />}
    </>
  );
}

// ── Вспомогательный компонент чекбокса ──────────────────────────────────────
function Checkbox({
  checked, color, onChange, onLinkClick, linkText, suffix,
}: {
  checked: boolean;
  color: string;
  onChange: (v: boolean) => void;
  onLinkClick: () => void;
  linkText: string;
  suffix?: string;
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer select-none">
      <div
        className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition"
        style={{
          background: checked ? color : "rgba(255,255,255,0.06)",
          border: checked ? `1.5px solid ${color}` : "1.5px solid rgba(255,255,255,0.15)",
        }}
        onClick={() => onChange(!checked)}
      >
        {checked && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3L3.5 5.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <span className="text-[11px] text-white/40 leading-relaxed">
        <button
          type="button"
          onClick={onLinkClick}
          className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition"
        >
          {linkText}
        </button>
        {suffix && <span> {suffix}</span>}
      </span>
    </label>
  );
}