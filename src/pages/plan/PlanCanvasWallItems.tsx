import { useState, useRef } from "react";
import type { PlanState, Segment } from "./planTypes";
import type { RenderContext } from "./PlanCanvasRenderers";
import { SegmentItemsBadges } from "./PlanCanvasLabelRenderers";
import SegItemPopup from "./SegItemPopup";

interface Props {
  segments: Segment[];
  ctx: RenderContext;
  onChange: (patch: Partial<PlanState>) => void;
  onEditSegItem?: (segId: string, priceId: number) => void;
  onStartMove: (fromSegId: string, priceId: number) => void;
  onStartDuplicate: (fromSegId: string, priceId: number) => void;
  selectedSegmentIds?: string[];
}

export default function PlanCanvasWallItems({
  segments, ctx, onChange, onEditSegItem, onStartMove, onStartDuplicate, selectedSegmentIds = [],
}: Props) {
  const [segPopup, setSegPopup] = useState<{
    segId: string; priceId: number; screenX: number; screenY: number;
  } | null>(null);
  // Snapshot выделенных стен в момент открытия попапа —
  // к моменту рендера попапа selectedSegmentIds уже сброшен touch-обработчиком
  const frozenSelectedIds = useRef<string[]>([]);

  return (
    <>
      {segments.map(seg => (
        <SegmentItemsBadges
          key={seg.id}
          seg={seg}
          ctx={ctx}
          allSegments={segments}
          onRemoveItem={(segId, priceId) => {
            const newSegs = segments.map(s => {
              if (s.id !== segId) return s;
              return { ...s, items: (s.items ?? []).filter(it => it.priceId !== priceId) };
            });
            onChange({ segments: newSegs });
          }}
          onUpdateQuantity={(segId, priceId, quantity) => {
            const newSegs = segments.map(s => {
              if (s.id !== segId) return s;
              return { ...s, items: (s.items ?? []).map(it => it.priceId === priceId ? { ...it, quantity } : it) };
            });
            onChange({ segments: newSegs });
          }}
          onMoveItemToSeg={(fromSegId, priceId, toSegId) => {
            if (fromSegId === toSegId) return;
            const fromSeg = segments.find(s => s.id === fromSegId);
            const item = fromSeg?.items?.find(it => it.priceId === priceId);
            if (!item) return;
            const toSeg = segments.find(s => s.id === toSegId);
            const meters = toSeg?.lengthCm ? Math.round(toSeg.lengthCm / 100 * 100) / 100 : item.quantity ?? 1;
            const newSegs = segments.map(s => {
              if (s.id === fromSegId) return { ...s, items: (s.items ?? []).filter(it => it.priceId !== priceId) };
              if (s.id === toSegId) {
                const existing = s.items ?? [];
                if (existing.some(it => it.priceId === priceId)) {
                  return { ...s, items: existing.map(it => it.priceId === priceId ? { ...it, quantity: (it.quantity ?? 1) + meters } : it) };
                }
                return { ...s, items: [...existing, { ...item, quantity: meters }] };
              }
              return s;
            });
            onChange({ segments: newSegs });
          }}
          onEditSegItem={(segId, priceId, screenX, screenY) => {
            // Сохраняем выделенные стены ДО того как touch-обработчик их сбросит
            frozenSelectedIds.current = selectedSegmentIds;
            setSegPopup({ segId, priceId, screenX, screenY });
          }}
        />
      ))}

      {segPopup && (() => {
        const seg = segments.find(s => s.id === segPopup.segId);
        const item = seg?.items?.find(it => it.priceId === segPopup.priceId);
        if (!seg || !item) return null;
        return (
          <SegItemPopup
            item={{ ...item, quantity: item.quantity ?? 1 }}
            segId={segPopup.segId}
            screenX={segPopup.screenX}
            screenY={segPopup.screenY}
            onClose={() => setSegPopup(null)}
            onRemove={(segId, priceId) => {
              const newSegs = segments.map(s =>
                s.id !== segId ? s : { ...s, items: (s.items ?? []).filter(it => it.priceId !== priceId) }
              );
              onChange({ segments: newSegs });
            }}
            onReplace={(segId, priceId) => {
              onEditSegItem?.(segId, priceId);
            }}
            onMove={(segId, priceId) => {
              onStartMove(segId, priceId);
            }}
            onDuplicate={(segId, priceId) => {
              onStartDuplicate(segId, priceId);
            }}
            onQuantityChange={(segId, priceId, quantity) => {
              const newSegs = segments.map(s =>
                s.id !== segId ? s : { ...s, items: (s.items ?? []).map(it => it.priceId === priceId ? { ...it, quantity } : it) }
              );
              onChange({ segments: newSegs });
            }}
            selectedSegmentsCount={frozenSelectedIds.current.filter(id => id !== segPopup.segId).length}
            onAddToSelectedSegs={(segId, priceId) => {
              const fromSeg = segments.find(s => s.id === segId);
              const srcItem = fromSeg?.items?.find(it => it.priceId === priceId);
              if (!srcItem) return;
              const targetIds = frozenSelectedIds.current.filter(id => id !== segId);
              const newSegs = segments.map(s => {
                if (!targetIds.includes(s.id)) return s;
                const meters = s.lengthCm ? Math.round(s.lengthCm / 100 * 100) / 100 : srcItem.quantity ?? 1;
                const existing = s.items ?? [];
                if (existing.some(it => it.priceId === priceId)) return s;
                return { ...s, items: [...existing, { ...srcItem, quantity: meters }] };
              });
              onChange({ segments: newSegs });
            }}
          />
        );
      })()}
    </>
  );
}