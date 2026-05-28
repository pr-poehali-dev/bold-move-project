import { useState } from "react";
import Icon from "@/components/ui/icon";
import FaqKnowledgeTab from "./FaqKnowledgeTab";
import FaqQuestionsTab from "./FaqQuestionsTab";

type FaqSub = "knowledge" | "questions";
interface Props { token: string; isDark?: boolean; readOnly?: boolean; }

export default function TabFaq({ token, isDark = true, readOnly = false }: Props) {
  const [sub, setSub] = useState<FaqSub>("knowledge");

  const SUB_TABS: { id: FaqSub; label: string; icon: string }[] = [
    { id: "knowledge", label: "Знания агента",  icon: "Database" },
    { id: "questions", label: "Быстрые ответы", icon: "MessageCircle" },
  ];

  const activeCls = isDark
    ? "bg-violet-600/15 text-violet-300 border-b-2 border-violet-500"
    : "bg-violet-600/10 text-violet-700 border-b-2 border-violet-600";
  const inactiveCls = isDark ? "text-white/40 hover:text-white/70" : "text-gray-500 hover:text-gray-800";

  return (
    <div className="flex flex-col gap-0 h-full">
      <div className="flex gap-0.5 mb-5 flex-shrink-0"
        style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb"}` }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition whitespace-nowrap ${sub === t.id ? activeCls : inactiveCls}`}>
            <Icon name={t.icon} size={13} />
            {t.label}
          </button>
        ))}
      </div>
      {sub === "knowledge" && <FaqKnowledgeTab token={token} isDark={isDark} readOnly={readOnly} />}
      {sub === "questions" && <FaqQuestionsTab token={token} isDark={isDark} readOnly={readOnly} />}
    </div>
  );
}
