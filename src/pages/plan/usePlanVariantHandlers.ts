import type { PlanState } from "./planTypes";
import { INITIAL_STATE } from "./planTypes";
import type { PlanRoom } from "./usePlanProjects";
import type { usePlanVariants } from "./usePlanVariants";

type VariantsHook = ReturnType<typeof usePlanVariants>;

interface Opts {
  activeRoom: PlanRoom | null;
  token: string | null | undefined;
  reset: (next?: PlanState) => void;
  variants: VariantsHook;
  setVariantModalOpen: (v: boolean) => void;
}

export function usePlanVariantHandlers({
  activeRoom,
  token,
  reset,
  variants,
  setVariantModalOpen,
}: Opts) {
  const { saveVariant, overwriteVariant, updateVariant, deleteVariant, setActiveVariantId } = variants;

  const handleSaveVariantWithState = async (name: string, state: PlanState) => {
    if (!activeRoom) return;
    await saveVariant(activeRoom.id, name, state);
    setVariantModalOpen(false);
  };

  const handleOverwriteVariant = async (state: PlanState) => {
    if (!activeRoom || !variants.activeVariantId) return;
    await overwriteVariant(variants.activeVariantId, activeRoom.id, state);
  };

  const handleLoadVariant = async (variantId: number, variantData: object) => {
    if (!activeRoom) return;
    const newState = { ...INITIAL_STATE, ...(variantData as Partial<typeof INITIAL_STATE>), selectedSegmentId: null, selectedPointId: null };
    reset(newState);
    await updateVariant(variantId, { is_active: true });
    setActiveVariantId(variantId);
    try {
      const { getSvgDataUrl } = await import("./planExport");
      const thumbnail = (newState as PlanState).points?.length >= 2
        ? (getSvgDataUrl(newState as PlanState, 0.4) ?? "").slice(0, 8000)
        : null;
      const CRM_URL = (await import("@/../backend/func2url.json")).default["crm-manager"];
      await fetch(`${CRM_URL}?r=plan-rooms&id=${activeRoom.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ data: newState, ...(thumbnail ? { thumbnail } : {}) }),
      });
    } catch { /* молча */ }
  };

  const handleDeleteVariant = (id: number) => {
    if (!activeRoom) return;
    deleteVariant(id, activeRoom.id);
  };

  const handleRenameVariant = (id: number, name: string) => {
    updateVariant(id, { name });
  };

  return {
    handleSaveVariantWithState,
    handleOverwriteVariant,
    handleLoadVariant,
    handleDeleteVariant,
    handleRenameVariant,
  };
}