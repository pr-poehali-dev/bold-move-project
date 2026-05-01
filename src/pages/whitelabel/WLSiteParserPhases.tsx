import Icon from "@/components/ui/icon";
import type { ParseReport, MissingField } from "./WLSiteParserTypes";
import { FilledList, MissingPills } from "./WLSiteParserFields";

// ── Фаза "parsed": результат парсинга до создания компании ──────────────────

interface ParsedPhaseProps {
  report: ParseReport;
  searching: string | null;
  notFound: string | null;
  creating: boolean;
  onSearchField: (f: MissingField) => void;
  onCreateCompany: () => void;
  onReset: () => void;
}

export function ParsedPhase({
  report, searching, notFound, creating, onSearchField, onCreateCompany, onReset,
}: ParsedPhaseProps) {
  return (
    <div className="space-y-3 mt-1">
      <FilledList
        filled={report.filled}
        total={report.filled.length + report.missing.length}
      />

      {report.missing.length > 0 && (
        <>
          <MissingPills
            missing={report.missing}
            searching={searching}
            notFound={notFound}
            disabled={creating}
            label={`Не найдено (${report.missing.length})`}
            onSearch={onSearchField}
          />
          <div className="text-[9px] text-white/25 -mt-1">Нажми чтобы поискать в интернете</div>
        </>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCreateCompany}
          disabled={creating}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50"
          style={{ background: creating ? "rgba(16,185,129,0.15)" : "#10b981", color: creating ? "#10b981" : "#0a0a14" }}>
          {creating
            ? <><div className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" /> Создаю...</>
            : <><Icon name="Plus" size={12} /> Создать компанию</>
          }
        </button>
        <button
          onClick={onReset}
          disabled={creating}
          className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-bold transition hover:opacity-80 disabled:opacity-40"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <Icon name="ChevronUp" size={11} /> Свернуть
        </button>
      </div>
    </div>
  );
}

// ── Фаза "animating" / "banner": анимация после создания ────────────────────

interface AnimatingPhaseProps {
  report: ParseReport;
  phase: "animating" | "banner";
  visibleCount: number;
  lastCompanyId: number | null;
  lastCompanyName: string | null;
  searching: string | null;
  notFound: string | null;
  url: string;
  onSearchField: (f: MissingField) => void;
  onCollapse: () => void;
}

export function AnimatingPhase({
  report, phase, visibleCount, lastCompanyId, lastCompanyName,
  searching, notFound, url, onSearchField, onCollapse,
}: AnimatingPhaseProps) {
  return (
    <div className="space-y-3 mt-1">
      <FilledList
        filled={report.filled}
        total={report.filled.length}
        animated
        visibleCount={visibleCount}
      />

      {visibleCount >= report.filled.length && report.missing.length > 0 && (
        <MissingPills
          missing={report.missing}
          searching={searching}
          notFound={notFound}
          disabled={!url.trim() || !lastCompanyId}
          onSearch={onSearchField}
        />
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
              {lastCompanyName
                ? `${lastCompanyName} — ID #${lastCompanyId}`
                : `Компания создана — ID #${lastCompanyId}`}
            </div>
            <div className="text-[10px] text-white/30">
              {report.missing.length === 0
                ? "Все поля заполнены — сворачиваю..."
                : "Доищи недостающие поля выше, потом сверни"}
            </div>
          </div>
          {report.missing.length > 0 && (
            <button onClick={onCollapse}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition hover:opacity-80 flex-shrink-0"
              style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
              <Icon name="ChevronUp" size={10} /> Свернуть
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Фаза "idle" с отчётом: повторный поиск полей ────────────────────────────

interface IdleWithReportPhaseProps {
  report: ParseReport;
  searching: string | null;
  notFound: string | null;
  url: string;
  lastCompanyId: number | null;
  onSearchField: (f: MissingField) => void;
}

export function IdleWithReportPhase({
  report, searching, notFound, url, lastCompanyId, onSearchField,
}: IdleWithReportPhaseProps) {
  if (report.missing.length === 0) return null;
  return (
    <div className="space-y-3 mt-1">
      <MissingPills
        missing={report.missing}
        searching={searching}
        notFound={notFound}
        disabled={!url.trim() || !lastCompanyId}
        label={`Не найдено — нажми чтобы поискать (${report.missing.length})`}
        onSearch={onSearchField}
      />
    </div>
  );
}

// ── Компактный баннер "collapsed" ───────────────────────────────────────────

interface CollapsedBannerProps {
  lastCompanyId: number | null;
  lastCompanyName: string | null;
  onReset: () => void;
}

export function CollapsedBanner({ lastCompanyId, lastCompanyName, onReset }: CollapsedBannerProps) {
  return (
    <div
      className="rounded-2xl px-4 py-3 flex items-center gap-3 cursor-pointer transition hover:opacity-80"
      style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}
      onClick={onReset}
    >
      <Icon name="CheckCircle2" size={16} style={{ color: "#10b981", flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold" style={{ color: "#10b981" }}>
          {lastCompanyName
            ? `${lastCompanyName} — ID #${lastCompanyId}`
            : `Компания создана — ID #${lastCompanyId}`}
        </div>
        <div className="text-[10px] text-white/30 mt-0.5">Нажми чтобы спарсить ещё один сайт</div>
      </div>
      <Icon name="RefreshCw" size={12} style={{ color: "rgba(255,255,255,0.2)" }} />
    </div>
  );
}
