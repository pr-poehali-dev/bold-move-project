import Icon from "@/components/ui/icon";
import type { AuthUser } from "@/context/AuthContext";

interface Props {
  user: AuthUser | null;
  saved: boolean;
  saving: boolean;
  downloading: boolean;
  saveError: string;
  onDownload: () => void;
  onSave: () => void;
}

export default function EstimateActions({ user, saved, saving, downloading, saveError, onDownload, onSave }: Props) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={onDownload}
          disabled={downloading}
          className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-xs font-montserrat font-bold px-3 py-2.5 rounded-xl hover:scale-105 transition-transform disabled:opacity-50 shadow-lg shadow-orange-500/20 whitespace-nowrap h-11"
        >
          <Icon name="Download" size={14} />
          {downloading ? "Генерация..." : "Скачать PDF"}
        </button>

        {saved ? (
          <div className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-montserrat font-bold text-emerald-400 border border-emerald-500/30 bg-emerald-500/10">
            <Icon name="CheckCircle2" size={14} />
            Заявка создана
          </div>
        ) : (
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-montserrat font-bold transition-all disabled:opacity-50 whitespace-nowrap h-11"
            style={{
              background: user ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.06)",
              border: user ? "1px solid rgba(249,115,22,0.35)" : "1px solid rgba(255,255,255,0.1)",
              color: user ? "#f97316" : "rgba(255,255,255,0.5)",
            }}
          >
            {saving
              ? <><div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Сохраняем...</>
              : <><Icon name={user ? "ArrowUpRight" : "LogIn"} size={14} /> {user ? "Перейти в CRM" : "Войти"}</>
            }
          </button>
        )}
      </div>

      {saveError && (
        <span className="text-xs text-red-400">{saveError}</span>
      )}
    </div>
  );
}