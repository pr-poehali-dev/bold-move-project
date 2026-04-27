import React, { useState, useMemo } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

export function isEstimate(text: string) {
  return (
    (text.includes("ИТОГО") || text.includes("Econom") || text.includes("Standard") || text.includes("Premium")) &&
    (text.includes("₽") || text.includes("руб"))
  );
}

export function parseEstimateBlocks(text: string) {
  const lines = text.split("\n");
  const blocks: { title: string; numbered: boolean; items: { name: string; value: string }[] }[] = [];
  let current: { title: string; numbered: boolean; items: { name: string; value: string }[] } | null = null;
  const totals: string[] = [];
  let finalPhrase = "";
  let inTotals = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[-–—]{2,}$/.test(line)) continue;

    if (/^(Econom|Standard|Premium)/i.test(line) || inTotals) {
      inTotals = true;
      if (/^(Econom|Standard|Premium)/i.test(line)) {
        totals.push(line);
      } else if (line.toLowerCase().includes("предварительный") || line.toLowerCase().includes("замер")) {
        finalPhrase = line;
        inTotals = false;
      } else {
        totals.push(line);
      }
      continue;
    }

    if (line.toLowerCase().includes("предварительный") || line.toLowerCase().includes("замер") || line.toLowerCase().includes("на какой день")) {
      finalPhrase += (finalPhrase ? " " : "") + line;
      continue;
    }

    if (/итого/i.test(line)) {
      inTotals = true;
      totals.push(line);
      continue;
    }

    const headerMatch = line.match(/^(\d+)\.\s*(.+?):\s*$/);
    if (headerMatch) {
      if (current) blocks.push(current);
      current = { title: headerMatch[2], numbered: true, items: [] };
      continue;
    }

    const headerMatch2 = line.match(/^(\d+)\.\s*(.+?)$/);
    if (headerMatch2 && !line.includes("₽") && !line.includes("руб") && line.length < 50) {
      if (current) blocks.push(current);
      current = { title: headerMatch2[2].replace(/:$/, ""), numbered: true, items: [] };
      continue;
    }

    // Подзаголовок без номера: "Услуги монтажа:" — создаём новый блок
    const subHeaderMatch = line.match(/^([А-ЯЁа-яёA-Za-z][^₽\d:]{2,50}):\s*$/);
    if (subHeaderMatch && !line.includes("₽") && !line.includes("руб")) {
      if (current) blocks.push(current);
      current = { title: subHeaderMatch[1].trim(), numbered: false, items: [] };
      continue;
    }

    if (current) {
      const cleanLine = line.replace(/^[-–—•·]\s*/, "");

      // MUL = любой знак умножения: × (U+00D7), x (latin), х (cyrillic)
      const MUL = "[×xх]";

      // -1) "Название × qty ед.  ИТОГО ₽" — LLM формат без цены за единицу
      // Пример: "MSD Classic матовый × 70 м²  27 930 ₽"
      // НЕ должен срабатывать если после × идёт "qty ед × цена" (это calcBackend формат)
      const llmFormat = cleanLine.match(new RegExp(
        `^(.+?)\\s*${MUL}\\s*([\\d][\\d\\s,.]*)\\s*(м²|м2|мп|пм|шт\\.?|шт|м\\.п\\.?|м)?[\\s\\t]+([\\d][\\d\\s]*)\\s*[₽Рруб]`
      ));
      if (llmFormat && !cleanLine.includes("= ")) {
        const name = llmFormat[1].trim();
        const qty = llmFormat[2].trim();
        const unit = (llmFormat[3] ?? "").trim();
        const totalRaw = llmFormat[4].replace(/\s/g, "");
        current.items.push({ name, value: `${qty}${unit ? " " + unit : ""} = ${totalRaw} ₽` });
        continue;
      }

      // 0) "Название  qty ед × price ₽ = total ₽" — формат нашего бэкенда (двойной пробел между именем и qty)
      const calcBackend = cleanLine.match(new RegExp(
        `^(.+?)\\s{2,}(\\d[\\d\\s,.]*\\s*(?:м²|м2|мп|пм|пог\\.?м|шт\\.?|шт|%|м\\.п\\.?|м)?\\s*${MUL}\\s*[\\d\\s,.]+\\s*[₽Рруб].*)`
      ));
      if (calcBackend) {
        current.items.push({ name: calcBackend[1].trim(), value: calcBackend[2].trim() });
        continue;
      }

      // 1) "Название: qty × price = total Р" (через двоеточие)
      const calcColon = cleanLine.match(new RegExp(`^(.+?):\\s*(\\d[\\d\\s,.]*\\s*[м²шткгмlp.]*\\s*${MUL}.+)$`));
      if (calcColon) {
        current.items.push({ name: calcColon[1].trim(), value: calcColon[2].trim() });
        continue;
      }

      // 2) "Название qty × price = total Р" (без двоеточия, через пробел)
      const calcSpace = cleanLine.match(new RegExp(`^(.+?)\\s+(\\d[\\d\\s,.]*\\s*[м²шткгмlp.]*\\s*${MUL}\\s*[\\d\\s,.]+\\s*[₽Рруб].*)$`));
      if (calcSpace) {
        current.items.push({ name: calcSpace[1].trim(), value: calcSpace[2].trim() });
        continue;
      }

      // 3) "Название = итог Р" (результат без формулы)
      const eqMatch = cleanLine.match(/^(.+?)\s*=\s*([\d][\d\s,.]*\s*[₽Рруб].*)$/);
      if (eqMatch) {
        current.items.push({ name: eqMatch[1].trim(), value: eqMatch[2].trim() });
        continue;
      }

      // 3b) "Название × N ед.  ИТОГО ₽" — LLM пишет qty без цены, итог в конце
      const mulNoPrice = cleanLine.match(new RegExp(
        `^(.+?)\\s*[×xх]\\s*([\\d][\\d\\s,.]*)\\s*(м²|м2|мп|пм|шт\\.?|шт|м\\.п\\.?|м\\b)?[\\s.]*([\\d][\\d\\s]*)\\s*[₽Рруб]`
      ));
      if (mulNoPrice) {
        const name = mulNoPrice[1].trim();
        const qty = mulNoPrice[2].trim();
        const unit = (mulNoPrice[3] ?? "").trim();
        const total = mulNoPrice[4].replace(/\s/g, "");
        current.items.push({ name, value: `${qty}${unit ? " " + unit : ""} = ${total} ₽`.trim() });
        continue;
      }

      // 3c) "Название × N ед." — только количество без итога
      const mulQtyOnly = cleanLine.match(new RegExp(`^(.+?)\\s*[×xх]\\s*([\\d][\\d\\s,.]*)\\s*(м²|м2|мп|пм|шт\\.?|шт|м\\.п\\.?|м\\b)?\\s*$`));
      if (mulQtyOnly) {
        const name = mulQtyOnly[1].trim();
        const qty = mulQtyOnly[2].trim();
        const unit = (mulQtyOnly[3] ?? "").trim();
        current.items.push({ name, value: `${qty}${unit ? " " + unit : ""}`.trim() });
        continue;
      }

      // 4) "Название — цена" или "Название – цена"
      const dashMatch = cleanLine.match(/^(.+?)\s*[-–—]\s*([\d][\d\s,.]*\s*[₽Рруб].*)$/);
      if (dashMatch) {
        current.items.push({ name: dashMatch[1].trim(), value: dashMatch[2].trim() });
        continue;
      }

      // 5) "Название: число Р" (через двоеточие, просто цена)
      const unitMatch = cleanLine.match(/^(.+?)[:\s]+(\d.+[₽Рруб].*)$/);
      if (unitMatch) {
        current.items.push({ name: unitMatch[1].trim().replace(/:$/, ""), value: unitMatch[2].trim() });
        continue;
      }

      current.items.push({ name: cleanLine, value: "" });
    } else {
      if (line.includes("₽")) {
        if (!current) current = { title: "Позиции", items: [] };
        current.items.push({ name: line, value: "" });
      }
    }
  }
  if (current) blocks.push(current);
  return { blocks, totals, finalPhrase };
}

interface LLMItem { name: string; qty: number; price: number; unit?: string; }

const MUL_RE = /[×xх]/;
const UNITS = "м²|м2|мп|пм|пог\\.?м|шт\\.?|шт|%|м\\.п\\.?|м";

export function resolveItem(
  item: { name: string; value: string },
  findItem: (name: string) => LLMItem | undefined
): { cleanName: string; formula: string; total: string } {
  // Чистим название от формул которые туда попали
  const cleanName = item.name
    .replace(new RegExp(`\\s*[×xх]\\s*[\\d][\\d\\s,.]*\\s*[₽Рруб].*$`, "i"), "")
    .replace(new RegExp(`\\s*[×xх]\\s*[\\d][\\d\\s,.]*\\s*(${UNITS})?\\s*$`, "i"), "")
    .replace(/\s*[-–—]\s*$/, "")
    .trim();

  // Если в name была формула — вытаскиваем её
  const nameFormulaMatch = item.name.match(new RegExp(`([×xх]\\s*[\\d][\\d\\s,.]*\\s*[₽Рруб].*)$`, "i"));
  const rawVal = (item.value || (nameFormulaMatch ? nameFormulaMatch[1] : "")).trim();

  if (!rawVal) {
    // Нет формулы в тексте — ищем в JSON items
    const llm = findItem(cleanName);
    if (llm && llm.qty > 0 && llm.price > 0) {
      const unit = llm.unit || "";
      const formula = `${fmtQty(llm.qty)}${unit ? " " + unit : ""} × ${fmtNum(llm.price)} ₽`;
      const total = fmtNum(llm.qty * llm.price) + " ₽";
      return { cleanName, formula, total };
    }
    return { cleanName, formula: "", total: "" };
  }

  // Есть "= ИТОГ" — разбиваем по последнему "="
  const eqIdx = rawVal.lastIndexOf("=");
  if (eqIdx > 0) {
    let formula = rawVal.slice(0, eqIdx).trim();
    const total = rawVal.slice(eqIdx + 1).trim();
    // Убираем мусор из формулы
    formula = formula.replace(/\s*=\s*[\d\s]+[₽Рруб].*$/, "").trim();
    if (!MUL_RE.test(formula)) formula = "";
    return { cleanName, formula, total: ensureRub(total) };
  }

  // "qty ед × price" — считаем итог
  const mulMatch = rawVal.match(new RegExp(
    `^([\\d.,\\s]+)\\s*(${UNITS})?\\s*[×xх]\\s*([\\d.,\\s]+)\\s*[₽Рруб]`, "i"
  ));
  if (mulMatch) {
    const qty = parseFloat(mulMatch[1].replace(/\s/g, "").replace(",", "."));
    const unit = (mulMatch[2] ?? "").trim();
    const price = parseFloat(mulMatch[3].replace(/\s/g, "").replace(",", "."));
    if (!isNaN(qty) && !isNaN(price)) {
      const formula = `${fmtQty(qty)}${unit ? " " + unit : ""} × ${fmtNum(price)} ₽`;
      const total = fmtNum(qty * price) + " ₽";
      return { cleanName, formula, total };
    }
  }

  // Просто итог без формулы
  return { cleanName, formula: "", total: ensureRub(rawVal) };
}

function ensureRub(s: string): string {
  if (!s) return s;
  // Убираем копейки у цен (ровно 2 знака после точки/запятой): "8 307.16 ₽" → "8 307 ₽"
  // НЕ трогаем дроби в qty типа "20,84 м²"
  return s
    .replace(/(\d{3,})[.,]\d{2}(?=\s*[₽Рруб\s]|$)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString("ru-RU") : Math.round(n).toLocaleString("ru-RU");
}

function fmtQty(n: number): string {
  // Для количества оставляем до 2 знаков, но убираем лишние нули
  const rounded = Math.round(n * 100) / 100;
  return rounded % 1 === 0 ? String(rounded) : rounded.toString().replace(".", ",");
}

export default function EstimateTable({ text, items, onSaveRequest }: {
  text: string;
  items?: LLMItem[];
  onSaveRequest?: () => void;
}) {
  const { user, token } = useAuth();
  const parsed = useMemo(() => parseEstimateBlocks(text), [text]);

  // Строим карту name→{qty,price} из items для формулы
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
  const [downloading, setDownloading] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [saveError,   setSaveError]   = useState("");

  const handleDownload = async () => {
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
      if (!res.ok || data.error) throw new Error(data.error || "Ошибка сохранения");
      setSaved(true);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  if (blocks.length === 0) return null;

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="FileSpreadsheet" size={16} className="text-orange-400" />
        <span className="font-montserrat font-bold text-sm text-white">Смета на натяжные потолки</span>
      </div>
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-white/[0.06] border-b border-white/10">
              <th className="text-left px-3 py-2 text-white/40 font-montserrat font-semibold text-[11px] uppercase tracking-wider">Позиция</th>
              <th className="text-right px-3 py-2 text-white/40 font-montserrat font-semibold text-[11px] uppercase tracking-wider w-[160px]">Стоимость</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              let numCounter = 0;
              return blocks.map((block, bi) => {
                if (block.numbered) numCounter++;
                const label = block.numbered ? `${numCounter}. ${block.title}` : block.title;
                return (
                  <React.Fragment key={`block-${bi}`}>
                    <tr className={`${bi > 0 ? "border-t border-white/15" : ""} bg-white/[0.02]`}>
                      <td colSpan={2} className="px-3 pt-3 pb-2 font-montserrat font-bold text-orange-400 text-[13px]">
                        {label}
                      </td>
                    </tr>
                    {block.items.map((item, ii) => {
                      const { cleanName, formula, total } = resolveItem(item, findItem);
                      return (
                        <tr key={`r-${bi}-${ii}`} className={`hover:bg-white/3 transition-colors ${ii > 0 ? "border-t border-white/5" : ""}`}>
                          <td className="px-3 py-2 text-white/80 text-xs leading-snug">{cleanName}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {formula && <div className="text-white/40 text-[11px] font-montserrat leading-snug">{ensureRub(formula)}</div>}
                            {total && <div className="text-orange-400 font-montserrat font-bold text-xs leading-snug">{ensureRub(total)}</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              });
            })()}
          </tbody>
        </table>

        {totals.length > 0 && (
          <div className="border-t border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-rose-500/10 px-3 py-3">
            <div className="space-y-1">
              {totals.map((t, i) => {
                const isHeader = /итогов|итого\s*стоим/i.test(t) && !t.includes("Econom") && !t.includes("Standard") && !t.includes("Premium");
                const isHighlight = /standard/i.test(t);
                if (isHeader) {
                  return (
                    <div key={i} className="text-white/40 font-montserrat text-[10px] mb-0.5 text-right">
                      {t.replace(/:$/, "")}
                    </div>
                  );
                }
                return (
                  <div key={i} className={`flex justify-end text-xs ${isHighlight ? "text-orange-400 font-montserrat font-black text-sm" : "text-white/70"}`}>
                    <span className="text-right mr-3">{t.split(":")[0]}:</span>
                    <span className="font-montserrat font-bold">{ensureRub(t.split(":").slice(1).join(":").trim())}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {finalPhrase && (
        <div className="mt-3 text-[11px] text-white/40 italic leading-relaxed">{finalPhrase}</div>
      )}

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {/* Скачать PDF */}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-xs font-montserrat font-bold px-4 py-2.5 rounded-xl hover:scale-105 transition-transform disabled:opacity-50 shadow-lg shadow-orange-500/20"
        >
          <Icon name="Download" size={14} />
          {downloading ? "Генерация..." : "Скачать смету PDF"}
        </button>

        {/* Сохранить смету (только для авторизованных) */}
        {saved ? (
          <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-montserrat font-bold text-emerald-400 border border-emerald-500/30 bg-emerald-500/10">
            <Icon name="CheckCircle2" size={14} />
            Смета сохранена! Заявка создана
          </div>
        ) : (
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-montserrat font-bold transition-all disabled:opacity-50"
            style={{
              background: user ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.06)",
              border: user ? "1px solid rgba(249,115,22,0.35)" : "1px solid rgba(255,255,255,0.1)",
              color: user ? "#f97316" : "rgba(255,255,255,0.5)",
            }}
          >
            {saving
              ? <><div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Сохраняем...</>
              : <><Icon name={user ? "Bookmark" : "LogIn"} size={14} /> {user ? "Сохранить заявку" : "Войдите, чтобы сохранить"}</>
            }
          </button>
        )}

        {saveError && (
          <span className="text-xs text-red-400">{saveError}</span>
        )}
      </div>

      {/* Модалка сбора контактов после сохранения сметы */}
      {showContact && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: "#16100a", border: "1px solid rgba(249,115,22,0.25)" }}>
            <div className="h-1.5 bg-gradient-to-r from-orange-500 to-rose-500" />
            <div className="p-6">
              {contactDone ? (
                <div className="flex flex-col items-center text-center py-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center mb-3">
                    <Icon name="CheckCircle2" size={28} className="text-emerald-400" />
                  </div>
                  <div className="text-white font-bold text-base mb-1">Данные сохранены!</div>
                  <div className="text-white/40 text-sm">Мы свяжемся с вами в ближайшее время</div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center text-center mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-orange-500/15 flex items-center justify-center mb-3">
                      <Icon name="ClipboardList" size={26} className="text-orange-400" />
                    </div>
                    <div className="text-white font-bold text-base mb-1">Заявка создана!</div>
                    <div className="text-white/40 text-sm leading-relaxed">
                      Укажите контактные данные — запишем на замер и уточним детали
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Ваше имя</label>
                      <input value={contactName} onChange={e => setContactName(e.target.value)}
                        placeholder="Иван Иванов"
                        className="w-full rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(249,115,22,0.25)" }} />
                    </div>
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Номер телефона</label>
                      <input value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                        placeholder="+7 (900) 000-00-00" type="tel"
                        className="w-full rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(249,115,22,0.25)" }} />
                    </div>
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Адрес монтажа</label>
                      <input value={contactAddr} onChange={e => setContactAddr(e.target.value)}
                        placeholder="ул. Пушкина, д. 10, кв. 5"
                        className="w-full rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(249,115,22,0.25)" }} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-5">
                    <button onClick={handleContactSave} disabled={contactSaving}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 bg-gradient-to-r from-orange-500 to-rose-500">
                      {contactSaving ? "Сохраняем..." : "Отправить"}
                    </button>
                    <button onClick={() => setShowContact(false)}
                      className="px-4 py-2.5 rounded-xl text-sm transition"
                      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                      Позже
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}