import Icon from "@/components/ui/icon";
import { AUTH_URL, AI_URL, PDF_URL } from "./wlTypes";
import type { CheckResult } from "./wlTypes";
import { TestRow } from "./WLHelpers";

interface Props {
  results: Record<string, CheckResult | null>;
  running: string | null;
  apiTestId: number;
  onClose: () => void;
  onSetResult: (key: string, r: CheckResult | null) => void;
  onSetRunning: (id: string | null) => void;
  onSetResults: (r: Record<string, CheckResult | null>) => void;
  onSetApiTestId: (id: number) => void;
}

export function useApiChecks(
  setResult: (key: string, r: CheckResult | null) => void,
  setRunning: (id: string | null) => void,
) {
  const check_brandApi = async (cid: number) => {
    setRunning("brand-api"); setResult("brand-api", null);
    try {
      const r = await fetch(`${AUTH_URL}?action=get-brand&company_id=${cid}`);
      const d = await r.json();
      if (d.brand?.bot_name) {
        setResult("brand-api", { ok: true, label: `Бренд получен: бот «${d.brand.bot_name}», цвет ${d.brand.brand_color}, телефон ${d.brand.support_phone}` });
      } else {
        setResult("brand-api", { ok: false, label: "Бренд не вернулся (компания не активна?)" });
      }
    } catch (e) { setResult("brand-api", { ok: false, label: String(e) }); }
    finally { setRunning(null); }
  };

  const check_aiChat = async (cid: number) => {
    setRunning("ai-chat"); setResult("ai-chat", null);
    try {
      const r = await fetch(AI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Id": "wl-test" },
        body: JSON.stringify({ messages: [{ role: "user", text: "телефон" }], fast: true, company_id: cid }),
      });
      const d = await r.json();
      const ans = String(d.answer || "");
      const hasOld = ans.includes("977 606-89-01") || ans.includes("977) 606-89-01");
      if (!hasOld && ans.length > 0) {
        setResult("ai-chat", { ok: true, label: "Бот ответил без дефолтного номера MosPotolki ✓", data: ans.slice(0, 200) });
      } else if (hasOld) {
        setResult("ai-chat", { ok: false, label: "Бот вернул дефолтный телефон вместо бренда", data: ans.slice(0, 200) });
      } else {
        setResult("ai-chat", { ok: true, label: "Ответ получен", data: ans.slice(0, 200) });
      }
    } catch (e) { setResult("ai-chat", { ok: false, label: String(e) }); }
    finally { setRunning(null); }
  };

  const check_pdf = async (cid: number) => {
    setRunning("pdf"); setResult("pdf", null);
    try {
      const r = await fetch(PDF_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: [{ title: "Тест", numbered: false, items: [{ name: "Демо позиция", value: "1 шт × 1000 ₽ = 1000 ₽" }] }],
          totals: ["Standard: 1000 ₽"],
          finalPhrase: "",
          company_id: cid,
        }),
      });
      const d = await r.json();
      if (d.pdf && d.pdf.length > 1000) {
        const bytes = Uint8Array.from(atob(d.pdf), c => c.charCodeAt(0));
        const blob  = new Blob([bytes], { type: "application/pdf" });
        const url   = URL.createObjectURL(blob);
        setResult("pdf", { ok: true, label: `PDF сгенерирован (${Math.round(d.pdf.length / 1024)} KB)`, data: url });
        window.open(url, "_blank");
      } else {
        setResult("pdf", { ok: false, label: "PDF не сгенерирован" });
      }
    } catch (e) { setResult("pdf", { ok: false, label: String(e) }); }
    finally { setRunning(null); }
  };

  return { check_brandApi, check_aiChat, check_pdf };
}

export function WLApiTestsModal({ results, running, apiTestId, onClose, onSetResult, onSetRunning, onSetResults, onSetApiTestId }: Props) {
  const { check_brandApi, check_aiChat, check_pdf } = useApiChecks(onSetResult, onSetRunning);

  const runAll = async (cid: number) => {
    onSetApiTestId(cid);
    onSetResults({ "brand-api": null, "ai-chat": null, "pdf": null });
    await check_brandApi(cid);
    await check_aiChat(cid);
    await check_pdf(cid);
  };

  if (Object.keys(results).length === 0) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999] px-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2">
            <Icon name="Beaker" size={14} style={{ color: "#fbbf24" }} />
            <span className="text-sm font-black uppercase tracking-wider" style={{ color: "#fbbf24" }}>
              Тесты API — ID #{apiTestId}
            </span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition p-1">
            <Icon name="X" size={14} />
          </button>
        </div>
        <div className="p-4 space-y-2.5">
          <TestRow id="brand-api" name="get-brand: бренд компании"
            onRun={() => check_brandApi(apiTestId)} running={running} result={results["brand-api"]} />
          <TestRow id="ai-chat" name="AI-чат: подмена контактов на бренд"
            onRun={() => check_aiChat(apiTestId)} running={running} result={results["ai-chat"]} />
          <TestRow id="pdf" name="generate-pdf: PDF с брендом компании"
            onRun={() => check_pdf(apiTestId)} running={running} result={results["pdf"]} />
        </div>
        <div className="px-4 pb-4">
          <button onClick={() => runAll(apiTestId)} disabled={!!running}
            className="w-full py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "#fbbf24", color: "#0a0a14" }}>
            <Icon name="RotateCcw" size={12} /> Прогнать заново
          </button>
        </div>
      </div>
    </div>
  );
}
