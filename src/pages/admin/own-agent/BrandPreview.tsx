import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useAuth, type Brand } from "@/context/AuthContext";
import func2url from "@/../backend/func2url.json";

interface Props {
  brand: Brand;
  isDark: boolean;
}

/**
 * Мини-превью «как клиент увидит сайт» — обновляется в реальном времени
 * по мере заполнения формы редактирования бренда.
 */
const PDF_URL = (func2url as Record<string, string>)["generate-pdf"];

// Тестовые данные расчёта (пример: натяжной потолок 20 м²)
const DEMO_ESTIMATE = {
  blocks: [
    {
      title: "1. Полотно",
      numbered: true,
      items: [
        { name: "Натяжной потолок белый матовый MSD Classic", value: "20 м² × 399 ₽ = 7 980 ₽" },
        { name: "Раскрой ПВХ",                               value: "20 м² × 25 ₽ = 500 ₽"   },
      ],
    },
    {
      title: "2. Профиль",
      numbered: true,
      items: [
        { name: "Профиль настенный алюминий", value: "18 п.м × 90 ₽ = 1 620 ₽" },
      ],
    },
    {
      title: "3. Монтаж",
      numbered: true,
      items: [
        { name: "Монтаж натяжного потолка", value: "20 м² × 180 ₽ = 3 600 ₽" },
        { name: "Монтаж профиля",           value: "18 п.м × 40 ₽ = 720 ₽"   },
      ],
    },
  ],
  totals: [
    "Econom: 12 100 ₽",
    "Standard: 14 420 ₽",
    "Premium: 18 313 ₽",
  ],
  finalPhrase: "На какой день вас записать на бесплатный замер?",
};

export default function BrandPreview({ brand, isDark }: Props) {
  const { user } = useAuth();
  const [downloading, setDownloading] = useState(false);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const resp = await fetch(PDF_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...DEMO_ESTIMATE,
          brand: {
            company_name:       user?.company_name || "Ваша компания",
            brand_logo_url:     brand.brand_logo_url || "",
            brand_logo_url_dark: brand.brand_logo_url_dark || "",
            brand_logo_orientation: brand.brand_logo_orientation || "auto",
            pdf_logo_bg:        brand.pdf_logo_bg || "auto",
            brand_color:        brand.brand_color || "#f97316",
            pdf_text_color:     brand.pdf_text_color || "#111827",
            support_phone:      brand.support_phone || "",
            website:            user?.website || "",
            telegram:           brand.telegram_url || "",
            max_url:            brand.max_url || "",
            working_hours:      brand.working_hours || "",
            pdf_footer_address: brand.pdf_footer_address || "",
          },
        }),
      });
      if (!resp.ok) throw new Error("Ошибка генерации");
      const data = await resp.json();
      if (!data.pdf) throw new Error("Нет PDF");
      const bytes = Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0));
      const blob  = new Blob([bytes], { type: "application/pdf" });
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement("a");
      a.href      = url;
      a.download  = "смета-пример.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Не удалось сгенерировать PDF. Попробуй позже.");
    } finally {
      setDownloading(false);
    }
  };

  const accent      = brand.brand_color  || "#f97316";
  const pdfText     = brand.pdf_text_color || "#111827";
  const logoUrl     = brand.brand_logo_url || "https://cdn.poehali.dev/files/7105828c-c33e-48f9-ac90-02134e3cd4d7.png";
  const avatarUrl   = brand.bot_avatar_url || "https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/files/60e2335c-4916-41e5-b894-7f4d9ca6a923.jpg";
  const botName     = brand.bot_name || "Женя";
  const greeting    = brand.bot_greeting || "Привет! Я Женя — ваш персональный консультант 👋";
  const companyName = user?.company_name || "Ваша компания";

  const muted   = isDark ? "rgba(255,255,255,0.45)" : "#6b7280";
  const border  = isDark ? "rgba(255,255,255,0.07)" : "#e5e7eb";
  const sectBg  = isDark ? "rgba(255,255,255,0.025)" : "#ffffff";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
          style={{ color: muted }}>
          <Icon name="Eye" size={11} />
          Так увидит клиент
        </div>
        <a href={user?.id ? `/?c=${user.id}` : "/"} target="_blank" rel="noreferrer"
          className="text-[10px] font-bold flex items-center gap-1 transition"
          style={{ color: accent }}>
          <Icon name="ExternalLink" size={10} />
          Открыть
        </a>
      </div>

      {/* Mac-style окно */}
      <div className="rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#0b0b11", border: `1px solid ${border}` }}>

        {/* Тулбар */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b"
          style={{ background: "rgba(255,255,255,0.025)", borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <div className="flex-1 text-center text-[9px] text-white/35 font-mono truncate">
            mospotolki.ru/?c={user?.id ?? "—"}
          </div>
        </div>

        {/* Шапка сайта */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.05]">
          <img src={logoUrl} alt="" className="w-5 h-5 object-contain" />
          <span className="font-black text-xs tracking-wide truncate text-white max-w-[140px]"
            style={{ color: accent }}>
            {companyName}
          </span>
          <div className="ml-auto flex gap-1">
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold"
              style={{ background: `${accent}26`, color: accent }}>
              <Icon name="Send" size={8} className="inline" />
            </span>
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold"
              style={{ background: `${accent}26`, color: accent }}>
              <Icon name="Phone" size={8} className="inline" />
            </span>
          </div>
        </div>

        {/* Чат с приветствием */}
        <div className="px-3 py-3" style={{ background: "#0b0b11" }}>
          <div className="flex items-end gap-2 mb-2">
            <img src={avatarUrl} alt={botName}
              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
              style={{ border: `2px solid ${accent}33` }} />
            <div className="flex-1 rounded-2xl rounded-bl-md px-3 py-2"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-[10.5px] text-white/85 leading-snug whitespace-pre-line">
                {greeting}
              </div>
            </div>
          </div>

          {/* Пример сообщения клиента */}
          <div className="flex justify-end mb-2">
            <div className="max-w-[75%] rounded-2xl rounded-br-md px-3 py-1.5"
              style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="text-[10.5px] text-white/85">Здравствуйте, посчитайте потолок</div>
            </div>
          </div>

          {/* Имитация ответа */}
          <div className="flex items-end gap-2">
            <img src={avatarUrl} alt={botName}
              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
              style={{ border: `2px solid ${accent}33` }} />
            <div className="rounded-2xl rounded-bl-md px-3 py-1.5 flex items-center gap-1"
              style={{ background: "rgba(255,255,255,0.04)" }}>
              <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: accent }} />
              <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: accent, animationDelay: "0.15s" }} />
              <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: accent, animationDelay: "0.3s" }} />
              <span className="text-[9px] text-white/40 ml-1">{botName} анализирует…</span>
            </div>
          </div>
        </div>

        {/* Кнопки контактов */}
        <div className="px-3 py-2.5 border-t border-white/[0.05] flex gap-1.5"
          style={{ background: "rgba(255,255,255,0.015)" }}>
          {[
            { icon: "Phone", label: "Позвонить" },
            { icon: "Send",  label: "Telegram" },
            { icon: "MessageSquare", label: "MAX" },
          ].map(b => (
            <div key={b.label} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg"
              style={{ background: `${accent}1f`, border: `1px solid ${accent}33` }}>
              <Icon name={b.icon} size={10} style={{ color: accent }} />
              <span className="text-[9px] font-bold" style={{ color: accent }}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Контакты компании — карточка */}
      <div className="rounded-xl p-3"
        style={{ background: sectBg, border: `1px solid ${border}` }}>
        <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: muted }}>
          Контакты в чате
        </div>
        <div className="space-y-1.5 text-[10.5px]">
          {[
            { icon: "Phone",  val: brand.support_phone || "не задан" },
            { icon: "Send",   val: brand.telegram_url  || "не задан" },
            { icon: "Clock",  val: brand.working_hours || "Ежедневно 8:00–22:00" },
          ].map(c => (
            <div key={c.icon} className="flex items-center gap-2">
              <Icon name={c.icon} size={11} style={{ color: accent }} />
              <span className={c.val !== "не задан" ? "text-white/70" : "text-white/30 italic"}>
                {c.val}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Превью PDF-сметы */}
      <div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-2"
          style={{ color: muted }}>
          <Icon name="FileText" size={11} />
          Так выглядит PDF-смета
        </div>
        <div className="rounded-xl overflow-hidden shadow-lg"
          style={{ background: "#fff", border: `1px solid ${border}` }}>
          {/* Шапка PDF */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100"
            style={{ borderColor: `${accent}22` }}>
            <div className="flex items-center gap-2">
              {brand.brand_logo_url
                ? <img src={brand.brand_logo_url} alt="" className="h-6 object-contain" />
                : <div className="w-6 h-6 rounded" style={{ background: `${accent}22` }} />}
              <span className="text-[11px] font-black" style={{ color: pdfText }}>{companyName}</span>
            </div>
            <div className="text-right">
              <div className="text-[8px]" style={{ color: `${pdfText}66` }}>Смета №</div>
              <div className="text-[10px] font-bold" style={{ color: accent }}>001</div>
            </div>
          </div>
          {/* Тело */}
          <div className="px-4 py-2.5">
            <div className="text-[8px] font-bold uppercase tracking-wider mb-1.5"
              style={{ color: `${pdfText}55` }}>Позиции</div>
            {[
              { name: "Натяжной потолок белый матовый", qty: "24 м²", price: "12 480 ₽" },
              { name: "Демонтаж старого покрытия",      qty: "24 м²", price: "2 400 ₽"  },
              { name: "Профиль настенный алюминий",     qty: "20 п.м", price: "1 600 ₽" },
              { name: "Монтаж и установка под ключ",    qty: "1 шт",  price: "4 000 ₽"  },
            ].map((r, i) => (
              <div key={i} className="flex items-center justify-between py-1"
                style={{ borderBottom: `1px solid ${pdfText}0d` }}>
                <span className="text-[9px] flex-1 truncate pr-2" style={{ color: pdfText }}>{r.name}</span>
                <span className="text-[8px] w-10 text-right" style={{ color: `${pdfText}55` }}>{r.qty}</span>
                <span className="text-[9px] font-bold w-16 text-right" style={{ color: pdfText }}>{r.price}</span>
              </div>
            ))}
            <div className="flex justify-between items-center mt-2 pt-1.5"
              style={{ borderTop: `1.5px solid ${accent}44` }}>
              <span className="text-[8px] font-bold uppercase tracking-wider"
                style={{ color: `${pdfText}55` }}>Итого</span>
              <span className="text-[13px] font-black" style={{ color: accent }}>20 480 ₽</span>
            </div>
          </div>
          {/* Подвал PDF */}
          <div className="px-4 py-2 border-t"
            style={{ background: `${accent}0d`, borderColor: `${accent}22` }}>
            <div className="text-[8px] text-center leading-tight"
              style={{ color: `${pdfText}77` }}>
              {brand.pdf_footer_address || "Здесь появится адрес и реквизиты вашей компании"}
            </div>
          </div>
        </div>
      </div>

      {/* Кнопка скачать PDF */}
      <button
        onClick={downloadPdf}
        disabled={downloading}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-60"
        style={{
          background: downloading ? "rgba(124,58,237,0.15)" : "rgba(124,58,237,0.12)",
          border: "1px solid rgba(124,58,237,0.3)",
          color: "#a78bfa",
        }}>
        {downloading
          ? <><div className="w-3.5 h-3.5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" /> Генерирую PDF...</>
          : <><Icon name="Download" size={14} /> Скачать PDF с моим брендом</>}
      </button>

      {/* Быстрые ссылки */}
      {user?.id && (
        <div className="grid grid-cols-3 gap-2">
          <a href={`/?c=${user.id}`} target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition hover:opacity-80"
            style={{ background: "rgba(6,182,212,0.12)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.25)" }}>
            <Icon name="Globe" size={12} /> Сайт
          </a>
          <a href="/company" target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition hover:opacity-80"
            style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}>
            <Icon name="LayoutDashboard" size={12} /> Панель
          </a>
          <a href={`/?c=${user.id}&test=1`} target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition hover:opacity-80"
            style={{ background: "rgba(16,185,129,0.10)", color: "#10b981", border: "1px solid rgba(16,185,129,0.22)" }}>
            <Icon name="Zap" size={12} /> API
          </a>
        </div>
      )}
    </div>
  );
}