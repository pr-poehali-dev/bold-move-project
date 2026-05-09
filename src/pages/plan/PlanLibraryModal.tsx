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
  if (s < 60)    return "только что";
  if (s < 3600)  return `${Math.round(s / 60)} мин назад`;
  if (s < 86400) return `${Math.round(s / 3600)} ч назад`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)} дн назад`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export default function PlanLibraryModal({
  plans, loading, saveStatus, lastSavedAt, isDirty,
  currentPlanId, currentPlanName, isLoggedIn,
  onClose, onLoad, onSave, onSaveAs, onDelete, onRename, onNew, onLoginRequest,
}: Props) {
  const [renamingId,     setRenamingId]     = useState<number | null>(null);
  const [renameVal,      setRenameVal]      = useState("");
  const [saveAsMode,     setSaveAsMode]     = useState(false);
  const [saveAsName,     setSaveAsName]     = useState(currentPlanName);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [hoveredId,      setHoveredId]      = useState<number | null>(null);

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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl bg-[#13141f] sm:rounded-2xl rounded-t-2xl border border-white/[0.1] shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "90dvh" }}>

        {/* ── Шапка ── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.07] shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-900/30">
            <Icon name="FolderOpen" size={16} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-bold text-white/90">Сохранённые потолки</p>
            <p className="text-[11px] text-white/35">
              {isLoggedIn ? `${plans.length} из 20 · облачное хранилище` : "Войдите для доступа"}
            </p>
          </div>
          <button onClick={onNew}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-300 text-[12px] font-semibold hover:bg-violet-600/30 transition mr-1">
            <Icon name="Plus" size={13} />
            Новый
          </button>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center transition">
            <Icon name="X" size={14} className="text-white/50" />
          </button>
        </div>

        {/* ── Текущий план ── */}
        <div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.015] shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-white/30 mb-0.5 uppercase tracking-wide font-medium">Открытый сейчас</p>
              <p className="text-[13px] font-semibold text-white/80 truncate">
                {currentPlanName || "Без названия"}
                {currentPlanId && <span className="ml-1.5 text-[10px] text-violet-400/50 font-normal">#{currentPlanId}</span>}
              </p>
            </div>
            <div className={`flex items-center gap-1.5 text-[11px] font-medium shrink-0 ${statusColor}`}>
              <Icon name={statusIcon} size={13} className={saveStatus === "saving" ? "animate-spin" : ""} />
              <span className="hidden sm:inline">{statusText}</span>
            </div>
          </div>

          {isLoggedIn ? (
            <div className="flex gap-2 mt-2.5 flex-wrap">
              <button onClick={() => onSave()}
                disabled={saveStatus === "saving" || (!isDirty && !!currentPlanId)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition disabled:opacity-40 disabled:cursor-not-allowed bg-violet-500/20 border-violet-500/40 text-violet-200 hover:bg-violet-500/30">
                <Icon name="Save" size={12} />
                Сохранить
              </button>
              <button onClick={() => { setSaveAsMode(v => !v); setSaveAsName(currentPlanName); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition bg-white/[0.04] border-white/[0.08] text-white/50 hover:bg-white/[0.08]">
                <Icon name="CopyPlus" size={12} />
                Сохранить как…
              </button>
            </div>
          ) : (
            <button onClick={onLoginRequest}
              className="mt-2.5 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[12px] font-bold border bg-violet-500/15 border-violet-500/30 text-violet-300 hover:bg-violet-500/25 transition">
              <Icon name="LogIn" size={14} />
              Войти чтобы сохранять планы в облако
            </button>
          )}

          {saveAsMode && (
            <div className="flex gap-2 mt-2.5">
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

        {/* ── Список ── */}
        <div className="flex-1 overflow-y-auto p-4">
          {!isLoggedIn && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/25">
              <Icon name="Lock" size={36} className="opacity-25" />
              <p className="text-[13px] font-medium">Войдите чтобы видеть сохранённые планы</p>
            </div>
          )}

          {isLoggedIn && loading && (
            <div className="flex items-center justify-center py-16 gap-3 text-white/30">
              <div className="w-5 h-5 rounded-full border-2 border-violet-500/40 border-t-violet-400 animate-spin" />
              <span className="text-[12px]">Загрузка…</span>
            </div>
          )}

          {isLoggedIn && !loading && plans.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/25">
              <Icon name="FileX" size={36} className="opacity-25" />
              <p className="text-[13px] font-medium">Нет сохранённых планов</p>
              <p className="text-[11px] text-white/20">Нарисуй план и нажми «Сохранить»</p>
            </div>
          )}

          {isLoggedIn && !loading && plans.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {plans.map(plan => {
                const isCurrent = plan.id === currentPlanId;
                const isHovered = hoveredId === plan.id;

                return (
                  <div
                    key={plan.id}
                    className={`relative rounded-2xl border overflow-hidden cursor-pointer transition-all group
                      ${isCurrent
                        ? "border-violet-500/60 bg-violet-500/8 shadow-lg shadow-violet-900/20"
                        : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.16] hover:bg-white/[0.05]"
                      }`}
                    onMouseEnter={() => setHoveredId(plan.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => {
                      if (renamingId === plan.id) return;
                      onLoad(plan.id);
                      onClose();
                    }}
                  >
                    {/* Превью */}
                    <div className="relative aspect-[4/3] bg-[#0c0d18] flex items-center justify-center overflow-hidden">
                      {plan.thumbnail ? (
                        <img
                          src={plan.thumbnail}
                          className="w-full h-full object-contain p-3"
                          alt={plan.name}
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 opacity-20">
                          <Icon name="PenTool" size={28} />
                          <span className="text-[10px]">Нет превью</span>
                        </div>
                      )}

                      {/* Бейдж "открыт" */}
                      {isCurrent && (
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-violet-600/90 text-[9px] font-bold text-white uppercase tracking-wide">
                          открыт
                        </div>
                      )}

                      {/* Кнопки действий при наведении */}
                      {(isHovered || confirmDeleteId === plan.id) && renamingId !== plan.id && (
                        <div
                          className="absolute top-2 right-2 flex items-center gap-1"
                          onClick={e => e.stopPropagation()}
                        >
                          {/* Переименовать */}
                          <button
                            onClick={() => { setRenamingId(plan.id); setRenameVal(plan.name); }}
                            className="w-7 h-7 rounded-lg bg-black/60 border border-white/10 flex items-center justify-center hover:bg-white/20 transition"
                            title="Переименовать"
                          >
                            <Icon name="Pencil" size={11} className="text-white/70" />
                          </button>

                          {/* Удалить */}
                          {confirmDeleteId === plan.id ? (
                            <>
                              <button
                                onClick={() => { onDelete(plan.id); setConfirmDeleteId(null); }}
                                className="h-7 px-2 rounded-lg bg-rose-600/80 border border-rose-400/30 text-white text-[10px] font-bold hover:bg-rose-600 transition"
                              >
                                Да
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="w-7 h-7 rounded-lg bg-black/60 border border-white/10 flex items-center justify-center hover:bg-white/20 transition"
                              >
                                <Icon name="X" size={11} className="text-white/70" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(plan.id)}
                              className="w-7 h-7 rounded-lg bg-black/60 border border-white/10 flex items-center justify-center hover:bg-rose-500/40 transition"
                              title="Удалить"
                            >
                              <Icon name="Trash2" size={11} className="text-white/70 hover:text-rose-300" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Инфо */}
                    <div className="px-3 py-2.5">
                      {renamingId === plan.id ? (
                        <input
                          autoFocus
                          value={renameVal}
                          onChange={e => setRenameVal(e.target.value)}
                          onBlur={() => handleRenameConfirm(plan.id)}
                          onKeyDown={e => {
                            if (e.key === "Enter") handleRenameConfirm(plan.id);
                            if (e.key === "Escape") setRenamingId(null);
                            e.stopPropagation();
                          }}
                          onClick={e => e.stopPropagation()}
                          className="w-full bg-white/[0.1] border border-violet-500/50 rounded-lg px-2 py-1 text-[12px] text-white focus:outline-none"
                        />
                      ) : (
                        <p className={`text-[12px] font-semibold truncate leading-tight ${isCurrent ? "text-violet-300" : "text-white/80"}`}>
                          {plan.name}
                        </p>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        <Icon name="Clock" size={9} className="text-white/25 shrink-0" />
                        <p className="text-[10px] text-white/30 truncate">{timeAgo(plan.updated_at)}</p>
                        <span className="text-white/15 text-[10px]">·</span>
                        <p className="text-[10px] text-white/20 shrink-0">{plan.size_kb} KB</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Футер ── */}
        {isLoggedIn && plans.length > 0 && (
          <div className="px-5 py-3 border-t border-white/[0.06] shrink-0 flex items-center justify-between gap-4">
            <span className="text-[10px] text-white/25">{plans.length} из 20 планов</span>
            <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full bg-violet-500/40 transition-all" style={{ width: `${(plans.length / 20) * 100}%` }} />
            </div>
            <span className="text-[10px] text-white/15">{20 - plans.length} свободно</span>
          </div>
        )}
      </div>
    </div>
  );
}
