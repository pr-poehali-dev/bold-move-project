export interface LLMItem { name: string; qty: number; price: number; unit?: string; }

export const MUL_RE = /[×xх]/;
export const UNITS = "м²|м2|мп|пм|пог\\.?м|катушек|катушки|катушка|шт\\.?|шт|%|м\\.п\\.?|м";

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

    const subHeaderMatch = line.match(/^([А-ЯЁа-яёA-Za-z][^₽\d:]{2,50}):\s*$/);
    if (subHeaderMatch && !line.includes("₽") && !line.includes("руб")) {
      if (current) blocks.push(current);
      current = { title: subHeaderMatch[1].trim(), numbered: false, items: [] };
      continue;
    }

    if (current) {
      const cleanLine = line.replace(/^[-–—•·]\s*/, "");
      const MUL = "[×xх]";

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

      const calcBackend = cleanLine.match(new RegExp(
        `^(.+?)\\s{2,}(\\d[\\d\\s,.]*\\s*(?:м²|м2|мп|пм|пог\\.?м|катушек|катушки|катушка|шт\\.?|шт|%|м\\.п\\.?|м)?\\s*${MUL}\\s*[\\d\\s,.]+\\s*[₽Рруб].*)`
      ));
      if (calcBackend) {
        current.items.push({ name: calcBackend[1].trim(), value: calcBackend[2].trim() });
        continue;
      }

      const calcColon = cleanLine.match(new RegExp(`^(.+?):\\s*(\\d[\\d\\s,.]*\\s*[м²шткгмlp.]*\\s*${MUL}.+)$`));
      if (calcColon) {
        current.items.push({ name: calcColon[1].trim(), value: calcColon[2].trim() });
        continue;
      }

      const calcSpace = cleanLine.match(new RegExp(`^(.+?)\\s+(\\d[\\d\\s,.]*\\s*[м²шткгмlp.]*\\s*${MUL}\\s*[\\d\\s,.]+\\s*[₽Рруб].*)$`));
      if (calcSpace) {
        current.items.push({ name: calcSpace[1].trim(), value: calcSpace[2].trim() });
        continue;
      }

      const eqMatch = cleanLine.match(/^(.+?)\s*=\s*([\d][\d\s,.]*\s*[₽Рруб].*)$/);
      if (eqMatch) {
        current.items.push({ name: eqMatch[1].trim(), value: eqMatch[2].trim() });
        continue;
      }

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

      const mulQtyOnly = cleanLine.match(new RegExp(`^(.+?)\\s*[×xх]\\s*([\\d][\\d\\s,.]*)\\s*(м²|м2|мп|пм|шт\\.?|шт|м\\.п\\.?|м\\b)?\\s*$`));
      if (mulQtyOnly) {
        const name = mulQtyOnly[1].trim();
        const qty = mulQtyOnly[2].trim();
        const unit = (mulQtyOnly[3] ?? "").trim();
        current.items.push({ name, value: `${qty}${unit ? " " + unit : ""}`.trim() });
        continue;
      }

      const dashMatch = cleanLine.match(/^(.+?)\s*[-–—]\s*([\d][\d\s,.]*\s*[₽Рруб].*)$/);
      if (dashMatch) {
        current.items.push({ name: dashMatch[1].trim(), value: dashMatch[2].trim() });
        continue;
      }

      const unitMatch = cleanLine.match(/^(.+?)[:\s]+(\d.+[₽Рруб].*)$/);
      if (unitMatch) {
        current.items.push({ name: unitMatch[1].trim().replace(/:$/, ""), value: unitMatch[2].trim() });
        continue;
      }

      current.items.push({ name: cleanLine, value: "" });
    } else {
      if (line.includes("₽")) {
        if (!current) current = { title: "Позиции", numbered: false, items: [] };
        current.items.push({ name: line, value: "" });
      }
    }
  }
  if (current) blocks.push(current);
  return { blocks, totals, finalPhrase };
}

export function ensureRub(s: string): string {
  if (!s) return s;
  return s
    .replace(/(\d{3,})[.,]\d{2}(?=\s*[₽Рруб\s]|$)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function fmtNum(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString("ru-RU") : Math.round(n).toLocaleString("ru-RU");
}

export function fmtQty(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return rounded % 1 === 0 ? String(rounded) : rounded.toString().replace(".", ",");
}

export function resolveItem(
  item: { name: string; value: string },
  findItem: (name: string) => LLMItem | undefined
): { cleanName: string; formula: string; total: string } {
  const cleanName = item.name
    .replace(new RegExp(`\\s*[×xх]\\s*[\\d][\\d\\s,.]*\\s*[₽Рруб].*$`, "i"), "")
    .replace(new RegExp(`\\s*[×xх]\\s*[\\d][\\d\\s,.]*\\s*(${UNITS})?\\s*$`, "i"), "")
    .replace(/\s*[-–—]\s*$/, "")
    .trim();

  const nameFormulaMatch = item.name.match(new RegExp(`([×xх]\\s*[\\d][\\d\\s,.]*\\s*[₽Рруб].*)$`, "i"));
  const rawVal = (item.value || (nameFormulaMatch ? nameFormulaMatch[1] : "")).trim();

  if (!rawVal) {
    const llm = findItem(cleanName);
    if (llm && llm.qty > 0 && llm.price > 0) {
      const unit = llm.unit || "";
      const formula = `${fmtQty(llm.qty)}${unit ? " " + unit : ""} × ${fmtNum(llm.price)} ₽`;
      const total = fmtNum(llm.qty * llm.price) + " ₽";
      return { cleanName, formula, total };
    }
    return { cleanName, formula: "", total: "" };
  }

  const eqIdx = rawVal.lastIndexOf("=");
  if (eqIdx > 0) {
    let formula = rawVal.slice(0, eqIdx).trim();
    const total = rawVal.slice(eqIdx + 1).trim();
    formula = formula.replace(/\s*=\s*[\d\s]+[₽Рруб].*$/, "").trim();
    if (!MUL_RE.test(formula)) formula = "";
    return { cleanName, formula, total: ensureRub(total) };
  }

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

  return { cleanName, formula: "", total: ensureRub(rawVal) };
}