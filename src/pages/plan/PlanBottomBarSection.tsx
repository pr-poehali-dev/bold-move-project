import MobileBottomBar from "./MobileBottomBar";
import type { PlanState } from "./planTypes";
import type { usePlanCatalog } from "./usePlanCatalog";
import useVoiceDraw from "./useVoiceDraw";

type VoiceDraw = ReturnType<typeof useVoiceDraw>;
type Catalog   = ReturnType<typeof usePlanCatalog>;

export type ReplaceTarget =
  | { type: "seg"; segId: string; priceId: number; category: string | null }
  | { type: "active"; priceId: number; category: string | null }
  | null;

interface Props {
  state: PlanState;
  isMobile: boolean;
  sheetOpen: boolean;       setSheetOpen: (v: boolean) => void;
  sheetSnap: "half" | "full"; setSheetSnap: (v: "half" | "full") => void;
  rightPanelOpen: boolean;  setRightPanelOpen: (v: boolean) => void;
  sidebarOpen: boolean;     setSidebarOpen: (v: boolean) => void;
  setFocusSegmentId: (v: string | null) => void;
  handleChange: (patch: Partial<PlanState>) => void;
  handleSettingChange: (patch: Partial<PlanState["settings"]>) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomFit: () => void;
  catalog: Catalog;
  replaceTarget: ReplaceTarget;
  setReplaceTarget: (v: ReplaceTarget) => void;
  voiceDraw: VoiceDraw;
  onVoiceItemsFromBottom: (items: import("./useVoiceCatalog").VoiceCatalogItem[], transcript: string) => void;
  setBottomSettingsOpen: (v: boolean) => void;
}

// ── Нижняя панель (мобиле/ПК) со всей логикой открытия панелей ──────────────
export default function PlanBottomBarSection({
  state, isMobile,
  sheetOpen, setSheetOpen,
  setSheetSnap,
  rightPanelOpen, setRightPanelOpen,
  sidebarOpen, setSidebarOpen,
  setFocusSegmentId,
  handleChange, handleSettingChange, zoomIn, zoomOut, zoomFit,
  catalog, replaceTarget, setReplaceTarget,
  voiceDraw, onVoiceItemsFromBottom, setBottomSettingsOpen,
}: Props) {
  return (
    <MobileBottomBar
      zoom={state.settings.zoom}
      settings={state.settings}
      onSettingChange={handleSettingChange}
      onZoomIn={zoomIn}
      onZoomOut={zoomOut}
      onZoomFit={zoomFit}
      onOpenPanel={isMobile
        ? () => {
            // Кнопка "Чертёж" горит и закрывает панель только для своей вкладки (drawing)
            if (sheetOpen && state.sidebarTab !== "calc") { setSheetOpen(false); } else {
              catalog.setCatalogOpen(false);
              setRightPanelOpen(false);
              handleChange({ sidebarTab: "drawing" });
              setSheetSnap("half"); setSheetOpen(true);
            }
          }
        : () => {
            if (sidebarOpen && state.sidebarTab !== "calc") { setSidebarOpen(false); } else {
              catalog.setCatalogOpen(false);
              handleChange({ sidebarTab: "drawing" });
              setSidebarOpen(true);
            }
          }
      }
      onOpenCatalog={() => {
        if (replaceTarget) {
          // Закрываем барабан замены
          setReplaceTarget(null);
          catalog.setReplaceCatalogCategory(null);
          return;
        }
        const next = !catalog.catalogOpen;
        catalog.setCatalogOpen(next);
        if (next) {
          setSheetOpen(false);
          setSidebarOpen(false);
          setRightPanelOpen(false);
        }
      }}
      onOpenSides={() => {
        if (rightPanelOpen) { setRightPanelOpen(false); } else {
          catalog.setCatalogOpen(false);
          setSheetOpen(false);
          setFocusSegmentId(state.selectedSegmentId);
          setRightPanelOpen(true);
        }
      }}
      selectedSegmentId={state.selectedSegmentId}
      sheetOpen={
        isMobile
          ? sheetOpen && state.sidebarTab !== "calc"
          : sidebarOpen && state.sidebarTab !== "calc"
      }
      catalogOpen={catalog.catalogOpen || !!replaceTarget}
      rightPanelOpen={rightPanelOpen}
      isMobile={isMobile}
      onOpenMaterials={state.settings.hideMaterialsButton ? undefined : () => {
        // Кнопка "Материалы" горит и закрывает панель только для своей вкладки (calc)
        if (isMobile) {
          if (sheetOpen && state.sidebarTab === "calc") { setSheetOpen(false); return; }
          handleChange({ sidebarTab: "calc" });
          catalog.setCatalogOpen(false);
          setRightPanelOpen(false);
          setSheetSnap("half");
          setSheetOpen(true);
        } else {
          if (sidebarOpen && state.sidebarTab === "calc") { setSidebarOpen(false); return; }
          handleChange({ sidebarTab: "calc" });
          catalog.setCatalogOpen(false);
          setSidebarOpen(true);
        }
      }}
      materialsOpen={
        isMobile
          ? sheetOpen && state.sidebarTab === "calc"
          : sidebarOpen && state.sidebarTab === "calc"
      }
      onToggleVoiceDraw={voiceDraw.hasSpeech ? voiceDraw.toggle : undefined}
      isVoiceDrawing={voiceDraw.isListening}
      isVoiceProcessing={voiceDraw.isProcessing}
      voiceStatus={voiceDraw.status}
      voiceInterim={voiceDraw.interimText}
      voiceVolume={voiceDraw.volume}
      isClosed={state.isClosed}
      planState={state}
      onVoiceCatalogItems={onVoiceItemsFromBottom}
      attachedCount={catalog.attachedCount}
      filterAttached={catalog.filterAttached}
      onToggleFilterAttached={() => catalog.setFilterAttached(v => !v)}
      onSettingsOpenChange={setBottomSettingsOpen}
    />
  );
}