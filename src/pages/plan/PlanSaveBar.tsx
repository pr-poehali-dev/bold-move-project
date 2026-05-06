import React, { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import type { PlanState } from "./planTypes";
import type { PlanMeta, SaveStatus } from "./usePlanStorage";

interface Props {
  // Состояние
  currentPlanId: number | null;
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  isDirty: boolean;
  plans: PlanMeta[];
  plansLoading: boolean;
  isLoggedIn: boolean;

  // Колбэки
  onSave: () => void;
  onSaveAs: (name: string) => void;
  onLoad: (planId: number) => void;
  onDelete: (planId: number) => void;
  onRename: (planId: number, name: string) => void;
  onNew: () => void;
  onLoginRequest: () => void;

  state: PlanState;
}

function timeAgo(date: Date): string {
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  if (s < 10)  return "только что";
  if (s < 60)  return `${s} с назад`;
  if (s < 3600) return `${Math.round(s / 60)} мин назад`;
  return `${Math.round(s / 3600)} ч назад`;
}

export default function PlanSaveBar({
  currentPlanId, saveStatus, lastSavedAt, isDirty, plans, plansLoading,
  isLoggedIn, onSave, onSaveAs, onLoad, onDelete, onRename, onNew, onLoginRequest, state,
}: Props) {
  const [showPlans,   setShowPlans]   = useState(false);
  const [showSaveAs,  setShowSaveAs]  = useState(false);
  const [saveAsName,  setSaveAsName]  = useState("");
  const [renamingId,  setRenamingId]  = useState<number | null>(null);
  const [renameVal,   setRenameVal]   = useState("");
  const [timeStr,     setTimeStr]     = useState("");

  // Обновляем "N минут назад" каждые 15с
  useEffect(() => {
    if (!lastSavedAt) return;
    const update = () => setTimeStr(timeAgo(lastSavedAt));
    update();
    const id = setInterval(update, 15000);
    return () => clearInterval(id);
  }, [lastSavedAt]);

  // Статус иконка и текст
  const statusIcon =
    saveStatus === "saving" ? "Loader2" :
    saveStatus === "saved"  ? "CheckCircle2" :
    saveStatus === "error"  ? "AlertCircle" :
    isDirty ? "Circle" : "Cloud";

  const statusColor =
    saveStatus === "saving" ? "text-blue-400" :
    saveStatus === "saved"  ? "text-emerald-400" :
    saveStatus === "error"  ? "text-rose-400" :
    isDirty ? "text-amber-400" : "text-white/25";

  const statusText =
    saveStatus === "saving" ? "Сохранение…" :
    saveStatus === "saved"  ? `Сохранено ${timeStr}` :
    saveStatus === "error"  ? "Ошибка сохранения" :
    isDirty ? "Есть несохранённые изменения" :
    lastSavedAt ? `Сохранено ${timeStr}` : "Не сохранён";

  const handleSaveAsConfirm = () => {
    const n = saveAsName.trim() || state.room.name || "Новый план";
    onSaveAs(n);
    setShowSaveAs(false);
    setSaveAsName("");
  };

  const handleRenameConfirm = (id: number) => {
    if (renameVal.trim()) onRename(id, renameVal.trim());
    setRenamingId(null);
    setRenameVal("");
  };

  const planName = currentPlanId
    ? (plans.find(p => p.id === currentPlanId)?.name ?? state.room.name)
    : state.room.name;

  return (
    <div className="relative flex items-center gap-1.5">

      {/* Индикатор статуса */}
      <div className={`flex items-center gap-1.5 px-2 h-8 rounded-lg text-[11px] font-medium transition-colors ${statusColor}`}>
        <Icon
          name={statusIcon}
          size={13}
          className={saveStatus === "saving" ? "animate-spin" : ""}
        />
        <span className="hidden sm:inline max-w-[140px] truncate">{statusText}</span>
      </div>

      {/* Кнопки */}
      {!isLoggedIn ? (
        <button
          onClick={onLoginRequest}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-bold border bg-violet-500/15 border-violet-500/30 text-violet-300 hover:bg-violet-500/25 transition"
        >
          <Icon name="LogIn" size={13} />
          <span className="hidden sm:inline">Войти чтобы сохранить</span>
          <span className="sm:hidden">Войти</span>
        </button>
      ) : (
        <>
          {/* Ctrl+S / Сохранить */}
          <button
            onClick={onSave}
            disabled={saveStatus === "saving"}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-bold border transition disabled:opacity-50 ${
              isDirty
                ? "bg-violet-500/25 border-violet-500/50 text-violet-200 hover:bg-violet-500/35"
                : "bg-white/[0.04] border-white/[0.08] text-white/40 hover:bg-white/[0.08]"
            }`}
            title="Сохранить (Ctrl+S)"
          >
            <Icon name="Save" size={13} />
            <span className="hidden sm:inline">{currentPlanId ? "Сохранить" : "Сохранить"}</span>
          </button>

          {/* Мои планы */}
          <button
            onClick={() => setShowPlans(v => !v)}
            className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[11px] font-semibold border transition ${
              showPlans
                ? "bg-white/[0.08] border-white/[0.15] text-white/70"
                : "bg-white/[0.03] border-white/[0.08] text-white/40 hover:bg-white/[0.07]"
            }`}
            title="Мои планы"
          >
            <Icon name="FolderOpen" size={13} />
            <span className="hidden md:inline">Мои планы</span>
            {plans.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-violet-500/30 text-violet-300 text-[9px] flex items-center justify-center font-bold">
                {plans.length}
              </span>
            )}
          </button>
        </>
      )}

      {/* ── Дропдаун со списком планов ── */}
      {showPlans && isLoggedIn && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowPlans(false)} />
          <div className="absolute top-full right-0 mt-1.5 z-40 w-80 bg-[#1a1b2e] border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden">

            {/* Шапка */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.07]">
              <Icon name="FolderOpen" size={14} className="text-violet-400" />
              <span className="text-sm font-bold text-white/80 flex-1">Мои планы</span>
              <button
                onClick={() => { onNew(); setShowPlans(false); }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border bg-violet-500/15 border-violet-500/30 text-violet-300 hover:bg-violet-500/25 transition"
              >
                <Icon name="Plus" size={11} /> Новый
              </button>
            </div>

            {/* Список */}
            <div className="max-h-72 overflow-y-auto">
              {plansLoading && (
                <div className="flex items-center justify-center py-8 gap-2 text-white/30 text-xs">
                  <div className="w-4 h-4 rounded-full border-2 border-violet-500/40 border-t-violet-400 animate-spin" />
                  Загрузка…
                </div>
              )}
              {!plansLoading && plans.length === 0 && (
                <div className="text-center py-8 text-white/25 text-xs">
                  <Icon name="FileX" size={24} className="mx-auto mb-2 opacity-30" />
                  Нет сохранённых планов
                </div>
              )}
              {!plansLoading && plans.map(plan => (
                <div key={plan.id}
                  className={`flex items-center gap-2.5 px-4 py-2.5 hover:bg-white/[0.04] transition cursor-pointer group border-b border-white/[0.04] ${
                    plan.id === currentPlanId ? "bg-violet-500/8" : ""
                  }`}
                  onClick={() => { if (renamingId !== plan.id) { onLoad(plan.id); setShowPlans(false); } }}
                >
                  {/* Превью */}
                  <div className="w-10 h-10 rounded-lg bg-white/[0.05] border border-white/[0.08] overflow-hidden shrink-0 flex items-center justify-center">
                    {plan.thumbnail
                      ? <img src={plan.thumbnail} className="w-full h-full object-contain" alt="" />
                      : <Icon name="PenTool" size={14} className="text-white/15" />
                    }
                  </div>

                  {/* Имя */}
                  <div className="flex-1 min-w-0">
                    {renamingId === plan.id ? (
                      <input
                        autoFocus
                        value={renameVal}
                        onChange={e => setRenameVal(e.target.value)}
                        onBlur={() => handleRenameConfirm(plan.id)}
                        onKeyDown={e => {
                          if (e.key === "Enter") handleRenameConfirm(plan.id);
                          if (e.key === "Escape") { setRenamingId(null); }
                          e.stopPropagation();
                        }}
                        onClick={e => e.stopPropagation()}
                        className="w-full bg-white/[0.08] border border-violet-500/40 rounded-lg px-2 py-0.5 text-xs text-white focus:outline-none"
                      />
                    ) : (
                      <>
                        <p className={`text-[12px] font-semibold truncate ${plan.id === currentPlanId ? "text-violet-300" : "text-white/75"}`}>
                          {plan.name}
                          {plan.id === currentPlanId && <span className="ml-1.5 text-[9px] text-violet-400/70">● открыт</span>}
                        </p>
                        <p className="text-[10px] text-white/25 truncate">
                          {new Date(plan.updated_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          {" · "}{plan.size_kb} KB
                        </p>
                      </>
                    )}
                  </div>

                  {/* Действия */}
                  {renamingId !== plan.id && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); setRenamingId(plan.id); setRenameVal(plan.name); }}
                        className="w-7 h-7 rounded-lg hover:bg-white/[0.08] flex items-center justify-center transition"
                        title="Переименовать"
                      >
                        <Icon name="Pencil" size={11} className="text-white/40" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); if (confirm(`Удалить план «${plan.name}»?`)) onDelete(plan.id); }}
                        className="w-7 h-7 rounded-lg hover:bg-rose-500/20 flex items-center justify-center transition"
                        title="Удалить"
                      >
                        <Icon name="Trash2" size={11} className="text-rose-400/50 hover:text-rose-400" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Сохранить как */}
            <div className="px-4 py-3 border-t border-white/[0.07]">
              {showSaveAs ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={saveAsName}
                    onChange={e => setSaveAsName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSaveAsConfirm(); if (e.key === "Escape") setShowSaveAs(false); }}
                    placeholder={state.room.name || "Название плана"}
                    className="flex-1 bg-white/[0.07] border border-violet-500/40 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  />
                  <button onClick={handleSaveAsConfirm}
                    className="px-3 py-1.5 rounded-xl bg-violet-500/25 border border-violet-500/40 text-violet-300 text-xs font-bold hover:bg-violet-500/35 transition">
                    ОК
                  </button>
                  <button onClick={() => setShowSaveAs(false)}
                    className="px-2 py-1.5 rounded-xl bg-white/[0.04] text-white/30 text-xs hover:bg-white/[0.08] transition">
                    <Icon name="X" size={12} />
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowSaveAs(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold border bg-white/[0.03] border-white/[0.08] text-white/40 hover:bg-white/[0.07] hover:text-white/60 transition">
                  <Icon name="CopyPlus" size={12} />
                  Сохранить как новый
                </button>
              )}
            </div>

          </div>
        </>
      )}
    </div>
  );
}
