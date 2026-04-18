import { useState, useMemo } from "react";
import Icon from "@/components/ui/icon";

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

      // 0) "Название ПРОБЕЛ qty(ед) × price ₽ = total ₽" — формат нашего бэкенда
      //    Название заканчивается перед числом+единицей измерения (мп, пм, м², шт.)
      const calcBackend = cleanLine.match(new RegExp(
        `^(.+?)\\s+(\\d[\\d\\s,.]*\\s*(?:м²|м2|мп|пм|шт\\.?|м)\\s*${MUL}\\s*[\\d\\s,.]+\\s*[₽Рруб].*)`
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

      // 3b) "Название × N ед." без цены — LLM пишет qty без price
      // Пример: "MSD Classic матовый × 41 м²   16 359 ₽" (цена в конце после пробелов)
      const mulNoPrice = cleanLine.match(new RegExp(
        `^(.+?)\\s+[×xх]\\s+([\\d][\\d\\s,.]*)\\s*(м²|м2|мп|пм|шт\\.?|м)?\\s+(\\d[\\d\\s]*)\\s*[₽Рруб]`
      ));
      if (mulNoPrice) {
        const name = mulNoPrice[1].trim();
        const qty = mulNoPrice[2].trim();
        const unit = mulNoPrice[3] ?? "";
        const total = mulNoPrice[4].replace(/\s/g, "");
        current.items.push({ name, value: `${qty} ${unit} = ${total} ₽`.trim() });
        continue;
      }

      // 3c) "Название × N ед." — только количество, без итога (вычислить нельзя — показываем как есть)
      const mulQtyOnly = cleanLine.match(new RegExp(`^(.+?)\\s+[×xх]\\s+([\\d][\\d\\s,.]*)\\s*(м²|м2|мп|пм|шт\\.?|м)?\\s*$`));
      if (mulQtyOnly) {
        const name = mulQtyOnly[1].trim();
        const qty = mulQtyOnly[2].trim();
        const unit = mulQtyOnly[3] ?? "";
        current.items.push({ name, value: `${qty} ${unit}`.trim() });
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

export default function EstimateTable({ text }: { text: string }) {
  const parsed = useMemo(() => parseEstimateBlocks(text), [text]);
  const { blocks, totals, finalPhrase } = parsed;
  const [downloading, setDownloading] = useState(false);

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
            <tr className="bg-white/8">
              <th className="text-left px-3 py-2 text-white/50 font-montserrat font-semibold">Позиция</th>
              <th className="text-right px-3 py-2 text-white/50 font-montserrat font-semibold w-[180px]">Стоимость</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              let numCounter = 0;
              return blocks.map((block, bi) => {
                if (block.numbered) numCounter++;
                const label = block.numbered ? `${numCounter}. ${block.title}` : block.title;
                return (
                  <>
                    <tr key={`h-${bi}`} className={bi > 0 ? "border-t border-white/10" : ""}>
                      <td colSpan={2} className="px-3 pt-3 pb-1.5 font-montserrat font-bold text-orange-400 text-xs">
                        {label}
                      </td>
                    </tr>
                    {block.items.map((item, ii) => {
                      const cleanName = item.name.replace(/\s*[-–—]\s*$/, "").replace(/\s*\([^)]*\)\s*$/, "").trim();
                      const val = item.value.trim();
                      let formula = "";
                      let total = val;

                      // Вариант 1: есть "= ИТОГ" — берём последний "="
                      const eqIdx = val.lastIndexOf("=");
                      if (eqIdx > 0) {
                        formula = val.slice(0, eqIdx).trim();
                        total   = val.slice(eqIdx + 1).trim();
                      } else {
                        // Вариант 2: "A × B ₽" без итога — вычисляем сами
                        const mulMatch = val.match(/^([\d.,\s]+)\s*[×xх]\s*([\d.,\s]+)\s*[₽Рруб]/);
                        if (mulMatch) {
                          const a = parseFloat(mulMatch[1].replace(/\s/g, "").replace(",", "."));
                          const b = parseFloat(mulMatch[2].replace(/\s/g, "").replace(",", "."));
                          if (!isNaN(a) && !isNaN(b)) {
                            formula = val.replace(/\s*[₽Рруб].*$/, " ₽").trim();
                            total   = new Intl.NumberFormat("ru-RU").format(Math.round(a * b)) + " ₽";
                          }
                        }
                      }

                      // Чистим формулу от лишнего "= ..." в конце если осталось
                      formula = formula.replace(/\s*=\s*[\d\s]+[₽Рруб].*$/, "").trim();

                      return (
                        <tr key={`r-${bi}-${ii}`} className={`hover:bg-white/3 transition-colors ${ii > 0 ? "border-t border-white/5" : ""}`}>
                          <td className="px-3 py-1.5 text-white/70">{cleanName}</td>
                          <td className="px-3 py-1.5 text-right">
                            {formula && <div className="text-white/50 text-[11px] font-montserrat leading-snug">{formula}</div>}
                            <div className="text-orange-400 font-montserrat font-bold text-xs leading-snug">{total}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </>
                );
              });
            })()}
          </tbody>
        </table>

        {totals.length > 0 && (
          <div className="border-t border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-rose-500/10 px-3 py-3">
            <div className="text-[11px] text-white/40 font-montserrat uppercase tracking-widest mb-2">Итого</div>
            <div className="space-y-1">
              {totals.map((t, i) => {
                const isHighlight = /standard|итого/i.test(t);
                return (
                  <div key={i} className={`flex justify-between text-xs ${isHighlight ? "text-orange-400 font-montserrat font-black text-sm" : "text-white/70"}`}>
                    <span>{t.split(":")[0]}:</span>
                    <span className="font-montserrat font-bold">{t.split(":").slice(1).join(":").trim()}</span>
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

      <button
        onClick={handleDownload}
        disabled={downloading}
        className="mt-3 inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-xs font-montserrat font-bold px-4 py-2.5 rounded-xl hover:scale-105 transition-transform disabled:opacity-50 shadow-lg shadow-orange-500/20"
      >
        <Icon name="Download" size={14} />
        {downloading ? "Генерация..." : "Скачать смету PDF"}
      </button>
    </div>
  );
}