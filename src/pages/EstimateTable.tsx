import { useState, useMemo } from "react";
import { useAuth, CLIENT_ROLES } from "@/context/AuthContext";
import func2url from "@/../backend/func2url.json";
import { parseEstimateBlocks, type LLMItem } from "./estimateUtils";
import EstimateBody from "./EstimateBody";
import EstimateActions from "./EstimateActions";
import EstimateContactModal from "./EstimateContactModal";
import AuthModal from "@/components/AuthModal";

export { isEstimate, parseEstimateBlocks, resolveItem } from "./estimateUtils";

const AUTH_URL = (func2url as Record<string, string>)["auth"];
const CRM_URL  = (func2url as Record<string, string>)["crm-manager"];

export default function EstimateTable({ text, items, onSaveRequest }: {
  text: string;
  items?: LLMItem[];
  onSaveRequest?: () => void;
}) {
  const { user, token } = useAuth();
  const parsed = useMemo(() => parseEstimateBlocks(text), [text]);

  const [showContact,   setShowContact]   = useState(false);
  const [contactName,   setContactName]   = useState("");
  const [contactPhone,  setContactPhone]  = useState("");
  const [contactAddr,   setContactAddr]   = useState("");
  const [contactSaving, setContactSaving] = useState(false);
  const [contactDone,   setContactDone]   = useState(false);
  const [savedChatId,   setSavedChatId]   = useState<number | null>(null);

  const itemMap = useMemo(() => {
    if (!items) return new Map<string, LLMItem>();
    const m = new Map<string, LLMItem>();
    for (const it of items) m.set(it.name.toLowerCase(), it);
    return m;
  }, [items]);

  const findItem = (name: string): LLMItem | undefined => {
    const nl = name.toLowerCase();
    if (itemMap.has(nl)) return itemMap.get(nl);
    for (const [k, v] of itemMap) {
      if (nl.includes(k) || k.includes(nl)) return v;
    }
    return undefined;
  };

  const { blocks, totals, finalPhrase } = parsed;
  const [downloading,   setDownloading]   = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [saveError,     setSaveError]     = useState("");
  const [showAuthForPdf, setShowAuthForPdf] = useState(false);

  const handleDownload = async () => {
    if (!user) { setShowAuthForPdf(true); return; }
    setDownloading(true);
    try {
      const { generateEstimatePdf } = await import("./estimatePdf");
      await generateEstimatePdf(parsed);
    } catch {
      /* fallback */
    } finally {
      setDownloading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !token) { onSaveRequest?.(); return; }
    setSaving(true); setSaveError("");
    try {
      const res  = await fetch(`${AUTH_URL}?action=save-estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": `Bearer ${token}` },
        body: JSON.stringify({ blocks, totals, finalPhrase }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        const msg = data.error || "Ошибка сохранения";
        // Нет смет на балансе или истёк триал → отправляем на тарифы
        if (res.status === 403 && /смет|пробн/i.test(msg)) {
          setSaveError(msg + " Перенаправляем на страницу тарифов…");
          setTimeout(() => { window.location.href = "/pricing"; }, 1500);
          return;
        }
        throw new Error(msg);
      }
      setSaved(true);
      setSavedChatId(data.chat_id ?? null);
      setShowContact(true);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const handleContactSave = async () => {
    setContactSaving(true);
    try {
      if (savedChatId && token) {
        await fetch(`${CRM_URL}?r=clients&id=${savedChatId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-Authorization": `Bearer ${token}` },
          body: JSON.stringify({
            client_name: contactName || undefined,
            phone:       contactPhone || undefined,
            address:     contactAddr || undefined,
          }),
        });
      }
      setContactDone(true);
      setTimeout(() => {
        const isClient = !user?.role || CLIENT_ROLES.includes(user.role);
        window.location.href = isClient
          ? `/my-orders`
          : `/company?order=${savedChatId}`;
      }, 1200);
    } finally {
      setContactSaving(false);
    }
  };

  if (blocks.length === 0) return null;

  return (
    <div className="w-full">
      <EstimateBody
        blocks={blocks}
        totals={totals}
        finalPhrase={finalPhrase}
        findItem={findItem}
      />
      <EstimateActions
        user={user}
        saved={saved}
        saving={saving}
        downloading={downloading}
        saveError={saveError}
        onDownload={handleDownload}
        onSave={handleSave}
      />
      <EstimateContactModal
        show={showContact}
        done={contactDone}
        saving={contactSaving}
        name={contactName}
        phone={contactPhone}
        addr={contactAddr}
        onChangeName={setContactName}
        onChangePhone={setContactPhone}
        onChangeAddr={setContactAddr}
        onSave={handleContactSave}
        onClose={() => setShowContact(false)}
      />
      {showAuthForPdf && (
        <AuthModal
          onClose={() => setShowAuthForPdf(false)}
          defaultTab="register"
          onSuccess={() => { setShowAuthForPdf(false); handleDownload(); }}
          onPending={() => setShowAuthForPdf(false)}
        />
      )}
    </div>
  );
}