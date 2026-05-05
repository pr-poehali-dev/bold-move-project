import React, { useState } from "react";
import type { PageBlock, PageBlockStyle } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";
import { StylePanel } from "./BlockContent";
import { BlockFieldEditors } from "./BlockFieldEditors";
import { AiImageModal } from "./AiImageModal";

export { CanvasSettingsPanel } from "./CanvasSettingsPanel";

export function BlockEditor({
  block, onChange, onDelete, onDuplicate, onBringFront, onSendBack, token,
}: {
  block: PageBlock;
  onChange: (b: PageBlock) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onBringFront: () => void;
  onSendBack: () => void;
  token: string | null;
}) {
  const [editorTab,     setEditorTab]     = useState<"content" | "style">("content");
  const [showAiModal,   setShowAiModal]   = useState(false);

  const lbl = "text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1 block";

  const st = block.style_ ?? {};
  const updateStyle = (patch: Partial<PageBlockStyle>) =>
    onChange({ ...block, style_: { ...st, ...patch } });

  const actionsRow = (
    <div className="flex gap-2 pt-2 border-t border-white/[0.07]">
      <button onClick={onDuplicate}
        className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-white/50 hover:text-white/80 text-xs transition">
        <Icon name="Copy" size={12} /> Дублировать
      </button>
      <button onClick={onDelete}
        className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-red-500/[0.06] hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/30 text-red-400/60 hover:text-red-400 text-xs transition">
        <Icon name="Trash2" size={12} /> Удалить
      </button>
    </div>
  );

  return (
    <div className="space-y-3">

      {/* ── Табы Содержимое / Стиль ── */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
        {(["content","style"] as const).map(t => (
          <button key={t} onClick={() => setEditorTab(t)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition ${
              editorTab === t
                ? t === "style"
                  ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow"
                  : "bg-white/[0.08] text-white"
                : "text-white/30 hover:text-white/60"
            }`}>
            <Icon name={t === "content" ? "AlignLeft" : "Palette"} size={11} />
            {t === "content" ? "Содержимое" : "Стиль"}
          </button>
        ))}
      </div>

      {editorTab === "content" && (<>
        {/* Position & size */}
        <div className="grid grid-cols-2 gap-1.5">
          {(["x","y","w","h"] as const).map(k => (
            <div key={k}>
              <label className={lbl}>{k === "x" ? "X" : k === "y" ? "Y" : k === "w" ? "Ширина" : "Высота"}</label>
              <input type="number" step={1}
                value={Math.round((block as Record<string,number>)[k] ?? 0)}
                onChange={e => onChange({ ...block, [k]: Number(e.target.value) })}
                className="w-full px-2 py-1.5 rounded-lg text-xs text-white bg-white/[0.06] border border-white/[0.1] focus:outline-none" />
            </div>
          ))}
        </div>

        {/* Layer controls */}
        <div className="flex gap-1.5">
          <button onClick={onBringFront} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-white/40 hover:text-white/70 text-[10px] transition">
            <Icon name="BringToFront" size={11} /> Вперёд
          </button>
          <button onClick={onSendBack} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-white/40 hover:text-white/70 text-[10px] transition">
            <Icon name="SendToBack" size={11} /> Назад
          </button>
        </div>

        {/* Hidden toggle */}
        <div className="flex items-center justify-between py-1.5 px-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <label className={lbl + " mb-0"}>Скрыть блок</label>
          <button onClick={() => onChange({ ...block, hidden: !block.hidden })}
            className={`w-10 h-5 rounded-full transition-colors relative ${block.hidden ? "bg-white/10" : "bg-violet-600"}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${block.hidden ? "left-0.5" : "left-5"}`} />
          </button>
        </div>

        <div className="border-t border-white/[0.07]" />

        {/* Для AI-изображения — большая кнопка генерации */}
        {block.type === "ai-image" && (
          <button onClick={() => setShowAiModal(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:brightness-110 transition">
            <Icon name="Sparkles" size={15} />
            {block.imageUrl ? "Перегенерировать / Заменить" : "Сгенерировать картинку"}
          </button>
        )}

        {/* Per-type content editors */}
        <BlockFieldEditors block={block} onChange={onChange} token={token} />

        {actionsRow}

        {/* AI Image Modal */}
        {showAiModal && block.type === "ai-image" && (
          <AiImageModal
            initialPrompt={block.prompt}
            token={token}
            onGenerated={(imageUrl, prompt) => onChange({ ...block, imageUrl, prompt })}
            onClose={() => setShowAiModal(false)}
          />
        )}
      </>)}

      {editorTab === "style" && (<>
        <StylePanel s={st} onChange={updateStyle} />
        {actionsRow}
      </>)}
    </div>
  );
}