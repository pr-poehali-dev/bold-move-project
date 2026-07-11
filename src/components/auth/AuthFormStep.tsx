import Icon from "@/components/ui/icon";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import type { RoleOption } from "@/components/roleOptions";

interface Props {
  tab: "login" | "register";
  selectedRole: RoleOption;
  isBusiness: boolean;
  name: string;
  setName: (v: string) => void;
  companyName: string;
  setCompanyName: (v: string) => void;
  companyAddr: string;
  setCompanyAddr: (v: string) => void;
  phone: string;
  onPhoneFocus: () => void;
  onPhoneChange: (raw: string) => void;
  onPhoneBlur: () => void;
  phoneError: boolean;
  email: string;
  setEmail: (v: string) => void;
  onEmailBlur: () => void;
  emailError: boolean;
  password: string;
  setPassword: (v: string) => void;
  error: string;
  loading: boolean;
  termsAccepted: boolean;
  setTermsAccepted: (v: boolean) => void;
  pdAccepted: boolean;
  setPdAccepted: (v: boolean) => void;
  disclaimerAccepted: boolean;
  setDisclaimerAccepted: (v: boolean) => void;
  onShowTerms: () => void;
  onShowPd: () => void;
  onShowDisclaimer: () => void;
  onBackToRole: () => void;
  onGoReset: () => void;
  onSwitchTab: (t: "login" | "register") => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function AuthFormStep({
  tab, selectedRole, isBusiness,
  name, setName, companyName, setCompanyName, companyAddr, setCompanyAddr,
  phone, onPhoneFocus, onPhoneChange, onPhoneBlur, phoneError,
  email, setEmail, onEmailBlur, emailError,
  password, setPassword,
  error, loading,
  termsAccepted, setTermsAccepted, pdAccepted, setPdAccepted, disclaimerAccepted, setDisclaimerAccepted,
  onShowTerms, onShowPd, onShowDisclaimer,
  onBackToRole, onGoReset, onSwitchTab, onSubmit,
}: Props) {
  return (
    <form onSubmit={onSubmit} className="px-6 py-5 space-y-3">
      {tab === "register" && (
        <>
          <button type="button" onClick={onBackToRole}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition mb-1">
            <Icon name="ChevronLeft" size={13} /> Изменить роль
          </button>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-1"
            style={{ background: `${selectedRole.color}15`, border: `1px solid ${selectedRole.color}40` }}>
            <Icon name={selectedRole.icon} size={13} style={{ color: selectedRole.color }} className="flex-shrink-0" />
            <span className="text-xs font-semibold flex-shrink-0" style={{ color: selectedRole.color }}>{selectedRole.label}</span>
            <span className="text-xs text-white/30 ml-1 leading-snug">— {selectedRole.benefit}</span>
          </div>

          <div>
            <label className="text-[11px] text-white/40 mb-1.5 block font-medium">Ваше имя *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Иван Петров" autoFocus
              className="w-full rounded-xl px-4 py-2.5 text-sm bg-white/[0.05] border border-white/[0.08] text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition" />
          </div>

          {isBusiness && (
            <>
              <div>
                <label className="text-[11px] text-white/40 mb-1.5 block font-medium">Название компании</label>
                <input value={companyName} onChange={e => setCompanyName(e.target.value)}
                  placeholder="ООО «Потолки Москвы»"
                  className="w-full rounded-xl px-4 py-2.5 text-sm bg-white/[0.05] border border-white/[0.08] text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition" />
              </div>
              <div>
                <label className="text-[11px] text-white/40 mb-1.5 block font-medium">Город / адрес</label>
                <input value={companyAddr} onChange={e => setCompanyAddr(e.target.value)}
                  placeholder="Москва, Мытищи, Краснодар…"
                  className="w-full rounded-xl px-4 py-2.5 text-sm bg-white/[0.05] border border-white/[0.08] text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition" />
              </div>
            </>
          )}

          <div>
            <label className="text-[11px] text-white/40 mb-1.5 block font-medium">Телефон</label>
            <input
              type="tel"
              value={phone}
              onFocus={onPhoneFocus}
              onChange={e => onPhoneChange(e.target.value)}
              onBlur={onPhoneBlur}
              placeholder="+7 (999) 000-00-00"
              className="w-full rounded-xl px-4 py-2.5 text-sm bg-white/[0.05] text-white placeholder-white/20 focus:outline-none transition"
              style={{ border: phoneError ? "1px solid rgba(239,68,68,0.6)" : "1px solid rgba(255,255,255,0.08)" }}
            />
            {phoneError && <p className="text-[11px] text-red-400 mt-1">Введите корректный номер телефона</p>}
          </div>
        </>
      )}

      <div>
        <label className="text-[11px] text-white/40 mb-1.5 block font-medium">Email</label>
        <input
          type="email" value={email}
          onChange={e => setEmail(e.target.value)}
          onBlur={onEmailBlur}
          placeholder="email@example.com"
          autoFocus={tab === "login"}
          autoComplete={tab === "register" ? "off" : "email"}
          className="w-full rounded-xl px-4 py-2.5 text-sm bg-white/[0.05] text-white placeholder-white/20 focus:outline-none transition"
          style={{ border: emailError ? "1px solid rgba(239,68,68,0.6)" : "1px solid rgba(255,255,255,0.08)" }}
        />
        {emailError && <p className="text-[11px] text-red-400 mt-1">Введите корректный Email</p>}
      </div>

      <div>
        <label className="text-[11px] text-white/40 mb-1.5 block font-medium">Пароль</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder={tab === "register" ? "Минимум 6 символов" : "••••••••"}
          autoComplete={tab === "register" ? "new-password" : "current-password"}
          className="w-full rounded-xl px-4 py-2.5 text-sm bg-white/[0.05] border border-white/[0.08] text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition" />
      </div>

      {/* Забыли пароль — только для login */}
      {tab === "login" && (
        <div className="flex justify-end -mt-1">
          <button type="button" onClick={onGoReset}
            className="text-[11px] text-white/30 hover:text-orange-400 transition underline underline-offset-2">
            Забыли пароль?
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl px-3.5 py-2.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20">{error}</div>
      )}

      {tab === "register" && (
        <div className="space-y-2.5 rounded-xl p-3"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[10px] text-white/30 mb-1">Создавая аккаунт, вы соглашаетесь со всеми тремя документами:</p>
          <Checkbox checked={termsAccepted} color={selectedRole.color} onChange={setTermsAccepted}
            onLinkClick={onShowTerms} linkText="Пользовательское соглашение"
            suffix="— включая уведомление о том, что расчёты AI-агента носят предварительный характер и не являются публичной офертой" />
          <Checkbox checked={pdAccepted} color={selectedRole.color} onChange={setPdAccepted}
            onLinkClick={onShowPd} linkText="Согласие на обработку персональных данных" suffix="(ФЗ-152)" />
          <Checkbox checked={disclaimerAccepted} color={selectedRole.color} onChange={setDisclaimerAccepted}
            onLinkClick={onShowDisclaimer} linkText="Отказ от юридической ответственности"
            suffix="— вся ответственность за решения лежит на Пользователе" />
        </div>
      )}

      <button type="submit"
        disabled={loading || !email || !password || (tab === "register" && (!termsAccepted || !pdAccepted || !disclaimerAccepted))}
        className="w-full py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-40 mt-1"
        style={{ background: loading ? "#9a3412" : (tab === "register" ? selectedRole.color : "#f97316") }}>
        {loading
          ? <span className="flex items-center justify-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {tab === "login" ? "Входим..." : "Регистрируем..."}
            </span>
          : tab === "login" ? "Войти" : isBusiness ? "Отправить заявку на доступ" : "Зарегистрироваться"}
      </button>

      {tab === "login" && <SocialLoginButtons />}

      <p className="text-center text-[11px] text-white/25">
        {tab === "login" ? "Нет аккаунта? " : "Уже есть аккаунт? "}
        <button type="button" onClick={() => onSwitchTab(tab === "login" ? "register" : "login")}
          className="text-orange-400 hover:text-orange-300 transition underline underline-offset-2">
          {tab === "login" ? "Зарегистрироваться" : "Войти"}
        </button>
      </p>
    </form>
  );
}

function Checkbox({ checked, color, onChange, onLinkClick, linkText, suffix }: {
  checked: boolean; color: string; onChange: (v: boolean) => void;
  onLinkClick: () => void; linkText: string; suffix: string;
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer">
      <button type="button" onClick={() => onChange(!checked)}
        className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition"
        style={{ background: checked ? color : "rgba(255,255,255,0.06)", border: checked ? "none" : "1px solid rgba(255,255,255,0.15)" }}>
        {checked && <Icon name="Check" size={10} style={{ color: "#fff" }} />}
      </button>
      <span className="text-[11px] text-white/40 leading-relaxed">
        <button type="button" onClick={onLinkClick} className="underline underline-offset-2 hover:text-white/70 transition" style={{ color }}>
          {linkText}
        </button>{" "}
        {suffix}
      </span>
    </label>
  );
}
