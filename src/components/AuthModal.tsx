import { useState } from "react";
import { useAuth, type UserRole, BUSINESS_ROLES } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";
import TermsModal from "@/components/TermsModal";
import PersonalDataModal from "@/components/PersonalDataModal";
import DisclaimerModal from "@/components/DisclaimerModal";
import { ROLE_OPTIONS } from "@/components/roleOptions";
import AuthVerifyStep from "@/components/auth/AuthVerifyStep";
import AuthResetStep from "@/components/auth/AuthResetStep";
import AuthRoleStep from "@/components/auth/AuthRoleStep";
import AuthFormStep from "@/components/auth/AuthFormStep";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

interface Props {
  onClose: () => void;
  defaultTab?: "login" | "register";
  onPending?: (role: string) => void;
  onSuccess?: () => void;
}

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const isValidPhone = (v: string) => v.replace(/\D/g, "").length >= 11;

function maskPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^7/, "").replace(/^8/, "");
  let masked = "+7 (";
  if (digits.length > 0) masked += digits.slice(0, 3);
  if (digits.length >= 3) masked += ") " + digits.slice(3, 6);
  if (digits.length >= 6) masked += "-" + digits.slice(6, 8);
  if (digits.length >= 8) masked += "-" + digits.slice(8, 10);
  return masked;
}

export default function AuthModal({ onClose, defaultTab = "login", onPending, onSuccess }: Props) {
  const { login, register, verifyEmail, resendVerification } = useAuth();
  const [tab,      setTab]      = useState<"login" | "register">(defaultTab);
  const [step,     setStep]     = useState<"role" | "form" | "reset" | "verify">(defaultTab === "register" ? "role" : "form");

  // verify-email state
  const [verifyEmailAddr, setVerifyEmailAddr] = useState("");
  const [verifyCode,      setVerifyCode]      = useState("");
  const [verifyError,     setVerifyError]     = useState("");
  const [verifyLoading,   setVerifyLoading]   = useState(false);
  const [resendMsg,       setResendMsg]       = useState("");
  const [role,     setRole]     = useState<UserRole>("client");
  const [name,        setName]        = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyAddr, setCompanyAddr] = useState("");
  const [phone,    setPhone]    = useState("+7 (");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,              setError]              = useState("");
  const [loading,            setLoading]            = useState(false);
  const [termsAccepted,      setTermsAccepted]      = useState(true);
  const [pdAccepted,         setPdAccepted]         = useState(true);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(true);
  const [showTerms,          setShowTerms]          = useState(false);
  const [showPd,             setShowPd]             = useState(false);
  const [showDisclaimer,     setShowDisclaimer]      = useState(false);

  // reset-password state
  const [resetEmail,    setResetEmail]    = useState("");
  const [resetLoading,  setResetLoading]  = useState(false);
  const [resetDone,     setResetDone]     = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError,    setResetError]    = useState("");

  // inline validation
  const [emailTouched, setEmailTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);

  const emailError = emailTouched && email && !isValidEmail(email);
  const phoneError = phoneTouched && phone.replace(/\D/g, "").length > 1 && !isValidPhone(phone);

  const selectedRole = ROLE_OPTIONS.find(r => r.value === role)!;
  const isBusiness   = BUSINESS_ROLES.includes(role);

  const switchTab = (t: "login" | "register") => {
    setTab(t);
    setStep(t === "register" ? "role" : "form");
    setError("");
  };

  const handlePhoneChange = (raw: string) => {
    if (raw === "" || raw === "+") { setPhone("+7 ("); return; }
    setPhone(maskPhone(raw));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    if (!isValidEmail(email)) { setError("Введите корректный Email"); return; }
    setError("");
    setLoading(true);
    try {
      if (tab === "login") {
        const res = await login(email, password);
        if (res.emailVerificationRequired) { setVerifyEmailAddr(res.email || email); setStep("verify"); setLoading(false); return; }
        if (res.pending) { onPending?.(res.role || "company"); onClose(); return; }
      } else {
        if (!name.trim()) { setError("Введите имя"); setLoading(false); return; }
        // Если телефон введён частично (есть цифры, но не 11) — отказ
        const phoneDigits = phone.replace(/\D/g, "").length;
        if (phoneDigits > 1 && !isValidPhone(phone)) {
          setError("Введите корректный телефон или оставьте поле пустым");
          setPhoneTouched(true);
          setLoading(false);
          return;
        }
        const phoneVal = isValidPhone(phone) ? phone : undefined;
        const res = await register(email, password, name, role, phoneVal, isBusiness ? companyName : undefined, isBusiness ? companyAddr : undefined);
        if (res.emailVerificationRequired) { setVerifyEmailAddr(res.email || email); setStep("verify"); setLoading(false); return; }
        if (res.pending) { onPending?.(res.role || role); onClose(); return; }
      }
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Произошла ошибка");
    } finally {
      setLoading(false);
    }
  };

  const submitVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyCode.length !== 6) { setVerifyError("Введите 6-значный код"); return; }
    setVerifyLoading(true); setVerifyError("");
    try {
      await verifyEmail(verifyEmailAddr, verifyCode);
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setVerifyError(err instanceof Error ? err.message : "Неверный код");
    } finally {
      setVerifyLoading(false);
    }
  };

  const submitResend = async () => {
    setResendMsg(""); setVerifyError("");
    try {
      await resendVerification(verifyEmailAddr);
      setResendMsg("Код отправлен повторно");
    } catch (err: unknown) {
      setVerifyError(err instanceof Error ? err.message : "Не удалось отправить код");
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(resetEmail)) { setResetError("Введите корректный Email"); return; }
    setResetLoading(true); setResetError("");
    try {
      const res = await fetch(`${AUTH_URL}?action=reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail.trim().toLowerCase() }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setResetPassword(d.password || "");
      setResetDone(true);
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <>
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.80)" }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
        style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={e => e.stopPropagation()}>

        {/* Шапка */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500/15 flex items-center justify-center">
              <Icon name="User" size={15} style={{ color: "#f97316" }} />
            </div>
            <span className="text-sm font-bold text-white">
              {step === "verify"
                ? "Подтверждение email"
                : step === "reset"
                ? "Восстановление пароля"
                : tab === "login"
                ? "Вход в кабинет"
                : step === "role" ? "Давайте познакомимся" : `Регистрация — ${selectedRole.label}`}
            </span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition">
            <Icon name="X" size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">

        {/* ── Подтверждение email ── */}
        {step === "verify" && (
          <AuthVerifyStep
            verifyEmailAddr={verifyEmailAddr}
            verifyCode={verifyCode}
            setVerifyCode={setVerifyCode}
            verifyError={verifyError}
            verifyLoading={verifyLoading}
            resendMsg={resendMsg}
            onSubmit={submitVerify}
            onResend={submitResend}
          />
        )}

        {/* ── Восстановление пароля ── */}
        {step === "reset" && (
          <AuthResetStep
            resetEmail={resetEmail}
            setResetEmail={setResetEmail}
            resetLoading={resetLoading}
            resetDone={resetDone}
            resetPassword={resetPassword}
            resetError={resetError}
            onBack={() => { setStep("form"); setResetDone(false); setResetPassword(""); setResetError(""); }}
            onSubmit={submitReset}
            onUseNewPassword={() => { setStep("form"); setTab("login"); setPassword(resetPassword); setEmail(resetEmail); setResetDone(false); }}
          />
        )}

        {/* Табы — только не на reset/verify */}
        {step !== "reset" && step !== "verify" && (
          <div className="flex mx-6 mt-5 rounded-xl overflow-hidden flex-shrink-0" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
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
        )}

        {/* ── ШАГ 1: Выбор роли ── */}
        {step === "role" && tab === "register" && (
          <AuthRoleStep
            role={role}
            setRole={setRole}
            selectedRole={selectedRole}
            isBusiness={isBusiness}
            onContinue={() => setStep("form")}
          />
        )}

        {/* ── ШАГ 2: Форма ── */}
        {step === "form" && (
          <AuthFormStep
            tab={tab}
            selectedRole={selectedRole}
            isBusiness={isBusiness}
            name={name}
            setName={setName}
            companyName={companyName}
            setCompanyName={setCompanyName}
            companyAddr={companyAddr}
            setCompanyAddr={setCompanyAddr}
            phone={phone}
            onPhoneFocus={() => { if (!phone || phone === "") setPhone("+7 ("); }}
            onPhoneChange={handlePhoneChange}
            onPhoneBlur={() => setPhoneTouched(true)}
            phoneError={phoneError}
            email={email}
            setEmail={setEmail}
            onEmailBlur={() => setEmailTouched(true)}
            emailError={!!emailError}
            password={password}
            setPassword={setPassword}
            error={error}
            loading={loading}
            termsAccepted={termsAccepted}
            setTermsAccepted={setTermsAccepted}
            pdAccepted={pdAccepted}
            setPdAccepted={setPdAccepted}
            disclaimerAccepted={disclaimerAccepted}
            setDisclaimerAccepted={setDisclaimerAccepted}
            onShowTerms={() => setShowTerms(true)}
            onShowPd={() => setShowPd(true)}
            onShowDisclaimer={() => setShowDisclaimer(true)}
            onBackToRole={() => setStep("role")}
            onGoReset={() => { setStep("reset"); setResetEmail(email); }}
            onSwitchTab={switchTab}
            onSubmit={submit}
          />
        )}

        </div>
      </div>
    </div>

    {showTerms      && <TermsModal        onClose={() => setShowTerms(false)} />}
    {showPd         && <PersonalDataModal onClose={() => setShowPd(false)} />}
    {showDisclaimer && <DisclaimerModal   onClose={() => setShowDisclaimer(false)} />}
    </>
  );
}