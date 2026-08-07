import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { crmFetch } from "./crmApi";

interface Props {
  orderId: number;
  onClose: () => void;
}

export default function OrderShareModal({ orderId, onClose }: Props) {
  const t = useTheme();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ссылка постоянная — при каждом открытии модалки получаем (или создаём один
  // раз) токен для этой заявки, без лишнего клика «Создать».
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await crmFetch("order-share", {
          method: "POST",
          body: JSON.stringify({ chat_id: orderId }),
        }) as { token?: string; error?: string };
        if (!alive) return;
        if (res?.token) {
          setShareUrl(`${window.location.origin}/order-share/${res.token}`);
        } else {
          setError(res?.error || "Не удалось создать ссылку");
        }
      } catch {
        if (alive) setError("Не удалось связаться с сервером");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [orderId]);

  const copyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: t.card, border: `1px solid ${t.border}` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2">
            <Icon name="Share2" size={16} style={{ color: t.textMute }} />
            <span className="text-sm font-bold" style={{ color: t.text }}>Поделиться заявкой</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg transition hover:opacity-70" style={{ background: t.surface2 }}>
            <Icon name="X" size={14} style={{ color: t.textMute }} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs" style={{ color: t.textMute }}>
            По этой ссылке клиент увидит статус заявки, адрес, даты и смету — без входа в систему.
            Ссылка постоянная, данные обновляются автоматически.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-xs" style={{ color: "#ef4444" }}>{error}</div>
          ) : (
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl || ""}
                className="flex-1 text-xs rounded-lg px-2 py-2 truncate"
                style={{ background: t.surface2, color: t.text, border: `1px solid ${t.border}` }}
              />
              <button
                onClick={copyLink}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition flex-shrink-0"
                style={{ background: copied ? "rgba(16,185,129,0.2)" : "rgba(124,58,237,0.3)", color: copied ? "#10b981" : "#a78bfa" }}
              >
                <Icon name={copied ? "Check" : "Copy"} size={12} />
                {copied ? "Скопировано" : "Копировать"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
