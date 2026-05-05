import React from "react";
import Icon from "@/components/ui/icon";

interface Props {
  title: string;
  onTitleChange: (v: string) => void;
  navBtnLabel?: string;
  zoom: number;
  onZoomChange: (z: number) => void;
  saving: boolean;
  saved: boolean;
  onSave: () => void;
  aiPrompt: string;
  onAiPromptChange: (v: string) => void;
  aiLoading: boolean;
  aiError: string;
  onAiApply: () => void;
}

export function EditorHeader({
  title, onTitleChange, navBtnLabel,
  zoom, onZoomChange,
  saving, saved, onSave,
  aiPrompt, onAiPromptChange, aiLoading, aiError, onAiApply,
}: Props) {
  return (
    <div className="shrink-0 border-b border-white/[0.08] bg-[#0e0e1a]">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div>
            <input value={title} onChange={e => onTitleChange(e.target.value)}
              className="bg-transparent text-white font-bold text-sm focus:outline-none border-b border-transparent focus:border-white/20 transition min-w-[140px]"
              placeholder="Название страницы" />
            <p className="text-white/20 text-[10px]">{navBtnLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Zoom */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.07]">
            <button onClick={() => onZoomChange(Math.max(0.25, zoom - 0.1))} className="text-white/40 hover:text-white/70 transition w-5 text-center">−</button>
            <span className="text-xs text-white/40 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => onZoomChange(Math.min(3, zoom + 0.1))} className="text-white/40 hover:text-white/70 transition w-5 text-center">+</button>
            <button onClick={() => onZoomChange(1)} className="text-white/20 hover:text-white/50 text-[9px] ml-1 transition">1:1</button>
          </div>
          <button onClick={onSave} disabled={saving}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white transition disabled:opacity-50 ${
              saved ? "bg-emerald-500/80" : "bg-gradient-to-r from-orange-500 to-rose-500"
            }`}>
            <Icon name={saved ? "CheckCircle2" : saving ? "Loader" : "Save"} size={14} className={saving ? "animate-spin" : ""} />
            {saved ? "Сохранено!" : saving ? "..." : "Сохранить"}
          </button>
        </div>
      </div>
      {/* AI */}
      <div className="px-4 pb-2.5 flex gap-2 items-center">
        <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-500/[0.07] border border-violet-500/20 focus-within:border-violet-500/40 transition">
          <Icon name="Sparkles" size={13} className="text-violet-400 shrink-0" />
          <input value={aiPrompt} onChange={e => onAiPromptChange(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onAiApply()}
            placeholder="Попросите AI изменить страницу..."
            className="flex-1 bg-transparent text-xs text-white placeholder:text-white/25 focus:outline-none" />
        </div>
        <button onClick={onAiApply} disabled={aiLoading || !aiPrompt.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 transition shrink-0">
          <Icon name={aiLoading ? "Loader" : "Wand2"} size={13} className={aiLoading ? "animate-spin" : ""} />
          {aiLoading ? "..." : "Применить"}
        </button>
      </div>
      {aiError && <p className="px-4 pb-2 text-xs text-red-400">{aiError}</p>}
    </div>
  );
}
