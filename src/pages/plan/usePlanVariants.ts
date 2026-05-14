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
  const [variants,         setVariants]         = useState<PlanVariant[]>([]);
  const [loading,          setLoading]           = useState(false);
  const [saving,           setSaving]            = useState(false);
  const [activeVariantId,  setActiveVariantId]   = useState<number | null>(null);

  const loadVariants = useCallback(async (roomId: number): Promise<PlanVariant[]> => {
    setLoading(true);
    setVariants([]);
    setActiveVariantId(null);
    try {
      const res = await fetch(`${CRM_URL}?r=plan-variants&room_id=${roomId}`, {
        headers: headers(token),
      });
      const data = await res.json();
      const list: PlanVariant[] = Array.isArray(data) ? data : [];
      setVariants(list);
      const active = list.find(v => v.is_active);
      setActiveVariantId(active ? active.id : null);
      return list;
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
          is_active: true,
          ...(thumbnail ? { thumbnail } : {}),
        }),
      });
      const data = await res.json();
      if (data.error) return null;
      const newId = data.id as number;
      setActiveVariantId(newId);
      await loadVariants(roomId);
      return newId;
    } finally {
      setSaving(false);
    }
  }, [token, loadVariants]);

  const updateVariant = useCallback(async (
    variantId: number,
    body: { name?: string; data?: PlanState; thumbnail?: string; is_active?: boolean }
  ) => {
    // Оптимистичное обновление локального списка
    setVariants(prev => prev.map(v => {
      if (v.id !== variantId) return body.is_active ? { ...v, is_active: false } : v;
      return {
        ...v,
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
      };
    }));
    if (body.is_active) setActiveVariantId(variantId);
    await fetch(`${CRM_URL}?r=plan-variants&id=${variantId}`, {
      method: "PUT",
      headers: headers(token),
      body: JSON.stringify(body),
    });
  }, [token]);

  const overwriteVariant = useCallback(async (
    variantId: number,
    roomId: number,
    state: PlanState
  ) => {
    setSaving(true);
    try {
      const thumbnail = state.points.length >= 2
        ? (getSvgDataUrl(state, 0.4) ?? "").slice(0, 8000)
        : null;
      await fetch(`${CRM_URL}?r=plan-variants&id=${variantId}`, {
        method: "PUT",
        headers: headers(token),
        body: JSON.stringify({
          data: state,
          is_active: true,
          ...(thumbnail ? { thumbnail } : {}),
        }),
      });
      await loadVariants(roomId);
    } finally {
      setSaving(false);
    }
  }, [token, loadVariants]);

  const deleteVariant = useCallback(async (variantId: number, _roomId: number) => {
    // Оптимистичное удаление — убираем сразу и не перезагружаем
    setVariants(prev => prev.filter(v => v.id !== variantId));
    if (activeVariantId === variantId) setActiveVariantId(null);
    await fetch(`${CRM_URL}?r=plan-variants&id=${variantId}`, {
      method: "DELETE",
      headers: headers(token),
    });
  }, [token, activeVariantId]);

  return {
    variants, loading, saving,
    activeVariantId, setActiveVariantId,
    loadVariants, saveVariant, updateVariant, overwriteVariant, deleteVariant,
    setVariants,
  };
}