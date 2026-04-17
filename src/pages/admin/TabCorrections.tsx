import { useState, useCallback, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { apiFetch } from "./api";
import type { BotCorrection } from "./types";

interface Props { token: string; }

interface RecognizedData {
  area?: number;
  canvas?: string;
  canvas_type?: string;
  perim?: number;
  n_lyustra?: number;
  n_svetilnik?: number;
  has_nisha?: boolean;
  nisha_label?: string | null;
  nisha_len?: number | null;
  profile_len?: number;
  standard_total?: number;
}

const LABELS: { key: keyof RecognizedData; label: string; unit: string; icon: string }[] = [
  { key: "area",         label: "Площадь",         unit: "м²",   icon: "Square" },
  { key: "canvas",       label: "Полотно",          unit: "",     icon: "Layers" },
  { key: "perim",        label: "Периметр",         unit: "мп",   icon: "Maximize" },
  { key: "profile_len",  label: "Профиль",          unit: "мп",   icon: "Minus" },
  { key: "n_lyustra",    label: "Люстры",           unit: "шт",   icon: "Lightbulb" },
  { key: "n_svetilnik",  label: "Светильники GX-53",unit: "шт",   icon: "Zap" },
  { key: "has_nisha",    label: "Ниша для штор",    unit: "",     icon: "PanelRight" },
  { key: "nisha_label",  label: "Тип ниши",         unit: "",     icon: "Tag" },
  { key: "nisha_len",    label: "Длина ниши",       unit: "мп",   icon: "Ruler" },
  { key: "standard_total", label: "Итого Standard", unit: "₽",   icon: "Banknote" },
];

function RecognizedTable({ data }: { data: RecognizedData }) {
  const rows = LABELS.filter(l => {
    const v = data[l.key];
    if (v === null || v === undefined) return false;
    if (v === false || v === 0) return false;
    if (l.key === "has_nisha" && !v) return false;
    if (l.key === "nisha_label" && !v) return false;
    if (l.key === "nisha_len" && !v) return false;
    return true;
  });

  if (rows.length === 0) return <p className="text-white/30 text-xs">Нет данных</p>;

  return (
    <div className="rounded-xl overflow-hidden border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-white/[0.03] border-b border-white/10">
            <th className="text-left text-white/30 font-normal px-4 py-2 text-xs">Позиция</th>
            <th className="text-left text-white/30 font-normal px-4 py-2 text-xs">Распознано</th>
            <th className="text-center text-white/30 font-normal px-4 py-2 text-xs w-24">Статус</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l, i) => {
            const v = data[l.key];
            let display = "";
            if (l.key === "has_nisha") display = "Да";
            else if (l.key === "standard_total") display = `${Number(v).toLocaleString("ru")} ₽`;
            else display = `${v}${l.unit ? " " + l.unit : ""}`;

            return (
              <tr key={l.key} className={`border-b border-white/5 last:border-0 ${i % 2 ? "bg-white/[0.01]" : ""}`}>
                <td className="px-4 py-2.5 flex items-center gap-2">
                  <Icon name={l.icon} size={13} className="text-white/30 flex-shrink-0" />
                  <span className="text-white/60 text-xs">{l.label}</span>
                </td>
                <td className="px-4 py-2.5 text-white text-xs font-medium">{display}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className="inline-flex items-center gap-1 text-xs bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full">
                    <Icon name="Check" size={10} /> Распознано
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NullTable() {
  return (
    <div className="rounded-xl overflow-hidden border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-white/[0.03] border-b border-white/10">
            <th className="text-left text-white/30 font-normal px-4 py-2 text-xs">Позиция</th>
            <th className="text-left text-white/30 font-normal px-4 py-2 text-xs">Распознано</th>
            <th className="text-center text-white/30 font-normal px-4 py-2 text-xs w-24">Статус</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={3} className="px-4 py-4 text-center">
              <span className="inline-flex items-center gap-2 text-xs bg-red-500/10 text-red-400 px-3 py-1.5 rounded-full">
                <Icon name="AlertCircle" size={12} /> Бот не смог распознать — передал в LLM
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function TabCorrections({ token }: Props) {
  const [items, setItems] = useState<BotCorrection[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiFetch("corrections");
    if (r.ok) { const d = await r.json(); setItems(d.items); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = async (id: number, status: string) => {
    await apiFetch("corrections", {
      method: "PUT",
      body: JSON.stringify({ id, status }),
    }, token, id);
    setItems(prev => prev.map(c => c.id === id ? { ...c, status: status as BotCorrection["status"] } : c));
  };

  const pending = items.filter(i => i.status === "pending");
  const reviewed = items.filter(i => i.status !== "pending");

  if (loading) return <p className="text-white/30 text-sm">Загрузка...</p>;

  const renderCard = (item: BotCorrection) => {
    const recognized = item.recognized_json as RecognizedData | null;
    const isExpanded = expandedId === item.id;
    const isRecognized = recognized !== null;

    return (
      <div key={item.id} className={`bg-white/[0.03] border rounded-xl overflow-hidden ${
        item.status === "pending" ? "border-amber-500/30" :
        item.status === "approved" ? "border-green-500/20" : "border-white/10"
      }`}>
        {/* Заголовок */}
        <div className="p-4 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                item.status === "pending" ? "bg-amber-500/20 text-amber-300" :
                item.status === "approved" ? "bg-green-500/20 text-green-300" :
                "bg-white/10 text-white/40"
              }`}>
                {item.status === "pending" ? "Ожидает" : item.status === "approved" ? "Одобрено" : "Отклонено"}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                isRecognized ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
              }`}>
                {isRecognized ? "Авторасчёт" : "Передан в LLM"}
              </span>
              <span className="text-white/30 text-xs">{new Date(item.created_at).toLocaleString("ru")}</span>
            </div>
            <p className="text-white text-sm font-medium leading-relaxed">«{item.user_text}»</p>
          </div>
          <button onClick={() => setExpandedId(isExpanded ? null : item.id)}
            className="text-white/30 hover:text-white/60 transition mt-1 flex-shrink-0">
            <Icon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={16} />
          </button>
        </div>

        {/* Таблица позиций */}
        {isExpanded && (
          <div className="border-t border-white/10 p-4 flex flex-col gap-3">
            {recognized ? (
              <RecognizedTable data={recognized} />
            ) : (
              <NullTable />
            )}

            {item.status === "pending" && (
              <div className="flex gap-2 pt-1">
                <button onClick={() => update(item.id, "approved")}
                  className="flex-1 bg-green-600/20 hover:bg-green-600/30 text-green-300 text-sm py-2 rounded-lg transition flex items-center justify-center gap-1.5">
                  <Icon name="Check" size={14} /> Верно, запомнить
                </button>
                <button onClick={() => update(item.id, "rejected")}
                  className="flex-1 bg-red-600/10 hover:bg-red-600/20 text-red-400 text-sm py-2 rounded-lg transition flex items-center justify-center gap-1.5">
                  <Icon name="X" size={14} /> Неверно, пропустить
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
        <Icon name="GraduationCap" size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <span className="text-amber-300 font-medium">Обучение бота.</span>
          <span className="text-white/50 ml-1">Каждый запрос расписан по позициям. Зелёный — распознано автоматически, красный — ушло в LLM.</span>
        </div>
      </div>

      {pending.length === 0 && reviewed.length === 0 && (
        <p className="text-white/30 text-sm text-center py-8">Пока нет запросов</p>
      )}

      {pending.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-amber-300 text-xs font-semibold uppercase tracking-wider">Ожидают проверки ({pending.length})</h3>
          {pending.map(renderCard)}
        </div>
      )}

      {reviewed.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-white/30 text-xs font-semibold uppercase tracking-wider">Проверенные ({reviewed.length})</h3>
          {reviewed.map(renderCard)}
        </div>
      )}
    </div>
  );
}
