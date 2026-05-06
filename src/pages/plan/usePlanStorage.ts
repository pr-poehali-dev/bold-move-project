import { useState, useCallback, useRef } from "react";
import type { PlanState } from "./planTypes";
import { getSvgDataUrl } from "./planExport";
import func2url from "@/../backend/func2url.json";

const API_URL = (func2url as Record<string, string>)["room-plans"];

export interface PlanMeta {
  id: number;
  name: string;
  thumbnail: string | null;
  created_at: string;
  updated_at: string;
  size_kb: number;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UsePlanStorageReturn {
  // Текущий открытый план
  currentPlanId: number | null;
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  isDirty: boolean;

  // Список планов
  plans: PlanMeta[];
  plansLoading: boolean;

  // Операции
  loadPlans: (token: string) => Promise<void>;
  save: (state: PlanState, token: string, name?: string) => Promise<number | null>;
  saveAs: (state: PlanState, token: string, name: string) => Promise<number | null>;
  load: (planId: number, token: string) => Promise<PlanState | null>;
  deletePlan: (planId: number, token: string) => Promise<boolean>;
  rename: (planId: number, name: string, token: string) => Promise<boolean>;
  markDirty: () => void;
  markClean: () => void;
  newPlan: () => void;
}

async function apiFetch(path: string, token: string, options?: RequestInit) {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Authorization": `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  });
  return res.json();
}

export function usePlanStorage(): UsePlanStorageReturn {
  const [currentPlanId, setCurrentPlanId] = useState<number | null>(null);
  const [saveStatus,    setSaveStatus]    = useState<SaveStatus>("idle");
  const [lastSavedAt,   setLastSavedAt]   = useState<Date | null>(null);
  const [isDirty,       setIsDirty]       = useState(false);
  const [plans,         setPlans]         = useState<PlanMeta[]>([]);
  const [plansLoading,  setPlansLoading]  = useState(false);

  // Debounce ref для автосохранения
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Список планов ─────────────────────────────────────────────────────────
  const loadPlans = useCallback(async (token: string) => {
    setPlansLoading(true);
    try {
      const data = await apiFetch("?action=list", token);
      if (data.plans) setPlans(data.plans);
    } catch {
      // ignore
    } finally {
      setPlansLoading(false);
    }
  }, []);

  // ── Сохранить (update если есть id, create если нет) ─────────────────────
  const save = useCallback(async (
    state: PlanState,
    token: string,
    name?: string
  ): Promise<number | null> => {
    setSaveStatus("saving");
    try {
      // Генерируем мини-превью SVG
      const thumbnail = state.points.length >= 2 ? getSvgDataUrl(state, 0.3) : null;

      const body = {
        id:        currentPlanId,
        name:      name ?? state.room.name ?? "Новый план",
        data:      state,
        thumbnail: thumbnail?.slice(0, 4000) ?? null, // ограничиваем размер
      };

      const data = await apiFetch("?action=save", token, {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (data.error) throw new Error(data.error);

      const newId = data.id as number;
      setCurrentPlanId(newId);
      setLastSavedAt(new Date());
      setSaveStatus("saved");
      setIsDirty(false);

      // Обновляем список
      setPlans(prev => {
        const exists = prev.find(p => p.id === newId);
        const meta: PlanMeta = {
          id:         newId,
          name:       body.name,
          thumbnail:  thumbnail?.slice(0, 4000) ?? null,
          created_at: data.created_at ?? new Date().toISOString(),
          updated_at: data.updated_at ?? new Date().toISOString(),
          size_kb:    Math.round(JSON.stringify(state).length / 1024 * 10) / 10,
        };
        if (exists) return prev.map(p => p.id === newId ? meta : p);
        return [meta, ...prev];
      });

      // Автосброс статуса через 3с
      setTimeout(() => setSaveStatus("idle"), 3000);
      return newId;
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 4000);
      return null;
    }
  }, [currentPlanId]);

  // ── Сохранить как новый ───────────────────────────────────────────────────
  const saveAs = useCallback(async (
    state: PlanState,
    token: string,
    name: string
  ): Promise<number | null> => {
    const prevId = currentPlanId;
    setCurrentPlanId(null); // сбрасываем id чтобы создать новый
    const newId = await save({ ...state, room: { ...state.room, name } }, token, name);
    if (!newId) setCurrentPlanId(prevId); // откат если ошибка
    return newId;
  }, [currentPlanId, save]);

  // ── Загрузить план ────────────────────────────────────────────────────────
  const load = useCallback(async (
    planId: number,
    token: string
  ): Promise<PlanState | null> => {
    try {
      const data = await apiFetch(`?action=get&id=${planId}`, token);
      if (data.error || !data.plan) return null;
      const state = data.plan.data as PlanState;
      setCurrentPlanId(planId);
      setLastSavedAt(new Date(data.plan.updated_at));
      setIsDirty(false);
      setSaveStatus("idle");
      return state;
    } catch {
      return null;
    }
  }, []);

  // ── Удалить план ──────────────────────────────────────────────────────────
  const deletePlan = useCallback(async (
    planId: number,
    token: string
  ): Promise<boolean> => {
    try {
      const data = await apiFetch("?action=delete", token, {
        method: "POST",
        body: JSON.stringify({ id: planId }),
      });
      if (data.error) return false;
      setPlans(prev => prev.filter(p => p.id !== planId));
      if (currentPlanId === planId) {
        setCurrentPlanId(null);
        setLastSavedAt(null);
        setIsDirty(false);
      }
      return true;
    } catch {
      return false;
    }
  }, [currentPlanId]);

  // ── Переименовать ─────────────────────────────────────────────────────────
  const rename = useCallback(async (
    planId: number,
    name: string,
    token: string
  ): Promise<boolean> => {
    try {
      const data = await apiFetch("?action=rename", token, {
        method: "POST",
        body: JSON.stringify({ id: planId, name }),
      });
      if (data.error) return false;
      setPlans(prev => prev.map(p => p.id === planId ? { ...p, name } : p));
      return true;
    } catch {
      return false;
    }
  }, []);

  const markDirty = useCallback(() => setIsDirty(true), []);
  const markClean = useCallback(() => setIsDirty(false), []);
  const newPlan   = useCallback(() => {
    setCurrentPlanId(null);
    setLastSavedAt(null);
    setIsDirty(false);
    setSaveStatus("idle");
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
  }, []);

  return {
    currentPlanId, saveStatus, lastSavedAt, isDirty,
    plans, plansLoading,
    loadPlans, save, saveAs, load, deletePlan, rename,
    markDirty, markClean, newPlan,
  };
}
