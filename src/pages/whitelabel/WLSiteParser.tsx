import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { PARSE_SITE_URL, AUTH_URL } from "./wlTypes";
import { Section } from "./WLHelpers";
import { getWLToken } from "./WLManagerContext";
import type { FilledField, MissingField, ParseReport, Phase } from "./WLSiteParserTypes";
import {
  CollapsedBanner,
  ParsedPhase,
  AnimatingPhase,
  IdleWithReportPhase,
} from "./WLSiteParserPhases";

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
  const [notFound,  setNotFound]  = useState<string | null>(null);
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
      setSearching(field.field);
      try {
        const d = await callParse({ url: url.trim() });
        if (d.error) { setSearching(null); return; }
        if (d.company_id && d.token) {
          cid = d.company_id;
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

  if (phase === "collapsed") {
    return (
      <CollapsedBanner
        lastCompanyId={lastCompanyId}
        lastCompanyName={lastCompanyName}
        onReset={reset}
      />
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

      {report && phase === "parsed" && (
        <ParsedPhase
          report={report}
          searching={searching}
          notFound={notFound}
          creating={creating}
          onSearchField={searchFieldBeforeCreate}
          onCreateCompany={createCompany}
          onReset={reset}
        />
      )}

      {report && (phase === "animating" || phase === "banner") && (
        <AnimatingPhase
          report={report}
          phase={phase}
          visibleCount={visibleCount}
          lastCompanyId={lastCompanyId}
          lastCompanyName={lastCompanyName}
          searching={searching}
          notFound={notFound}
          url={url}
          onSearchField={searchField}
          onCollapse={() => setPhase("collapsed")}
        />
      )}

      {report && phase === "idle" && (
        <IdleWithReportPhase
          report={report}
          searching={searching}
          notFound={notFound}
          url={url}
          lastCompanyId={lastCompanyId}
          onSearchField={searchField}
        />
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
