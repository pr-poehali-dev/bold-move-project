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
    <div className="mt-3 flex items-center gap-2 flex-wrap">
      <button
        onClick={onDownload}
        disabled={downloading}
        className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-xs font-montserrat font-bold px-4 py-2.5 rounded-xl hover:scale-105 transition-transform disabled:opacity-50 shadow-lg shadow-orange-500/20"
      >
        <Icon name="Download" size={14} />
        {downloading ? "Генерация..." : "Скачать смету PDF"}
      </button>

      {saved ? (
        <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-montserrat font-bold text-emerald-400 border border-emerald-500/30 bg-emerald-500/10">
          <Icon name="CheckCircle2" size={14} />
          Смета сохранена! Заявка создана
        </div>
      ) : (
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-montserrat font-bold transition-all disabled:opacity-50"
          style={{
            background: user ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.06)",
            border: user ? "1px solid rgba(249,115,22,0.35)" : "1px solid rgba(255,255,255,0.1)",
            color: user ? "#f97316" : "rgba(255,255,255,0.5)",
          }}
        >
          {saving
            ? <><div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Сохраняем...</>
            : <><Icon name={user ? "Bookmark" : "LogIn"} size={14} /> {user ? "Сохранить заявку" : "Войдите, чтобы сохранить"}</>
          }
        </button>
      )}

      {saveError && (
        <span className="text-xs text-red-400">{saveError}</span>
      )}
    </div>
  );
}
