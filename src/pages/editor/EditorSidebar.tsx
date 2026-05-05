import React from "react";
import type { PageBlock, PageSettings } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";
import { BlockEditor } from "./BlockEditor";
import { CanvasSettingsPanel } from "./CanvasSettingsPanel";
import { ADD_BLOCKS, BLOCK_LABELS } from "./editorTypes";

interface Props {
  blocks: PageBlock[];
  selectedId: string | null;
  sidebarTab: "blocks" | "settings";
  settings: PageSettings;
  token: string | null;
  paletteType: React.MutableRefObject<PageBlock["type"] | null>;
  onSidebarTabChange: (tab: "blocks" | "settings") => void;
  onSelectId: (id: string | null) => void;
  onSettingsChange: (s: PageSettings) => void;
  addBlock: (type: PageBlock["type"]) => void;
  setIsDroppingFromPalette: (v: boolean) => void;
  updateBlock: (id: string, updated: PageBlock) => void;
  deleteBlock: (id: string) => void;
  duplicateBlock: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
}

export function EditorSidebar({
  blocks, selectedId, sidebarTab, settings, token,
  paletteType,
  onSidebarTabChange, onSelectId, onSettingsChange,
  addBlock, setIsDroppingFromPalette,
  updateBlock, deleteBlock, duplicateBlock, bringToFront, sendToBack,
}: Props) {
  const selectedBlock = blocks.find(b => b.id === selectedId) ?? null;

  return (
    <div className="w-64 shrink-0 border-l border-white/[0.07] bg-[#0c0c18] flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="shrink-0 flex border-b border-white/[0.07]">
        {(["blocks","settings"] as const).map(tab => (
          <button key={tab} onClick={() => { onSidebarTabChange(tab); if (tab==="settings") onSelectId(null); }}
            className={`flex-1 py-2.5 text-xs font-bold transition ${
              (sidebarTab === tab && !selectedId) || (sidebarTab === tab && tab === "settings")
                ? "text-violet-300 border-b-2 border-violet-500"
                : "text-white/25 hover:text-white/50"
            }`}>
            {tab === "blocks" ? "Элементы" : "Холст"}
          </button>
        ))}
      </div>

      {selectedBlock ? (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-white/50 uppercase tracking-wider">{BLOCK_LABELS[selectedBlock.type]}</span>
            <button onClick={() => onSelectId(null)} className="text-white/20 hover:text-white/50 transition"><Icon name="X" size={13} /></button>
          </div>
          <BlockEditor
            block={selectedBlock}
            onChange={updated => updateBlock(selectedBlock.id, updated)}
            onDelete={() => deleteBlock(selectedBlock.id)}
            onDuplicate={() => duplicateBlock(selectedBlock.id)}
            onBringFront={() => bringToFront(selectedBlock.id)}
            onSendBack={() => sendToBack(selectedBlock.id)}
            token={token}
          />
        </div>

      ) : sidebarTab === "settings" ? (
        <div className="flex-1 overflow-y-auto">
          <CanvasSettingsPanel settings={settings} onChange={onSettingsChange} />
        </div>

      ) : (
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2.5">Перетащить или нажать</p>
          <div className="grid grid-cols-2 gap-2">
            {ADD_BLOCKS.map(({ type, icon, label, color, bg }) => (
              <div key={type}
                draggable
                onDragStart={() => { paletteType.current = type; setIsDroppingFromPalette(true); }}
                onDragEnd={() => { paletteType.current = null; setIsDroppingFromPalette(false); }}
                onClick={() => addBlock(type)}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-white/[0.07] hover:border-white/20 transition-all group cursor-grab active:cursor-grabbing select-none hover:scale-[1.03] active:scale-95"
                style={{ background: "rgba(255,255,255,0.025)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ background: bg }}>
                  <Icon name={icon} size={17} style={{ color }} />
                </div>
                <span className="text-[10px] font-semibold text-white/50 group-hover:text-white/80 transition text-center leading-tight">{label}</span>
                <div className="w-6 h-0.5 rounded-full opacity-50 group-hover:opacity-100 transition" style={{ background: color }} />
              </div>
            ))}
          </div>

          {blocks.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/[0.06]">
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-1.5">Слои ({blocks.length})</p>
              <div className="space-y-0.5">
                {[...blocks].sort((a,b)=>(b.zIndex??1)-(a.zIndex??1)).map(block => {
                  const pal = ADD_BLOCKS.find(b => b.type === block.type);
                  return (
                    <button key={block.id} onClick={() => { onSelectId(block.id); onSidebarTabChange("blocks"); }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-left transition group ${selectedId===block.id?"bg-violet-500/10 border border-violet-500/20":"hover:bg-white/[0.04] border border-transparent"}`}>
                      <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                        style={{ background: pal?.bg ?? "rgba(255,255,255,0.05)" }}>
                        <Icon name={pal?.icon ?? "Box"} size={10} style={{ color: pal?.color ?? "#ffffff60" }} />
                      </div>
                      <span className="text-[11px] text-white/40 group-hover:text-white/70 truncate flex-1">
                        {block.type==="heading"?block.text:block.type==="text"?block.text.slice(0,24)+(block.text.length>24?"…":""):block.type==="card"?block.title:BLOCK_LABELS[block.type]}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {block.hidden && <Icon name="EyeOff" size={8} className="text-orange-400/60" />}
                        {block.style_?.bgType && block.style_.bgType !== "none" && (
                          <div className="w-2 h-2 rounded-full" style={{
                            background: block.style_.bgType === "gradient"
                              ? `linear-gradient(135deg,${block.style_.bgGradFrom},${block.style_.bgGradTo})`
                              : block.style_.bgColor
                          }} />
                        )}
                        <span className="text-[8px] text-white/15">{block.zIndex??1}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
