import { useState, useEffect } from "react";
import { crmFetch } from "./crmApi";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";

interface Analysis {
  state_summary: string | null;
  next_action: string | null;
  interest: string | null;
  interest_label: string | null;
  stage: string | null;
  outcome: string | null;
  outcome_label: string | null;
  risks: string[] | null;
  key_points: string[] | null;
  created_at: string | null;
}

interface TouchClient {
  id: number;
  phone: string | null;
  name: string | null;
  state_summary: string | null;
  next_action: string | null;
  interest: string | null;
  stage: string | null;
  analysis_updated_at: string | null;
}

interface Props {
  phone: string;
  name?: string;
}

const INTEREST: Record<string, { label: string; color: string }> = {
  high:   { label: "Высокий", color: "#22c55e" },
  medium: { label: "Средний", color: "#eab308" },
  low:    { label: "Низкий",  color: "#ef4444" },
};

const OUTCOME: Record<string, { label: string; color: string }> = {
  success: { label: "Успех",   color: "#22c55e" },
  failure: { label: "Отказ",   color: "#ef4444" },
  pending: { label: "В работе", color: "#3b82f6" },
};

const fmtDate = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export default function DrawerAnalyticsTab({ phone, name }: Props) {
  const t = useTheme();
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [client, setClient] = useState<TouchClient | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [touchCount, setTouchCount] = useState(0);

  const load = async () => {
    if (!phone) { setLoading(false); return; }
    setLoading(true);
    try {
      const extra: Record<string, string> = { phone };
      if (name) extra.name = name;
      const d = await crmFetch("touches", undefined, extra) as
        { client?: TouchClient; analysis?: Analysis; touches?: unknown[]; error?: string };
      if (d && !d.error) {
        setClient(d.client ?? null);
        setAnalysis(d.analysis ?? null);
        setTouchCount(Array.isArray(d.touches) ? d.touches.length : 0);
      }
    } catch { /* тихо */ }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [phone]);

  const rebuild = async () => {
    // ИИ-пересбор подключится, когда будет готова функция analyze-client.
    setRebuilding(true);
    setTimeout(() => setRebuilding(false), 800);
  };

  if (!phone) {
    return (
      <div className="px-3 sm:px-6 py-8 text-center text-sm" style={{ color: t.textMute }}>
        У клиента не указан номер телефона — анализ строится по истории касаний, привязанной к номеру.
      </div>
    );
  }

  if (loading) {
    return <div className="px-3 sm:px-6 py-8 text-center text-sm" style={{ color: t.textMute }}>Загрузка…</div>;
  }

  // Значения берём из analysis (детальный) с фолбэком на client (краткий срез)
  const summary  = analysis?.state_summary ?? client?.state_summary;
  const next     = analysis?.next_action  ?? client?.next_action;
  const interest = analysis?.interest     ?? client?.interest;
  const stage    = analysis?.stage        ?? client?.stage;
  const outcome  = analysis?.outcome ?? null;
  const risks      = analysis?.risks ?? [];
  const keyPoints  = analysis?.key_points ?? [];
  const updatedAt  = analysis?.created_at ?? client?.analysis_updated_at ?? null;

  const hasAnything = summary || next || interest || stage;

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-xl p-3.5" style={{ background: t.surface2, border: `1px solid ${t.border}` }}>{children}</div>
  );

  return (
    <div className="px-3 sm:px-6 py-4 flex flex-col gap-3">
      {/* Шапка: бейджи + кнопка пересбора */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {interest && INTEREST[interest] && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
              style={{ background: INTEREST[interest].color + "22", color: INTEREST[interest].color }}>
              Интерес: {INTEREST[interest].label}
            </span>
          )}
          {stage && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
              style={{ background: t.accent + "22", color: t.accentLight }}>{stage}</span>
          )}
          {outcome && OUTCOME[outcome] && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
              style={{ background: OUTCOME[outcome].color + "22", color: OUTCOME[outcome].color }}>
              {OUTCOME[outcome].label}
            </span>
          )}
        </div>
        <button onClick={rebuild} disabled={rebuilding}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition active:scale-[0.97]"
          style={{ background: t.accent, color: "#fff", opacity: rebuilding ? 0.6 : 1 }}>
          <Icon name={rebuilding ? "Loader" : "Sparkles"} size={13} className={rebuilding ? "animate-spin" : ""} />
          {rebuilding ? "Собираю…" : "Пересобрать анализ"}
        </button>
      </div>

      {!hasAnything ? (
        <div className="text-center text-sm py-10" style={{ color: t.textMute }}>
          <Icon name="Sparkles" size={28} className="mx-auto mb-2" style={{ color: t.textMute }} />
          Анализ ещё не собран.<br />
          Он появится автоматически после первого касания или по кнопке «Пересобрать».
        </div>
      ) : (
        <>
          {/* Сводка состояния */}
          {summary && (
            <Card>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon name="User" size={13} style={{ color: t.accentLight }} />
                <span className="text-xs font-bold" style={{ color: t.text }}>Состояние клиента</span>
              </div>
              <div className="text-sm whitespace-pre-wrap" style={{ color: t.textSub }}>{summary}</div>
            </Card>
          )}

          {/* Рекомендация к следующему касанию */}
          {next && (
            <Card>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon name="Lightbulb" size={13} style={{ color: "#eab308" }} />
                <span className="text-xs font-bold" style={{ color: t.text }}>Следующее касание</span>
              </div>
              <div className="text-sm whitespace-pre-wrap" style={{ color: t.textSub }}>{next}</div>
            </Card>
          )}

          {/* Ключевые факты */}
          {keyPoints.length > 0 && (
            <Card>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon name="Key" size={13} style={{ color: "#3b82f6" }} />
                <span className="text-xs font-bold" style={{ color: t.text }}>Ключевые факты</span>
              </div>
              <ul className="flex flex-col gap-1">
                {keyPoints.map((k, i) => (
                  <li key={i} className="text-sm flex items-start gap-1.5" style={{ color: t.textSub }}>
                    <span style={{ color: t.accentLight }}>•</span>{k}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Риски */}
          {risks.length > 0 && (
            <Card>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon name="TriangleAlert" size={13} style={{ color: "#ef4444" }} />
                <span className="text-xs font-bold" style={{ color: t.text }}>Риски</span>
              </div>
              <ul className="flex flex-col gap-1">
                {risks.map((r, i) => (
                  <li key={i} className="text-sm flex items-start gap-1.5" style={{ color: t.textSub }}>
                    <span style={{ color: "#ef4444" }}>•</span>{r}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      <div className="text-[10px] flex items-center gap-1" style={{ color: t.textMute }}>
        <Icon name="MessagesSquare" size={11} /> Касаний в истории: {touchCount}
        {updatedAt && <span>· анализ от {fmtDate(updatedAt)}</span>}
      </div>
    </div>
  );
}
