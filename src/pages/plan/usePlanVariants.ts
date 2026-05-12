import { useState, useCallback } from "react";
import func2url from "@/../backend/func2url.json";
import type { PlanState } from "./planTypes";
import { getSvgDataUrl } from "./planExport";

const CRM_URL = (func2url as Record<string, string>)["crm-manager"];

function headers(token?: string | null) {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export interface PlanVariant {
  id: number;
  room_id: number;
  name: string;
  data: object;
  thumbnail: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function usePlanVariants(token?: string | null) {
  const [variants,  setVariants]  = useState<PlanVariant[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);

  const loadVariants = useCallback(async (roomId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${CRM_URL}?r=plan-variants&room_id=${roomId}`, {
        headers: headers(token),
      });
      const data = await res.json();
      setVariants(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const saveVariant = useCallback(async (
    roomId: number,
    name: string,
    state: PlanState
  ): Promise<number | null> => {
    setSaving(true);
    try {
      const thumbnail = state.points.length >= 2
        ? (getSvgDataUrl(state, 0.4) ?? "").slice(0, 8000)
        : null;

      const res = await fetch(`${CRM_URL}?r=plan-variants`, {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify({
          room_id: roomId,
          name,
          data: state,
          ...(thumbnail ? { thumbnail } : {}),
        }),
      });
      const data = await res.json();
      if (data.error) return null;
      await loadVariants(roomId);
      return data.id as number;
    } finally {
      setSaving(false);
    }
  }, [token, loadVariants]);

  const updateVariant = useCallback(async (
    variantId: number,
    body: { name?: string; data?: PlanState; thumbnail?: string; is_active?: boolean }
  ) => {
    await fetch(`${CRM_URL}?r=plan-variants&id=${variantId}`, {
      method: "PUT",
      headers: headers(token),
      body: JSON.stringify(body),
    });
  }, [token]);

  const deleteVariant = useCallback(async (variantId: number, roomId: number) => {
    await fetch(`${CRM_URL}?r=plan-variants&id=${variantId}`, {
      method: "DELETE",
      headers: headers(token),
    });
    await loadVariants(roomId);
  }, [token, loadVariants]);

  return { variants, loading, saving, loadVariants, saveVariant, updateVariant, deleteVariant, setVariants };
}
