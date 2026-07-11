import { useState, useEffect } from "react";
import CategoryDrumPanel from "./CategoryDrumPanel";
import type { PriceEntry } from "./CategoryDrumPanel";
import type { PlanState, SegmentPriceItem } from "./planTypes";
import PlanVoiceCatalogButton from "./PlanVoiceCatalogButton";
import type { VoiceCatalogItem } from "./useVoiceCatalog";
import VoiceResultPopup from "./VoiceResultPopup";
import ReplaceItemModal from "./ReplaceItemModal";
import PendingWallBanner from "./PendingWallBanner";
import useCatalogVoiceHandler from "./useCatalogVoiceHandler";

interface Props {
  open: boolean;
  filteredPrices: PriceEntry[];
  allPrices: PriceEntry[];
  selectedSegmentId: string | null;
  selectedSegmentIds?: string[];
  state: PlanState;
  onClose: () => void;
  onAssignToSegs: (item: SegmentPriceItem, segIds: string[]) => void;
  onAssignToAllSegs: (item: SegmentPriceItem) => void;
  onAddToActive: (item: SegmentPriceItem) => void;
  onAssignMany: (wallItems: { item: SegmentPriceItem; segIds: string[] | null }[], floorItems: SegmentPriceItem[]) => void;
  onRemoveFromSegs: (priceId: number, segIds: string[]) => void;
  onRemoveFromAllSegs: (priceId: number) => void;
  pendingItem?: SegmentPriceItem | null;
  onSegmentClickForPending?: (segId: string) => void;
  initialCategory?: string;
  onReplaceItem?: (item: SegmentPriceItem) => void;
  isMobile?: boolean;
  onRegisterVoiceHandler?: (fn: (items: VoiceCatalogItem[], transcript: string) => void) => void;
}

export default function PlanCatalogPanel({
  open,
  filteredPrices,
  allPrices,
  selectedSegmentId,
  selectedSegmentIds,
  state,
  onClose,
  onAssignToSegs,
  onAssignToAllSegs,
  onAddToActive,
  onAssignMany,
  onRemoveFromSegs,
  onRemoveFromAllSegs,
  onSegmentClickForPending: _onSegmentClickForPending,
  initialCategory,
  onReplaceItem,
  isMobile,
  onRegisterVoiceHandler,
}: Props) {
  const [showListMode, setShowListMode] = useState(!isMobile);

  // При каждом открытии каталога на ПК — снова показываем список по умолчанию
  // (иначе после первого закрытия списка без выбора состояние "барабан" оставалось навсегда)
  useEffect(() => {
    if (open && !isMobile) setShowListMode(true);
  }, [open, isMobile]);

  const {
    pendingWall,
    pendingSelectedSegs,
    voicePopupItems,
    setVoicePopupItems,
    handleVoiceItems,
    handleTranscript,
    handlePendingConfirm,
    handlePendingClose,
  } = useCatalogVoiceHandler({ state, allPrices, onAssignMany, onRemoveFromSegs, onRemoveFromAllSegs, onRegisterVoiceHandler });

  return (
    <div className="relative">
      <CategoryDrumPanel
        open={open}
        onClose={onClose}
        prices={filteredPrices}
        initialCategory={initialCategory}
        isMobile={isMobile}
        onShowList={!isMobile ? () => setShowListMode(true) : undefined}
        onDragItem={item => {
          if (onReplaceItem) {
            // Режим замены — делегируем всё наружу, закрытие тоже снаружи
            onReplaceItem(item);
            return;
          }
          onClose();
          const ids = selectedSegmentIds && selectedSegmentIds.length > 0
            ? selectedSegmentIds
            : selectedSegmentId ? [selectedSegmentId] : [];
          if (ids.length > 0) {
            onAssignToSegs(item, ids);
          } else {
            onAddToActive(item);
          }
        }}
      />

      {/* ПК: модалка-список для добавления товара */}
      {!isMobile && (
        <ReplaceItemModal
          open={showListMode && open}
          item={null}
          prices={filteredPrices}
          mode="add"
          onReplace={(newItem) => {
            setShowListMode(false);
            onClose();
            const ids = selectedSegmentIds && selectedSegmentIds.length > 0
              ? selectedSegmentIds
              : selectedSegmentId ? [selectedSegmentId] : [];
            if (onReplaceItem) {
              onReplaceItem(newItem);
            } else if (ids.length > 0) {
              onAssignToSegs(newItem, ids);
            } else {
              onAddToActive(newItem);
            }
          }}
          onCancel={() => setShowListMode(false)}
        />
      )}

      {/* Кнопка микрофона — только когда каталог открыт */}
      {open && (
        <div className="fixed z-50" style={{ bottom: 96, right: 16 }}>
          <PlanVoiceCatalogButton
            state={state}
            onItems={handleVoiceItems}
            onTranscript={handleTranscript}
          />
        </div>
      )}

      {/* Попап результатов голосового распознавания */}
      {voicePopupItems.length > 0 && (
        <VoiceResultPopup
          items={voicePopupItems}
          onClose={() => setVoicePopupItems([])}
        />
      )}

      {/* Баннер "выберите стены на чертеже" */}
      {pendingWall && (
        <PendingWallBanner
          pendingWall={pendingWall}
          pendingSelectedSegs={pendingSelectedSegs}
          onConfirm={handlePendingConfirm}
          onClose={handlePendingClose}
        />
      )}
    </div>
  );
}