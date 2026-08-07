import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Icon from "@/components/ui/icon";
import func2url from "@/../backend/func2url.json";

const CRM_URL = (func2url as Record<string, string>)["crm-manager"];

// Упрощённая копия меток статусов (та же логика, что в crmApi.ts) — публичная
// страница не тянет авторизованный модуль CRM, поэтому список продублирован.
const STATUS_LABELS: Record<string, string> = {
  new: "Новая заявка",
  call: "В работе",
  measure: "Замер назначен",
  measured: "Замер выполнен",
  contract: "Договор подписан",
  prepaid: "Предоплата получена",
  install_scheduled: "Монтаж назначен",
  install_done: "Монтаж выполнен",
  extra_paid: "Доплата получена",
  done: "Завершён",
  cancelled: "Отменён",
};

interface EstimateBlock {
  title: string;
  numbered?: boolean;
  items: { name: string; value: string }[];
}

interface Estimate {
  title: string;
  blocks: EstimateBlock[];
  totals: string[];
  final_phrase: string | null;
  total_econom: number | null;
  total_standard: number | null;
  total_premium: number | null;
  chosen_tier: "econom" | "standard" | "premium" | null;
}

interface Order {
  id: number;
  client_name: string | null;
  address: string | null;
  area: number | null;
  status: string;
  sub_status: string | null;
  measure_date: string | null;
  install_date: string | null;
  created_at: string;
}

const fmtDate = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
};

export default function OrderSharePage() {
  const { token } = useParams<{ token: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${CRM_URL}?r=order-share&token=${token}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: { order?: Order; estimate?: Estimate | null; error?: string }) => {
        if (!d || d.error || !d.order) { setError(true); return; }
        setOrder(d.order);
        setEstimate(d.estimate ?? null);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
    </div>
  );

  if (error || !order) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-white">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-red-50">
        <Icon name="LinkOff" size={32} style={{ color: "#ef4444" }} />
      </div>
      <h1 className="text-xl font-bold text-gray-900">Ссылка недействительна</h1>
      <p className="text-sm text-gray-500">Эта заявка была удалена или ссылка устарела</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка */}
      <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3 bg-white border-b border-gray-100 shadow-sm">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg,#6d28d9,#7c3aed)" }}>
          <Icon name="ClipboardList" size={18} style={{ color: "#fff" }} />
        </div>
        <div className="min-w-0">
          <h1 className="text-gray-900 font-bold text-sm truncate">
            {order.client_name || `Заявка №${order.id}`}
          </h1>
          <p className="text-xs mt-0.5 text-gray-400">Заявка №{order.id}</p>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4 max-w-lg mx-auto">
        {/* Статус */}
        <div className="rounded-2xl p-4 bg-white shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Статус</p>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold"
            style={{ background: "rgba(124,58,237,0.1)", color: "#7c3aed" }}>
            <Icon name="GitBranch" size={14} />
            {STATUS_LABELS[order.status] || order.status}
          </span>
        </div>

        {/* Объект */}
        {(order.address || order.area) && (
          <div className="rounded-2xl p-4 bg-white shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Объект</p>
            <div className="space-y-2">
              {order.address && (
                <div className="flex items-start gap-2 text-sm text-gray-800">
                  <Icon name="MapPin" size={15} style={{ color: "#f59e0b", marginTop: 2 }} />
                  <span>{order.address}</span>
                </div>
              )}
              {order.area && (
                <div className="flex items-center gap-2 text-sm text-gray-800">
                  <Icon name="Ruler" size={15} style={{ color: "#f59e0b" }} />
                  <span>{order.area} м²</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Даты */}
        {(order.measure_date || order.install_date) && (
          <div className="rounded-2xl p-4 bg-white shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Даты</p>
            <div className="space-y-2">
              {order.measure_date && fmtDate(order.measure_date) && (
                <div className="flex items-center gap-2 text-sm text-gray-800">
                  <Icon name="Ruler" size={15} style={{ color: "#f59e0b" }} />
                  <span>Замер: {fmtDate(order.measure_date)}</span>
                </div>
              )}
              {order.install_date && fmtDate(order.install_date) && (
                <div className="flex items-center gap-2 text-sm text-gray-800">
                  <Icon name="Wrench" size={15} style={{ color: "#f97316" }} />
                  <span>Монтаж: {fmtDate(order.install_date)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Смета */}
        {estimate && estimate.blocks?.length > 0 && (
          <div className="rounded-2xl p-4 bg-white shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Смета</p>
            <div className="space-y-4">
              {estimate.blocks.map((block, bi) => (
                <div key={bi}>
                  {block.title && (
                    <p className="text-sm font-semibold text-gray-900 mb-1.5">{block.title}</p>
                  )}
                  <div className="space-y-1">
                    {block.items.map((item, ii) => (
                      <div key={ii} className="flex items-start justify-between gap-3 text-xs text-gray-600 py-1"
                        style={{ borderBottom: ii < block.items.length - 1 ? "1px dashed #f0f0f0" : "none" }}>
                        <span>{item.name}</span>
                        <span className="text-right flex-shrink-0 font-medium text-gray-800">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {estimate.totals?.length > 0 && (
              <div className="mt-3 pt-3 space-y-1" style={{ borderTop: "1px solid #e5e7eb" }}>
                {estimate.totals.map((t, i) => (
                  <p key={i} className="text-sm font-bold text-gray-900">{t}</p>
                ))}
              </div>
            )}
            {estimate.final_phrase && (
              <p className="mt-3 text-xs text-gray-500">{estimate.final_phrase}</p>
            )}
          </div>
        )}

        {!estimate && (
          <div className="rounded-2xl p-4 bg-white shadow-sm text-center text-xs text-gray-400" style={{ border: "1px solid #e5e7eb" }}>
            Смета ещё не готова
          </div>
        )}
      </div>

      <div className="py-8 text-center">
        <p className="text-xs text-gray-300">Натяжные потолки — поехали!</p>
      </div>
    </div>
  );
}
