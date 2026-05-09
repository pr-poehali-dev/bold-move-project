import React from "react";
import Icon from "@/components/ui/icon";
import PlanExportModal from "./PlanExportModal";
import PlanLibraryModal from "./PlanLibraryModal";
import AuthModal from "@/components/AuthModal";
import type { PlanState } from "./planTypes";
import type { PlanMeta, SaveStatus } from "./usePlanStorage";

interface StorageLike {
  plans: PlanMeta[];
  plansLoading: boolean;
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  isDirty: boolean;
  currentPlanId: number | null;
}

interface Props {
  state: PlanState;
  isMobile: boolean;
  isLoggedIn: boolean;
  currentPlanName: string;
  exportOpen: boolean;
  libraryOpen: boolean;
  authOpen: boolean;
  showOnboarding: boolean;
  storage: StorageLike;
  onCloseExport: () => void;
  onCloseLibrary: () => void;
  onCloseAuth: () => void;
  onCloseOnboarding: () => void;
  onLoginRequest: () => void;
  onLoad: (id: number) => void;
  onSave: () => void;
  onSaveAs: (name: string) => void;
  onDelete: (id: number) => void;
  onRename: (id: number, name: string) => void;
  onNew: () => void;
}

export default function PlanModals({
  state, isMobile, isLoggedIn, currentPlanName,
  exportOpen, libraryOpen, authOpen, showOnboarding,
  storage,
  onCloseExport, onCloseLibrary, onCloseAuth, onCloseOnboarding, onLoginRequest,
  onLoad, onSave, onSaveAs, onDelete, onRename, onNew,
}: Props) {
  return (
    <>
      {/* Модал экспорта */}
      {exportOpen && (
        <PlanExportModal state={state} onClose={onCloseExport} />
      )}

      {/* Модал библиотеки планов */}
      {libraryOpen && (
        <PlanLibraryModal
          plans={storage.plans}
          loading={storage.plansLoading}
          saveStatus={storage.saveStatus}
          lastSavedAt={storage.lastSavedAt}
          isDirty={storage.isDirty}
          currentPlanId={storage.currentPlanId}
          currentPlanName={currentPlanName}
          isLoggedIn={isLoggedIn}
          onClose={onCloseLibrary}
          onLoad={onLoad}
          onSave={onSave}
          onSaveAs={onSaveAs}
          onDelete={onDelete}
          onRename={onRename}
          onNew={onNew}
          onLoginRequest={onLoginRequest}
        />
      )}

      {/* Онбординг для незарегистрированных */}
      {showOnboarding && !isLoggedIn && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-4">
          <div className="bg-[#1a1b2e] border border-violet-500/30 rounded-2xl shadow-2xl p-4 flex gap-3 items-start">
            <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="Cloud" size={16} className="text-violet-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-white/90 mb-0.5">Сохраняй планы в облако</p>
              <p className="text-[11px] text-white/45 leading-relaxed">
                Войди чтобы твои чертежи сохранялись и были доступны с любого устройства
              </p>
              <button
                onClick={() => { onCloseOnboarding(); onLoginRequest(); }}
                className="mt-2.5 w-full py-2 rounded-xl bg-violet-500/25 border border-violet-500/40 text-violet-200 text-[12px] font-bold hover:bg-violet-500/35 transition"
              >
                Войти и сохранить
              </button>
            </div>
            <button
              onClick={onCloseOnboarding}
              className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition shrink-0"
            >
              <Icon name="X" size={13} className="text-white/30" />
            </button>
          </div>
        </div>
      )}

      {/* Статус-бар — только на десктопе */}
      {!isMobile && (
        <div className="h-6 bg-[#111] border-t border-white/[0.07] flex items-center px-4 gap-5 shrink-0">
          <span className="text-[10px] text-white/20 font-mono">Точек: {state.points.length}</span>
          <span className="text-[10px] text-white/20 font-mono">Отрезков: {state.segments.length}</span>
          <span className="text-[10px] text-white/20 font-mono">Диаг: {state.diagonals.length}</span>
          {state.isClosed && <span className="text-[10px] text-emerald-500/50 font-mono">● Замкнуто</span>}
          {isLoggedIn && (
            <span className={`text-[10px] font-mono ml-auto mr-0 ${
              storage.saveStatus === "saving" ? "text-blue-400/70" :
              storage.saveStatus === "saved"  ? "text-emerald-500/50" :
              storage.saveStatus === "error"  ? "text-rose-400/70" :
              storage.isDirty ? "text-amber-400/60" : "text-white/15"
            }`}>
              {storage.saveStatus === "saving" ? "⟳ Сохранение…" :
               storage.saveStatus === "saved"  ? "✓ Сохранён" :
               storage.saveStatus === "error"  ? "✗ Ошибка" :
               storage.isDirty ? "● Не сохранён" : "○ Актуален"}
            </span>
          )}
          <span className="text-[10px] text-white/15 font-mono">
            {state.tool} · {Math.round(state.settings.zoom * 100)}%
            {state.settings.ortho ? " · Орто" : ""}
          </span>
        </div>
      )}

      {/* Модал авторизации */}
      {authOpen && (
        <AuthModal
          onClose={onCloseAuth}
          defaultTab="login"
          onSuccess={onCloseAuth}
        />
      )}
    </>
  );
}