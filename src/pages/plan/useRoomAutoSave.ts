import { useEffect, useRef, useState } from "react";
import type { PlanState } from "./planTypes";
import { getSvgDataUrl } from "./planExport";
import func2url from "@/../backend/func2url.json";

const CRM_URL = (func2url as Record<string, string>)["crm-manager"];

export type RoomSaveStatus = "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 3000;
const THUMBNAIL_MAX = 8000; // bytes для base64

export function useRoomAutoSave(
  roomId: number | null,
  state: PlanState,
  token: string | null | undefined,
  activeVariantId?: number | null,
  projectId?: number | null
) {
  const [saveStatus, setSaveStatus] = useState<RoomSaveStatus>("idle");
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef    = useRef<string>("");
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const variantIdRef = useRef<number | null | undefined>(activeVariantId);
  variantIdRef.current = activeVariantId;
  const projectIdRef = useRef<number | null | undefined>(projectId);
  projectIdRef.current = projectId;

  const stateStr = JSON.stringify(state);

  const doSave = async (planState: PlanState) => {
    if (!roomId || !token) return;
    setSaveStatus("saving");
    try {
      const thumbnail = planState.points.length >= 2
        ? (getSvgDataUrl(planState, 0.4) ?? "").slice(0, THUMBNAIL_MAX)
        : null;

      const varId = variantIdRef.current;
      if (varId) {
        // Есть активный вариант — перезаписываем его
        await fetch(`${CRM_URL}?r=plan-variants&id=${varId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({
            data: planState,
            is_active: true,
            ...(thumbnail ? { thumbnail } : {}),
          }),
        });
      }
      // Всегда обновляем room.data как черновик (для быстрой загрузки)
      await fetch(`${CRM_URL}?r=plan-rooms&id=${roomId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          data: planState,
          ...(thumbnail ? { thumbnail } : {}),
        }),
      });

      // Синхронизируем updated_at заявки в CRM — чтобы смета знала что состав изменился
      const pid = projectIdRef.current;
      if (pid) {
        fetch(`${CRM_URL}?r=plan-crm-sync&project_id=${pid}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({}),
        }).catch(() => {});
      }

      savedRef.current = stateStr;
      setSaveStatus("saved");
      if (statusTimer.current) clearTimeout(statusTimer.current);
      statusTimer.current = setTimeout(() => setSaveStatus("idle"), 2500);
    } catch {
      setSaveStatus("error");
      if (statusTimer.current) clearTimeout(statusTimer.current);
      statusTimer.current = setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  useEffect(() => {
    if (!roomId || !token) return;
    if (stateStr === savedRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSave(state), DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateStr, roomId, token]);

  // Сброс при смене комнаты
  useEffect(() => {
    savedRef.current = "";
    setSaveStatus("idle");
    if (timerRef.current) clearTimeout(timerRef.current);
    if (statusTimer.current) clearTimeout(statusTimer.current);
  }, [roomId]);

  return { saveStatus };
}