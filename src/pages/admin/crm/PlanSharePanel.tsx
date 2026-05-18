import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";

interface Props {
  selectedCount: number;
  totalCount: number;
  shareUrl: string | null;
  sharing: boolean;
  copied: boolean;
  onShare: () => void;
  onCopyLink: () => void;
  onResetUrl: () => void;
}

export default function PlanSharePanel({
  selectedCount,
  totalCount,
  shareUrl,
  sharing,
  copied,
  onShare,
  onCopyLink,
  onResetUrl,
}: Props) {
  const t = useTheme();

  return (
    <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.25)" }}>
      <p className="text-xs font-semibold" style={{ color: "#a78bfa" }}>
        Выбрано {selectedCount} из {totalCount} чертежей
      </p>

      {shareUrl ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs" style={{ color: t.textMute }}>Ссылка готова — отправьте клиенту:</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={shareUrl}
              className="flex-1 text-xs rounded-lg px-2 py-1.5 truncate"
              style={{ background: "rgba(255,255,255,0.06)", color: t.text, border: `1px solid ${t.border}` }}
            />
            <button
              onClick={onCopyLink}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
              style={{ background: copied ? "rgba(16,185,129,0.2)" : "rgba(124,58,237,0.3)", color: copied ? "#10b981" : "#a78bfa" }}
            >
              <Icon name={copied ? "Check" : "Copy"} size={12} />
              {copied ? "Скопировано" : "Копировать"}
            </button>
          </div>
          <button
            onClick={onResetUrl}
            className="text-xs text-center"
            style={{ color: t.textMute }}
          >
            Создать новую ссылку
          </button>
        </div>
      ) : (
        <button
          onClick={onShare}
          disabled={sharing || selectedCount === 0}
          className="flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
          style={{ background: "rgba(124,58,237,0.3)", color: "#a78bfa" }}
        >
          {sharing
            ? <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            : <Icon name="Link" size={14} />}
          Создать ссылку
        </button>
      )}
    </div>
  );
}
