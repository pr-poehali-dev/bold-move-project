import { useState } from "react";
import Icon from "@/components/ui/icon";
import { PARSE_SITE_URL, DEMO_ID } from "./wlTypes";
import { Section } from "./WLHelpers";

interface FilledField  { field: string; label: string; value: string }
interface MissingField { field: string; label: string }
interface ParseReport  { filled: FilledField[]; missing: MissingField[] }

interface Props {
  companyId?: number;
  onDone?: () => void;
  onParsed?: (domain: string) => void;
}

export function WLSiteParser({ companyId = DEMO_ID, onDone, onParsed }: Props) {
  const [url, setUrl]           = useState("");
  const [loading, setLoading]   = useState(false);
  const [report, setReport]     = useState<ParseReport | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [searching, setSearching] = useState<string | null>(null); // поле которое сейчас ищем

  const callParse = async (body: object) => {
    const token = localStorage.getItem("mp_user_token");
    const r = await fetch(PARSE_SITE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Authorization": token || "" },
      body: JSON.stringify(body),
    });
    return r.json();
  };

  const run = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setReport(null);
    setError(null);
    try {
      const d = await callParse({ url: trimmed, company_id: companyId });
      if (d.error) {
        setError(d.error);
      } else {
        setReport(d.report);
        onDone?.();
        const domain = trimmed.replace(/https?:\/\//, "").split("/")[0];
        onParsed?.(domain);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  // Повторный поиск одного конкретного поля
  const searchField = async (field: MissingField) => {
    if (!url.trim()) return;
    setSearching(field.field);
    try {
      const d = await callParse({ url: url.trim(), company_id: companyId, only_field: field.field });
      if (!d.error && d.report) {
        // Проверяем заполнилось ли поле
        const nowFilled = d.report.filled.find((f: FilledField) => f.field === field.field);
        if (nowFilled && report) {
          setReport({
            filled:  [...report.filled, nowFilled],
            missing: report.missing.filter(m => m.field !== field.field),
          });
        }
      }
    } catch { /* ignore */ }
    finally { setSearching(null); }
  };

  return (
    <Section title="Автозаполнение из сайта" icon="Wand2" color="#f59e0b">
      <p className="text-[11px] text-white/40 mb-3">
        Введи сайт клиента — AI вытащит все данные и заполнит демо-компанию #{companyId}
      </p>

      {/* Ввод URL */}
      <div className="flex gap-2 mb-3">
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === "Enter" && run()}
          placeholder="например: company.ru или https://company.ru"
          disabled={loading}
          className="flex-1 rounded-xl px-3 py-2 text-xs font-mono bg-white/[0.05] border border-white/10 text-white placeholder-white/25 outline-none focus:border-amber-500/50 transition disabled:opacity-50"
        />
        <button onClick={run} disabled={loading || !url.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition disabled:opacity-40 flex-shrink-0"
          style={{ background: loading ? "rgba(245,158,11,0.15)" : "#f59e0b", color: loading ? "#f59e0b" : "#0a0a14" }}>
          {loading
            ? <><div className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" /> Парсинг...</>
            : <><Icon name="Wand2" size={12} /> Запустить</>
          }
        </button>
      </div>

      {/* Ошибка */}
      {error && (
        <div className="rounded-xl px-3 py-2.5 text-xs"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
          <Icon name="AlertCircle" size={11} className="inline mr-1.5" style={{ color: "#ef4444" }} />
          {error}
        </div>
      )}

      {/* Отчёт */}
      {report && (
        <div className="space-y-3 mt-1">

          {/* Заполнено */}
          {report.filled.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5"
                style={{ color: "#10b981" }}>
                <Icon name="CheckCircle2" size={11} /> Заполнено ({report.filled.length})
              </div>
              <div className="space-y-1.5">
                {report.filled.map(f => (
                  <div key={f.field} className="flex items-start gap-2 rounded-lg px-2.5 py-1.5"
                    style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.18)" }}>
                    <Icon name="Check" size={10} className="mt-0.5 flex-shrink-0" style={{ color: "#10b981" }} />
                    <div className="min-w-0">
                      <span className="text-[10px] text-white/40">{f.label}: </span>
                      <span className="text-[11px] text-white/80 font-medium break-all">{f.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Не заполнено — кликабельные пилюли с повторным поиском */}
          {report.missing.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5"
                style={{ color: "#f59e0b" }}>
                <Icon name="AlertTriangle" size={11} /> Не найдено — нажми чтобы поискать ({report.missing.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {report.missing.map(f => {
                  const isSearching = searching === f.field;
                  return (
                    <button
                      key={f.field}
                      onClick={() => searchField(f)}
                      disabled={!!searching || !url.trim()}
                      className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg font-medium transition hover:opacity-80 disabled:opacity-50"
                      style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.35)", color: "#fbbf24" }}
                      title={`Повторно поискать ${f.label}`}>
                      {isSearching
                        ? <div className="w-2.5 h-2.5 border border-amber-400/40 border-t-amber-400 rounded-full animate-spin flex-shrink-0" />
                        : <Icon name="Search" size={9} />
                      }
                      {f.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-white/25 mt-1.5">Нажми на пилюлю — поиск именно этого поля повторно</p>
            </div>
          )}

          {report.missing.length === 0 && (
            <div className="text-[11px] text-center py-1 font-semibold" style={{ color: "#10b981" }}>
              Все поля заполнены!
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
