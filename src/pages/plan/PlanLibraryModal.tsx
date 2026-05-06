import React, { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import type { PlanMeta, SaveStatus } from "./usePlanStorage";

interface Props {
  plans: PlanMeta[];
  loading: boolean;
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  isDirty: boolean;
  currentPlanId: number | null;
  currentPlanName: string;
  isLoggedIn: boolean;
  onClose: () => void;
  onLoad: (planId: number) => void;
  onSave: () => void;
  onSaveAs: (name: string) => void;
  onDelete: (planId: number) => void;
  onRename: (planId: number, name: string) => void;
  onNew: () => void;
  onLoginRequest: () => void;
}

function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)   return "только что";
  if (s < 3600) return `${Math.round(s / 60)} мин назад`;
  if (s < 86400) return `${Math.round(s / 3600)} ч назад`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export default function PlanLibraryModal({
  plans, loading, saveStatus, lastSavedAt, isDirty,
  currentPlanId, currentPlanName, isLoggedIn,
  onClose, onLoad, onSave, onSaveAs, onDelete, onRename, onNew, onLoginRequest,
}: Props) {
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameVal,  setRenameVal]  = useState("");
  const [saveAsMode, setSaveAsMode] = useState(false);
  const [saveAsName, setSaveAsName] = useState(currentPlanName);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Закрыть по Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  const handleRenameConfirm = (id: number) => {
    if (renameVal.trim()) onRename(id, renameVal.trim());
    setRenamingId(null);
    setRenameVal("");
  };

  const handleSaveAs = () => {
    const name = saveAsName.trim() || currentPlanName || "Новый план";
    onSaveAs(name);
    setSaveAsMode(false);
    onClose();
  };

  const statusIcon =
    saveStatus === "saving" ? "Loader2" :
    saveStatus === "saved"  ? "CheckCircle2" :
    saveStatus === "error"  ? "AlertCircle" :
    isDirty ? "AlertCircle" : "CloudOff";

  const statusColor =
    saveStatus === "saving" ? "text-blue-400" :
    saveStatus === "saved"  ? "text-emerald-400" :
    saveStatus === "error"  ? "text-rose-400" :
    isDirty ? "text-amber-400" : "text-white/30";

  const statusText =
    saveStatus === "saving" ? "Сохранение…" :
    saveStatus === "saved"  ? (lastSavedAt ? `Сохранён ${timeAgo(lastSavedAt.toISOString())}` : "Сохранён") :
    saveStatus === "error"  ? "Ошибка — попробуй снова" :
    isDirty ? "Есть несохранённые изменения" :
    "Не сохранён";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-xl bg-[#13141f] rounded-2xl border border-white/[0.1] shadow-2xl flex flex-col overflow-hidden max-h-[88dvh]">

        {/* ── Заголовок ── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.07] shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
            <Icon name="FolderOpen" size={15} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-bold text-white/90">Мои планы</p>
            <p className="text-[11px] text-white/35">Облачное хранилище</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center transition">
            <Icon name="X" size={14} className="text-white/50" />
          </button>
        </div>

        {/* ── Текущий план + статус ── */}
        <div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-white/35 mb-0.5">Открытый план</p>
              <p className="text-[13px] font-semibold text-white/80 truncate">
                {currentPlanName || "Без названия"}
                {currentPlanId && <span className="ml-2 text-[10px] text-violet-400/60 font-normal">#{currentPlanId}</span>}
              </p>
            </div>
            <div className={`flex items-center gap-1.5 text-[11px] font-medium ${statusColor}`}>
              <Icon name={statusIcon} size={13} className={saveStatus === "saving" ? "animate-spin" : ""} />
              <span className="hidden sm:inline">{statusText}</span>
            </div>
          </div>

          {/* Кнопки действий для текущего плана */}
          {isLoggedIn ? (
            <div className="flex gap-2 mt-2.5">
              {/* Сохранить */}
              <button onClick={() => { onSave(); }}
                disabled={saveStatus === "saving" || (!isDirty && !!currentPlanId)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold border transition disabled:opacity-40 disabled:cursor-not-allowed bg-violet-500/20 border-violet-500/40 text-violet-200 hover:bg-violet-500/30">
                <Icon name="Save" size={13} />
                {currentPlanId ? "Сохранить" : "Сохранить"}
              </button>

              {/* Сохранить как */}
              <button onClick={() => { setSaveAsMode(v => !v); setSaveAsName(currentPlanName); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold border transition bg-white/[0.04] border-white/[0.08] text-white/50 hover:bg-white/[0.08]">
                <Icon name="CopyPlus" size={13} />
                Сохранить как…
              </button>

              {/* Новый план */}
              <button onClick={() => { onNew(); onClose(); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold border transition bg-white/[0.04] border-white/[0.08] text-white/50 hover:bg-white/[0.08] ml-auto">
                <Icon name="Plus" size={13} />
                Новый
              </button>
            </div>
          ) : (
            <button onClick={onLoginRequest}
              className="mt-2.5 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[12px] font-bold border bg-violet-500/15 border-violet-500/30 text-violet-300 hover:bg-violet-500/25 transition">
              <Icon name="LogIn" size={14} />
              Войти чтобы сохранить планы в облако
            </button>
          )}

          {/* Форма "Сохранить как" */}
          {saveAsMode && (
            <div className="flex gap-2 mt-2">
              <input autoFocus
                value={saveAsName}
                onChange={e => setSaveAsName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSaveAs(); if (e.key === "Escape") setSaveAsMode(false); }}
                placeholder="Название нового плана"
                className="flex-1 bg-white/[0.07] border border-violet-500/40 rounded-xl px-3 py-1.5 text-[12px] text-white focus:outline-none"
              />
              <button onClick={handleSaveAs}
                className="px-4 py-1.5 rounded-xl bg-violet-500/25 border border-violet-500/40 text-violet-200 text-[12px] font-bold hover:bg-violet-500/35 transition">
                Создать
              </button>
              <button onClick={() => setSaveAsMode(false)}
                className="px-2 py-1.5 rounded-xl bg-white/[0.04] text-white/30 text-[12px] hover:bg-white/[0.08] transition">
                <Icon name="X" size={13} />
              </button>
            </div>
          )}
        </div>

        {/* ── Список планов ── */}
        <div className="flex-1 overflow-y-auto">
          {!isLoggedIn && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-white/25">
              <Icon name="Lock" size={32} className="opacity-30" />
              <p className="text-[13px] font-medium">Войдите чтобы видеть сохранённые планы</p>
            </div>
          )}

          {isLoggedIn && loading && (
            <div className="flex items-center justify-center py-12 gap-3 text-white/30">
              <div className="w-5 h-5 rounded-full border-2 border-violet-500/40 border-t-violet-400 animate-spin" />
              <span className="text-[12px]">Загрузка…</span>
            </div>
          )}

          {isLoggedIn && !loading && plans.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-white/25">
              <Icon name="FileX" size={32} className="opacity-30" />
              <p className="text-[13px]">Нет сохранённых планов</p>
              <p className="text-[11px] text-white/20">Нарисуй план и нажми «Сохранить»</p>
            </div>
          )}

          {isLoggedIn && !loading && plans.length > 0 && (
            <div className="divide-y divide-white/[0.05]">
              {plans.map(plan => (
                <div key={plan.id} className={`flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition group ${plan.id === currentPlanId ? "bg-violet-500/5" : ""}`}>

                  {/* Превью */}
                  <div className="w-14 h-14 rounded-xl bg-[#0f1117] border border-white/[0.08] overflow-hidden shrink-0 flex items-center justify-center cursor-pointer"
                    onClick={() => { onLoad(plan.id); onClose(); }}>
                    {plan.thumbnail
                      ? <img src={plan.thumbnail} className="w-full h-full object-contain p-1" alt="" />
                      : <Icon name="PenTool" size={18} className="text-white/15" />
                    }
                  </div>

                  {/* Инфо */}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { if (renamingId !== plan.id) { onLoad(plan.id); onClose(); } }}>
                    {renamingId === plan.id ? (
                      <input autoFocus
                        value={renameVal}
                        onChange={e => setRenameVal(e.target.value)}
                        onBlur={() => handleRenameConfirm(plan.id)}
                        onKeyDown={e => {
                          if (e.key === "Enter") handleRenameConfirm(plan.id);
                          if (e.key === "Escape") { setRenamingId(null); }
                          e.stopPropagation();
                        }}
                        onClick={e => e.stopPropagation()}
                        className="w-full bg-white/[0.08] border border-violet-500/50 rounded-lg px-2 py-1 text-[13px] text-white focus:outline-none"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className={`text-[13px] font-semibold truncate ${plan.id === currentPlanId ? "text-violet-300" : "text-white/80"}`}>
                          {plan.name}
                        </p>
                        {plan.id === currentPlanId && (
                          <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-md bg-violet-500/20 text-violet-400 font-bold">открыт</span>
                        )}
                      </div>
                    )}
                    <p className="text-[11px] text-white/30 mt-0.5 truncate">
                      {timeAgo(plan.updated_at)} · {plan.size_kb} KB
                    </p>
                  </div>

                  {/* Действия */}
                  {renamingId !== plan.id && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 sm:opacity-100 transition shrink-0">
                      {/* Переименовать */}
                      <button onClick={e => { e.stopPropagation(); setRenamingId(plan.id); setRenameVal(plan.name); }}
                        className="w-8 h-8 rounded-lg hover:bg-white/[0.08] flex items-center justify-center transition" title="Переименовать">
                        <Icon name="Pencil" size={13} className="text-white/35 hover:text-white/60" />
                      </button>

                      {/* Удалить */}
                      {confirmDeleteId === plan.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={e => { e.stopPropagation(); onDelete(plan.id); setConfirmDeleteId(null); }}
                            className="h-8 px-2 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[11px] font-bold hover:bg-rose-500/30 transition">
                            Удалить
                          </button>
                          <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); }}
                            className="w-8 h-8 rounded-lg hover:bg-white/[0.08] flex items-center justify-center transition">
                            <Icon name="X" size={13} className="text-white/35" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(plan.id); }}
                          className="w-8 h-8 rounded-lg hover:bg-rose-500/10 flex items-center justify-center transition" title="Удалить">
                          <Icon name="Trash2" size={13} className="text-white/25 hover:text-rose-400" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Футер ── */}
        {isLoggedIn && plans.length > 0 && (
          <div className="px-5 py-3 border-t border-white/[0.06] shrink-0 flex items-center justify-between">
            <span className="text-[10px] text-white/20">{plans.length} из 20 планов</span>
            <div className="w-24 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
              <div className="h-full rounded-full bg-violet-500/50 transition-all" style={{ width: `${(plans.length / 20) * 100}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
