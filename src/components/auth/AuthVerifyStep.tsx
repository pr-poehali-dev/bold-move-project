import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

interface Props {
  verifyEmailAddr: string;
  verifyCode: string;
  setVerifyCode: (v: string) => void;
  verifyError: string;
  verifyLoading: boolean;
  resendMsg: string;
  onSubmit: (e: React.FormEvent) => void;
  onResend: () => void;
}

export default function AuthVerifyStep({
  verifyEmailAddr, verifyCode, setVerifyCode, verifyError, verifyLoading, resendMsg, onSubmit, onResend,
}: Props) {
  return (
    <form onSubmit={onSubmit} className="px-6 py-5 space-y-4">
      <p className="text-xs text-white/40">
        Мы отправили 6-значный код на <span className="text-white/70 font-medium">{verifyEmailAddr}</span>. Введите его ниже.
      </p>
      <div className="flex justify-center">
        <InputOTP maxLength={6} value={verifyCode} onChange={setVerifyCode}>
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map(i => (
              <InputOTPSlot key={i} index={i} className="bg-white/[0.05] border-white/[0.08] text-white h-11 w-11" />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      {verifyError && (
        <div className="rounded-xl px-3.5 py-2.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20">{verifyError}</div>
      )}
      {resendMsg && (
        <div className="rounded-xl px-3.5 py-2.5 text-xs text-green-300 bg-green-500/10 border border-green-500/20">{resendMsg}</div>
      )}
      <button type="submit" disabled={verifyLoading || verifyCode.length !== 6}
        className="w-full py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-40"
        style={{ background: "#f97316" }}>
        {verifyLoading
          ? <span className="flex items-center justify-center gap-2"><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Проверяем...</span>
          : "Подтвердить"}
      </button>
      <button type="button" onClick={onResend}
        className="w-full text-center text-[11px] text-white/40 hover:text-orange-400 transition underline underline-offset-2">
        Отправить код ещё раз
      </button>
    </form>
  );
}
