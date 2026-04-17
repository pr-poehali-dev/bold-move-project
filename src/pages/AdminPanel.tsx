import { useState } from "react";
import Icon from "@/components/ui/icon";
import { apiFetch } from "./admin/api";
import TabPrices from "./admin/TabPrices";
import TabRules from "./admin/TabRules";
import TabPrompt from "./admin/TabPrompt";
import TabFaq from "./admin/TabFaq";
import TabQuestions from "./admin/TabQuestions";
import TabCorrections from "./admin/TabCorrections";
import type { AdminTab } from "./admin/types";

const TABS: { id: AdminTab; label: string; icon: string }[] = [
  { id: "prices",      label: "Цены",             icon: "Tag" },
  { id: "rules",       label: "Правила расчёта",  icon: "SlidersHorizontal" },
  { id: "prompt",      label: "Промпт",           icon: "BrainCircuit" },
  { id: "faq",         label: "База знаний",      icon: "Database" },
  { id: "questions",   label: "Быстрые ответы",   icon: "MessageCircle" },
  { id: "corrections", label: "Обучение",         icon: "GraduationCap" },
];

export default function AdminPanel() {
  const [tab, setTab] = useState<AdminTab>("prices");
  const [newItemHint, setNewItemHint] = useState<string | null>(null);
  const token = "Sdauxbasstre228";

  const handleItemAdded = (name: string) => {
    setNewItemHint(name);
    setTab("rules");
    setTimeout(() => setNewItemHint(null), 6000);
  };

  return (
    <div className="min-h-screen bg-[#0b0b11] text-white">
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="BrainCircuit" size={20} className="text-violet-400" />
          <span className="font-semibold">Управление AI</span>
        </div>

      </div>

      <div className="border-b border-white/10 px-4 flex gap-1 pt-2 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm rounded-t-lg transition whitespace-nowrap ${
              tab === t.id
                ? "bg-violet-600/20 text-violet-300 border-b-2 border-violet-500"
                : "text-white/50 hover:text-white/80"
            }`}>
            <Icon name={t.icon} size={15} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-6xl mx-auto">
        <div className={tab === "prices"      ? "" : "hidden"}><TabPrices      token={token} onItemAdded={handleItemAdded} /></div>
        <div className={tab === "rules"       ? "" : "hidden"}><TabRules       token={token} hint={newItemHint} /></div>
        <div className={tab === "prompt"      ? "" : "hidden"}><TabPrompt      token={token} /></div>
        <div className={tab === "faq"         ? "" : "hidden"}><TabFaq         token={token} /></div>
        <div className={tab === "questions"   ? "" : "hidden"}><TabQuestions   token={token} /></div>
        <div className={tab === "corrections" ? "" : "hidden"}><TabCorrections token={token} /></div>
      </div>
    </div>
  );
}