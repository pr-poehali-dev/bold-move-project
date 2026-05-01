import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { PARSE_SITE_URL, AUTH_URL } from "./wlTypes";
import { Section } from "./WLHelpers";
import { getWLToken } from "./WLManagerContext";

interface FilledField  { field: string; label: string; value: string }
interface MissingField { field: string; label: string }
interface ParseReport  { filled: FilledField[]; missing: MissingField[] }

// Стадии: idle → parsed (данные есть, компания ещё не создана) → animating → banner → collapsed
type Phase = "idle" | "parsed" | "animating" | "banner" | "collapsed";

interface Props {
  onCreated?: (companyId: number, token: string) => void;
}

export function WLSiteParser({ onCreated }: Props) {
  const [url, setUrl]             = useState("");
  const [loading, setLoading]     = useState(false);
  const [creating, setCreating]   = useState(false);
  const [report, setReport]       = useState<ParseReport | null>(null);
  const [parsedBrand, setParsedBrand] = useState<Record<string, string> | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [searching, setSearching] = useState<string | null>(null);
  const [notFound,  setNotFound]  = useState<string | null>(null); // поле которое не нашлось
  const [lastCompanyId, setLastCompanyId] = useState<number | null>(null);
  const [lastCompanyName, setLastCompanyName] = useState<string | null>(null);
  const [phase, setPhase]         = useState<Phase>("idle");
  const [visibleCount, setVisibleCount] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => { timersRef.current.forEach(clearTimeout); }, []);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const callParse = async (body: object) => {
    const token = getWLToken();
    const r = await fetch(PARSE_SITE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Authorization": token || "" },
      body: JSON.stringify(body),
    });
    return r.json();
  };

  const startAnimation = (filledCount: number, missingCount: number) => {
    clearTimers();
    setPhase("animating");
    setVisibleCount(0);

    for (let i = 1; i <= filledCount; i++) {
      const t = setTimeout(() => setVisibleCount(i), i * 180);
      timersRef.current.push(t);
    }

    const bannerDelay = filledCount * 180 + 4000;
    const t1 = setTimeout(() => setPhase("banner"), bannerDelay);
    timersRef.current.push(t1);

    if (missingCount === 0) {
      const t2 = setTimeout(() => setPhase("collapsed"), bannerDelay + 2000);
      timersRef.current.push(t2);
    }
  };

  // Шаг 1: парсим сайт, НЕ создаём компанию
  const run = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    clearTimers();
    setLoading(true);
    setReport(null);
    setParsedBrand(null);
    setError(null);
    setLastCompanyId(null);
    setLastCompanyName(null);
    setPhase("idle");
    setVisibleCount(0);
    try {
      const d = await callParse({ url: trimmed, parse_only: true });
      if (d.error) {
        setError(d.error);
      } else {
        setReport(d.report);
        setParsedBrand(d.brand || null);
        setPhase("parsed");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  // Шаг 2: создаём компанию по клику
  const createCompany = async () => {
    const trimmed = url.trim();
    if (!trimmed || !report) return;
    setCreating(true);
    setError(null);
    try {
      const d = await callParse({ url: trimmed });
      if (d.error) {
        setError(d.error);
      } else {
        if (d.company_id && d.token) {
          setLastCompanyId(d.company_id);
          setLastCompanyName(d.brand?.company_name || null);
          setReport(d.report);
          const today = new Date().toISOString().slice(0, 10);
          const masterToken = getWLToken();
          fetch(`${AUTH_URL}?action=admin-update-demo`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Authorization": masterToken },
            body: JSON.stringify({
              demo_id:          d.demo_id,
              next_action:      "Позвонить, уточнить интерес",
              next_action_date: today,
            }),
          }).catch(() => {});
          const wlManagerRaw = localStorage.getItem("wl_manager_token");
          if (wlManagerRaw && d.demo_id) {
            fetch(`${AUTH_URL}?action=wl-assign-company`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Authorization": masterToken },
              body: JSON.stringify({ demo_id: d.demo_id, manager_id: null }),
            })
            .then(r => r.json())
            .then(() => {
              fetch(`${AUTH_URL}?action=wl-me`, { headers: { "X-Authorization": wlManagerRaw } })
                .then(r => r.json())
                .then(me => {
                  if (me.manager?.id) {
                    fetch(`${AUTH_URL}?action=wl-assign-company`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", "X-Authorization": masterToken },
                      body: JSON.stringify({ demo_id: d.demo_id, manager_id: me.manager.id }),
                    }).catch(() => {});
                  }
                }).catch(() => {});
            }).catch(() => {});
          }
          onCreated?.(d.company_id, d.token);
          startAnimation(
            (d.report?.filled  || []).length,
            (d.report?.missing || []).length,
          );
        }
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  };

  // Поиск поля в фазе "parsed" — создаём компанию тихо (без смены фазы), потом ищем
  const searchFieldBeforeCreate = async (field: MissingField) => {
    let cid = lastCompanyId;
    const currentReport = report;
    setNotFound(null);
    if (!cid) {
      setSearching(field.field); // показываем спиннер на пилюле сразу
      try {
        const d = await callParse({ url: url.trim() });
        if (d.error) { setSearching(null); return; } // тихо — дубликат уже показан выше
        if (d.company_id && d.token) {
          cid = d.company_id;
          // Сохраняем только ID и имя — НЕ меняем фазу и НЕ перезаписываем report
          setLastCompanyId(d.company_id);
          setLastCompanyName(d.brand?.company_name || null);
          const today = new Date().toISOString().slice(0, 10);
          const masterToken = getWLToken();
          fetch(`${AUTH_URL}?action=admin-update-demo`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Authorization": masterToken },
            body: JSON.stringify({ demo_id: d.demo_id, next_action: "Позвонить, уточнить интерес", next_action_date: today }),
          }).catch(() => {});
          const wlManagerRaw = localStorage.getItem("wl_manager_token");
          if (wlManagerRaw && d.demo_id) {
            fetch(`${AUTH_URL}?action=wl-assign-company`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Authorization": masterToken },
              body: JSON.stringify({ demo_id: d.demo_id, manager_id: null }),
            }).then(r => r.json()).then(() => {
              fetch(`${AUTH_URL}?action=wl-me`, { headers: { "X-Authorization": wlManagerRaw } })
                .then(r => r.json()).then(me => {
                  if (me.manager?.id) {
                    fetch(`${AUTH_URL}?action=wl-assign-company`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", "X-Authorization": masterToken },
                      body: JSON.stringify({ demo_id: d.demo_id, manager_id: me.manager.id }),
                    }).catch(() => {});
                  }
                }).catch(() => {});
            }).catch(() => {});
          }
          onCreated?.(d.company_id, d.token);
        }
      } catch { setSearching(null); return; }
    } else {
      setSearching(field.field);
    }
    if (!cid) { setSearching(null); return; }
    // Ищем поле — фаза остаётся "parsed", пилюли видны
    try {
      const d = await callParse({ url: url.trim(), company_id: cid, only_field: field.field });
      if (!d.error && d.report) {
        const nowFilled = d.report.filled.find((f: FilledField) => f.field === field.field);
        if (nowFilled && currentReport) {
          setReport({
            filled:  [...currentReport.filled, nowFilled],
            missing: currentReport.missing.filter(m => m.field !== field.field),
          });
        } else {
          // Не нашли — показываем подсказку на пилюле
          setNotFound(field.field);
          setTimeout(() => setNotFound(null), 3000);
        }
      } else {
        setNotFound(field.field);
        setTimeout(() => setNotFound(null), 3000);
      }
    } catch { /* ignore */ }
    finally { setSearching(null); }
  };

  const searchField = async (field: MissingField) => {
    if (!url.trim() || !lastCompanyId) return;
    setSearching(field.field);
    setNotFound(null);
    try {
      const d = await callParse({ url: url.trim(), company_id: lastCompanyId, only_field: field.field });
      if (!d.error && d.report) {
        const nowFilled = d.report.filled.find((f: FilledField) => f.field === field.field);
        if (nowFilled && report) {
          setReport({
            filled:  [...report.filled, nowFilled],
            missing: report.missing.filter(m => m.field !== field.field),
          });
        } else {
          setNotFound(field.field);
          setTimeout(() => setNotFound(null), 3000);
        }
      } else {
        setNotFound(field.field);
        setTimeout(() => setNotFound(null), 3000);
      }
    } catch { /* ignore */ }
    finally { setSearching(null); }
  };

  const reset = () => {
    clearTimers();
    setPhase("idle");
    setReport(null);
    setParsedBrand(null);
    setUrl("");
    setLastCompanyId(null);
    setLastCompanyName(null);
    setVisibleCount(0);
  };

  // Компактный зелёный баннер (collapsed)
  if (phase === "collapsed") {
    return (
      <div
        className="rounded-2xl px-4 py-3 flex items-center gap-3 cursor-pointer transition hover:opacity-80"
        style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}
        onClick={reset}
      >
        <Icon name="CheckCircle2" size={16} style={{ color: "#10b981", flexShrink: 0 }} />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold" style={{ color: "#10b981" }}>
            {lastCompanyName ? `${lastCompanyName} — ID #${lastCompanyId}` : `Компания создана — ID #${lastCompanyId}`}
          </div>
          <div className="text-[10px] text-white/30 mt-0.5">Нажми чтобы спарсить ещё один сайт</div>
        </div>
        <Icon name="RefreshCw" size={12} style={{ color: "rgba(255,255,255,0.2)" }} />
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4" style={{ border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.03)" }}>
    <Section title="Добавить новых" icon="Wand2" color="#f59e0b" collapsible defaultCollapsed>
      <p className="text-[11px] text-white/40 mb-3">
        Введи сайт клиента — AI вытащит все данные и создаст новую демо-компанию
      </p>

      <div className="flex gap-2 mb-3">
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === "Enter" && run()}
          placeholder="например: company.ru или https://company.ru"
          disabled={loading || phase === "animating" || phase === "banner"}
          className="flex-1 rounded-xl px-3 py-2 text-xs font-mono bg-white/[0.05] border border-white/10 text-white placeholder-white/25 outline-none focus:border-amber-500/50 transition disabled:opacity-50"
        />
        <button onClick={run} disabled={loading || !url.trim() || phase === "animating" || phase === "banner"}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition disabled:opacity-40 flex-shrink-0"
          style={{ background: loading ? "rgba(245,158,11,0.15)" : "#f59e0b", color: loading ? "#f59e0b" : "#0a0a14" }}>
          {loading
            ? <><div className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" /> Парсинг...</>
            : <><Icon name="Wand2" size={12} /> Запустить</>
          }
        </button>
      </div>

      {error && (
        <div className="rounded-xl px-3 py-2.5 text-xs"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
          <Icon name="AlertCircle" size={11} className="inline mr-1.5" style={{ color: "#ef4444" }} />
          {error}
        </div>
      )}

      {/* Результат парсинга — перед созданием компании */}
      {report && phase === "parsed" && (
        <div className="space-y-3 mt-1">
          {report.filled.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5"
                style={{ color: "#10b981" }}>
                <Icon name="CheckCircle2" size={11} />
                Заполнено ({report.filled.length}/{report.filled.length + report.missing.length})
              </div>
              <div className="space-y-1.5">
                {report.filled.map(f => (
                  <div key={f.field}
                    className="flex items-start gap-2 rounded-lg px-2.5 py-1.5"
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

          {report.missing.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5"
                style={{ color: "#f59e0b" }}>
                <Icon name="AlertTriangle" size={11} /> Не найдено ({report.missing.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {report.missing.map(f => {
                  const isSearching = searching === f.field;
                  const isNotFound  = notFound === f.field;
                  return (
                    <button key={f.field}
                      onClick={() => searchFieldBeforeCreate(f)}
                      disabled={!!searching}
                      className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg font-medium transition hover:opacity-80 disabled:opacity-50 cursor-pointer"
                      style={isNotFound
                        ? { background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.35)", color: "#f87171" }
                        : { background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.35)", color: "#fbbf24" }
                      }>
                      {isSearching
                        ? <div className="w-2.5 h-2.5 border border-amber-400/40 border-t-amber-400 rounded-full animate-spin flex-shrink-0" />
                        : isNotFound
                          ? <Icon name="X" size={9} />
                          : <Icon name="Search" size={9} />
                      }
                      {isNotFound ? `${f.label} — не найдено` : f.label}
                    </button>
                  );
                })}
              </div>
              <div className="text-[9px] text-white/25 mt-1.5">Нажми чтобы поискать в интернете</div>
            </div>
          )}

          {/* Кнопки действий */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={createCompany}
              disabled={creating}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50"
              style={{ background: creating ? "rgba(16,185,129,0.15)" : "#10b981", color: creating ? "#10b981" : "#0a0a14" }}>
              {creating
                ? <><div className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" /> Создаю...</>
                : <><Icon name="Plus" size={12} /> Создать компанию</>
              }
            </button>
            <button
              onClick={reset}
              disabled={creating}
              className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-bold transition hover:opacity-80 disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Icon name="ChevronUp" size={11} /> Свернуть
            </button>
          </div>
        </div>
      )}

      {/* Анимированный отчёт (после создания) */}
      {report && (phase === "animating" || phase === "banner") && (
        <div className="space-y-3 mt-1">

          {report.filled.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5"
                style={{ color: "#10b981" }}>
                <Icon name="CheckCircle2" size={11} />
                Заполнено ({visibleCount}/{report.filled.length})
              </div>
              <div className="space-y-1.5">
                {report.filled.slice(0, visibleCount).map((f, i) => (
                  <div key={f.field}
                    className="flex items-start gap-2 rounded-lg px-2.5 py-1.5"
                    style={{
                      background: "rgba(16,185,129,0.06)",
                      border: "1px solid rgba(16,185,129,0.18)",
                      animation: "fadeSlideIn 0.3s ease both",
                      animationDelay: `${i * 0}ms`,
                    }}>
                    <Icon name="Check" size={10} className="mt-0.5 flex-shrink-0" style={{ color: "#10b981" }} />
                    <div className="min-w-0">
                      <span className="text-[10px] text-white/40">{f.label}: </span>
                      <span className="text-[11px] text-white/80 font-medium break-all">{f.value}</span>
                    </div>
                  </div>
                ))}
                {report.filled.slice(visibleCount).map(f => (
                  <div key={f.field}
                    className="flex items-start gap-2 rounded-lg px-2.5 py-1.5 opacity-20"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0 bg-white/20" />
                    <div className="text-[10px] text-white/30">{f.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {visibleCount >= report.filled.length && report.missing.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5"
                style={{ color: "#f59e0b" }}>
                <Icon name="AlertTriangle" size={11} /> Не найдено ({report.missing.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {report.missing.map(f => {
                  const isSearching = searching === f.field;
                  const isNotFound  = notFound === f.field;
                  return (
                    <button key={f.field} onClick={() => searchField(f)}
                      disabled={!!searching || !url.trim() || !lastCompanyId}
                      className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg font-medium transition hover:opacity-80 disabled:opacity-50"
                      style={isNotFound
                        ? { background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.35)", color: "#f87171" }
                        : { background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.35)", color: "#fbbf24" }
                      }>
                      {isSearching
                        ? <div className="w-2.5 h-2.5 border border-amber-400/40 border-t-amber-400 rounded-full animate-spin flex-shrink-0" />
                        : isNotFound ? <Icon name="X" size={9} /> : <Icon name="Search" size={9} />
                      }
                      {isNotFound ? `${f.label} — не найдено` : f.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {phase === "banner" && (
            <div className="rounded-xl px-3 py-2.5 flex items-center gap-2"
              style={{
                background: "rgba(16,185,129,0.10)",
                border: "1px solid rgba(16,185,129,0.35)",
                animation: "fadeSlideIn 0.4s ease both",
              }}>
              <Icon name="Sparkles" size={13} style={{ color: "#10b981", flexShrink: 0 }} />
              <div className="flex-1">
                <div className="text-xs font-bold" style={{ color: "#10b981" }}>
                  {lastCompanyName ? `${lastCompanyName} — ID #${lastCompanyId}` : `Компания создана — ID #${lastCompanyId}`}
                </div>
                <div className="text-[10px] text-white/30">
                  {report.missing.length === 0
                    ? "Все поля заполнены — сворачиваю..."
                    : "Доищи недостающие поля выше, потом сверни"}
                </div>
              </div>
              {report.missing.length > 0 && (
                <button onClick={() => setPhase("collapsed")}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition hover:opacity-80 flex-shrink-0"
                  style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
                  <Icon name="ChevronUp" size={10} /> Свернуть
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Обычный режим (не анимация) — для повторного поиска полей */}
      {report && phase === "idle" && (
        <div className="space-y-3 mt-1">
          {report.missing.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5"
                style={{ color: "#f59e0b" }}>
                <Icon name="AlertTriangle" size={11} /> Не найдено — нажми чтобы поискать ({report.missing.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {report.missing.map(f => {
                  const isSearching = searching === f.field;
                  const isNotFound  = notFound === f.field;
                  return (
                    <button key={f.field} onClick={() => searchField(f)}
                      disabled={!!searching || !url.trim() || !lastCompanyId}
                      className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg font-medium transition hover:opacity-80 disabled:opacity-50"
                      style={isNotFound
                        ? { background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.35)", color: "#f87171" }
                        : { background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.35)", color: "#fbbf24" }
                      }>
                      {isSearching
                        ? <div className="w-2.5 h-2.5 border border-amber-400/40 border-t-amber-400 rounded-full animate-spin flex-shrink-0" />
                        : isNotFound ? <Icon name="X" size={9} /> : <Icon name="Search" size={9} />
                      }
                      {isNotFound ? `${f.label} — не найдено` : f.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </Section>
    </div>
  );
}