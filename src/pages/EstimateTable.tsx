import { useState, useMemo } from "react";
import { isPhoneValid } from "@/hooks/use-phone";
import { useAuth, CLIENT_ROLES } from "@/context/AuthContext";
import { useBrand } from "@/context/BrandContext";
import func2url from "@/../backend/func2url.json";
import { parseEstimateBlocks, resolveItem, type LLMItem } from "./estimateUtils";
import { usePricing } from "./usePrices";
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
  const { brand, isCustom } = useBrand();
  const parsed = useMemo(() => parseEstimateBlocks(text), [text]);
  const { blocks } = parsed;

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

  const pricing = usePricing();

  // Считаем итог сами из позиций — суммируем qty × price по всем блокам
  const computedTotals = useMemo(() => {
    let standard = 0;
    for (const block of blocks) {
      for (const item of block.items) {
        const { formula, total } = resolveItem(item, findItem);
        if (!formula && !total) continue;
        // Извлекаем число из total ("1 200 ₽" → 1200)
        const totalStr = total || "";
        const num = parseFloat(totalStr.replace(/\s/g, "").replace("₽", "").replace(",", "."));
        if (!isNaN(num) && num > 0) standard += num;
      }
    }
    if (standard === 0) return parsed.totals; // fallback на AI-текст если не удалось посчитать
    const econom   = Math.round(standard * pricing.econom_mult);
    const premium  = Math.round(standard * pricing.premium_mult);
    const fmt = (n: number) => n.toLocaleString("ru-RU") + " ₽";
    return [
      `${pricing.econom_label}:   ${fmt(econom)}`,
      `${pricing.standard_label}: ${fmt(standard)}`,
      `${pricing.premium_label}:  ${fmt(premium)}`,
    ];
  }, [blocks, findItem, pricing, parsed.totals]);

  const [downloading,   setDownloading]   = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [saveError,     setSaveError]     = useState("");
  const [showAuthForPdf, setShowAuthForPdf] = useState(false);

  const { finalPhrase } = parsed;
  const totals = computedTotals;

  const handleDownload = async () => {
    if (!user) { setShowAuthForPdf(true); return; }
    setDownloading(true);
    try {
      const { generateEstimatePdf } = await import("./estimatePdf");
      // WL-компания (isCustom) → бренд из BrandContext (загружен по ?c=ID)
      // Авторизованный бизнес → только данные из его профиля, без fallback на DEFAULT_BRAND
      const pdfBrand = isCustom ? brand : (user?.brand ? {
        ...brand,                          // базовые поля (логотип MosPotolki и т.п.)
        company_name:       user.company_name                  || undefined,
        support_phone:      user.brand.support_phone           || undefined,
        website:            user.brand.website                 || undefined,
        pdf_footer_address: user.brand.pdf_footer_address || user.company_addr || undefined,
        working_hours:      user.brand.working_hours           || undefined,
        telegram_url:       user.brand.telegram_url            || undefined,
        brand_color:        user.brand.brand_color             || brand.brand_color,
        brand_logo_url:     user.brand.brand_logo_url          || brand.brand_logo_url,
        pdf_text_color:     user.brand.pdf_text_color          || brand.pdf_text_color,
      } : brand);
      await generateEstimatePdf(parsed, { brand: pdfBrand, isCustom });
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
      // Если пришли из CRM через агента — обновляем существующую заявку
      const linkedRaw = localStorage.getItem("crm_linked_session");
      if (linkedRaw) {
        const linked = JSON.parse(linkedRaw) as { chat_id: number; session_id: string; client_name: string; phone: string; address: string };
        // Сохраняем смету в backend (без создания новой заявки — просто сохраняем estimate)
        const res = await fetch(`${AUTH_URL}?action=save-estimate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Authorization": `Bearer ${token}` },
          body: JSON.stringify({ blocks, totals, finalPhrase, linked_chat_id: linked.chat_id }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          const msg = data.error || "Ошибка сохранения";
          if (res.status === 403 && /смет|пробн/i.test(msg)) {
            setSaveError(msg + " Перенаправляем на страницу тарифов…");
            setTimeout(() => { window.location.href = "/pricing"; }, 1500);
            return;
          }
          throw new Error(msg);
        }
        // Обновляем заявку суммой из сметы
        const sumMatch = totals.join(" ").match(/Standard[:\s]*([0-9\s]+)/i);
        const contractSum = sumMatch ? parseInt(sumMatch[1].replace(/\s/g, ""), 10) : 0;
        if (contractSum > 0) {
          await fetch(`${CRM_URL}?r=clients&id=${linked.chat_id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "X-Authorization": `Bearer ${token}` },
            body: JSON.stringify({ contract_sum: contractSum }),
          });
        }
        // Чистим флаг и переходим в CRM к этой заявке
        localStorage.removeItem("crm_linked_session");
        setSaved(true);
        setTimeout(() => {
          window.location.href = `/crm?order=${linked.chat_id}`;
        }, 800);
        return;
      }

      // Обычный сценарий — создаём новую заявку
      const res  = await fetch(`${AUTH_URL}?action=save-estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": `Bearer ${token}` },
        body: JSON.stringify({ blocks, totals, finalPhrase }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        const msg = data.error || "Ошибка сохранения";
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
          : `/crm?order=${savedChatId}`;
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
        user={user}
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