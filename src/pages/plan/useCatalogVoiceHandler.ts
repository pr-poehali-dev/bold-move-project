import { useState, useEffect, useCallback } from "react";
import type { PriceEntry } from "./CategoryDrumPanel";
import type { PlanState, SegmentPriceItem } from "./planTypes";
import type { VoiceCatalogItem } from "./useVoiceCatalog";
import { findSegIdsForItem, ALL_SEGS_SENTINEL } from "./useVoiceCatalog";
import { splitTranscriptToItems, type VoiceResultItem } from "./VoiceResultPopup";
import {
  fixShadowProfile,
  ensureLightingBundle,
  matchItem,
  WALL_CATEGORIES,
  SILENT_CATEGORIES,
} from "./catalogVoiceHelpers";

// Товар "подвисший" — стена не определена, ждёт выбора пользователя
export interface PendingWallItem {
  item: SegmentPriceItem;
  otherWallItems: { item: SegmentPriceItem; segIds: string[] | null }[];
  floorItems: SegmentPriceItem[];
}

// Спецпрофили: теневой, парящий, ниши (они занимают всю длину стены)
const SPECIAL_PROFILE_CATS = new Set(["Теневой профиль", "Парящий профиль", "Ниши для штор"]);

interface Props {
  state: PlanState;
  allPrices: PriceEntry[];
  onAssignMany: (wallItems: { item: SegmentPriceItem; segIds: string[] | null }[], floorItems: SegmentPriceItem[]) => void;
  onRegisterVoiceHandler?: (fn: (items: VoiceCatalogItem[], transcript: string) => void) => void;
}

export default function useCatalogVoiceHandler({ state, allPrices, onAssignMany, onRegisterVoiceHandler }: Props) {
  const [pendingWall, setPendingWall] = useState<PendingWallItem | null>(null);
  const [pendingSelectedSegs, setPendingSelectedSegs] = useState<string[]>([]);
  const [voicePopupItems, setVoicePopupItems] = useState<VoiceResultItem[]>([]);

  // Когда pendingWall активен — отслеживаем клики по стенам через selectedSegmentIds
  useEffect(() => {
    if (!pendingWall) { setPendingSelectedSegs([]); return; }
    const ids = state.selectedSegmentIds ?? [];
    if (ids.length > 0) setPendingSelectedSegs(ids);
  }, [state.selectedSegmentIds, pendingWall]);

  // Подтверждение выбора стен (кнопка ОК)
  const handlePendingConfirm = () => {
    if (!pendingWall || pendingSelectedSegs.length === 0) return;
    const { item, otherWallItems, floorItems } = pendingWall;
    onAssignMany([{ item, segIds: pendingSelectedSegs }, ...otherWallItems], floorItems);
    setPendingWall(null);
    setPendingSelectedSegs([]);
  };

  const handlePendingClose = () => {
    setPendingWall(null);
    setPendingSelectedSegs([]);
  };

  // Обработка транскрипта — запускаем анимацию до того как бот ответил
  const handleTranscript = useCallback((transcript: string) => {
    const labels = splitTranscriptToItems(transcript);
    setVoicePopupItems(labels.map(label => ({ label, status: "pending" as const })));
  }, []);

  // Найти все стены где стоит товар с данной категорией
  const findSegsWithCategory = (category: string): string[] =>
    state.segments
      .filter(seg => (seg.items ?? []).some(it => it.category === category))
      .map(seg => seg.id);

  // Стены без спецпрофилей — туда идёт стеновой алюминиевый
  const findSegsWithoutSpecialProfile = (
    otherWallItems: { item: SegmentPriceItem; segIds: string[] | null }[]
  ): string[] | null => {
    if (state.segments.length === 0) return null;
    const segsWithSpecial = new Set<string>();
    for (const { item, segIds } of otherWallItems) {
      if (SPECIAL_PROFILE_CATS.has(item.category) && segIds) {
        for (const id of segIds) segsWithSpecial.add(id);
      }
    }
    for (const seg of state.segments) {
      const hasSpecial = (seg.items ?? []).some(it => SPECIAL_PROFILE_CATS.has(it.category));
      if (hasSpecial) segsWithSpecial.add(seg.id);
    }
    const free = state.segments.map(s => s.id).filter(id => !segsWithSpecial.has(id));
    if (free.length === 0) return state.segments.map(s => s.id);
    return free;
  };

  // Детект команды замены
  const isReplaceCommand = (t: string) =>
    /замен|поменя|вместо|измен|передел|переключ|смени|своп|убери.{0,30}поставь|убери.{0,30}добавь/i.test(t);

  // Обработка items от бота
  const handleVoiceItems = (items: VoiceCatalogItem[], transcript: string) => {
    console.log("[voice] transcript:", transcript);
    console.log("[voice] items:", items.map(i => i.name));

    // Обновляем статусы попапа по реальному результату
    setVoicePopupItems(prev => {
      if (prev.length === 0) return prev;
      const botNames = items.map(i => i.name.toLowerCase());
      const KEYWORD_MAP: Record<string, string[]> = {
        "парящ": ["flexy", "fly", "пк-6"],
        "теневой": ["eurokraab", "eurokrab", "классик"],
        "тенев": ["eurokraab", "eurokrab"],
        "стеновой": ["стеновой алюминиевый"],
        "алюминиев": ["алюминиевый"],
        "люстр": ["под люстру", "планка"],
        "светильник": ["gx-53", "светильник"],
        "ниша": ["ниша", "пк-14", "пк-12", "пк-15"],
      };
      return prev.map(p => {
        const label = p.label.toLowerCase();
        const labelWords = label.split(/\s+/).filter(w => w.length > 2);
        const direct = botNames.some(n => labelWords.some(w => n.includes(w) || w.includes(n)));
        if (direct) return { ...p, status: "ok" as const };
        const semantic = Object.entries(KEYWORD_MAP).some(([kw, hints]) =>
          label.includes(kw) && botNames.some(n => hints.some(h => n.includes(h)))
        );
        return { ...p, status: semantic ? "ok" as const : "fail" as const };
      });
    });

    // Исправляем дефолт теневого профиля, затем гарантируем комплект светильника
    const guaranteedItems = ensureLightingBundle(fixShadowProfile(items, allPrices), allPrices);
    if (guaranteedItems.length !== items.length) {
      console.log("[voice] lighting bundle auto-completed:", guaranteedItems.map(i => i.name));
    }

    // Если LLM добавил и "Стеновой алюминиевый" и "Потолочный алюминиевый" одновременно —
    // убираем Потолочный: они из одной категории, стеновой алюминиевый является приоритетным
    const hasStenovoy = guaranteedItems.some(i => /стеновой алюминиевый/i.test(i.name));
    const items_ = hasStenovoy
      ? guaranteedItems.filter(i => !/потолочный алюминиевый/i.test(i.name))
      : guaranteedItems;

    // Команда замены: ставим новый товар на те же стены где стоял старый
    if (isReplaceCommand(transcript)) {
      const wallItemsWithSegs: { item: SegmentPriceItem; segIds: string[] | null }[] = [];
      const floorItems: SegmentPriceItem[] = [];

      items_.forEach(voiceItem => {
        const matched = matchItem(voiceItem, allPrices);
        if (!matched) return;
        if (SILENT_CATEGORIES.has(matched.category) ||
            matched.name === "Раскрой ПВХ" || matched.name === "Огарпунивание ПВХ") {
          floorItems.push({ ...matched, quantity: voiceItem.qty ?? 1 });
          return;
        }
        if (matched.isWallItem && state.segments.length > 0) {
          const segsWithCategory = findSegsWithCategory(matched.category);
          if (segsWithCategory.length > 0) {
            wallItemsWithSegs.push({ item: matched, segIds: segsWithCategory });
          } else {
            wallItemsWithSegs.push({ item: matched, segIds: [ALL_SEGS_SENTINEL] });
          }
        } else {
          floorItems.push({ ...matched, quantity: voiceItem.qty ?? 1 });
        }
      });

      if (wallItemsWithSegs.length > 0 || floorItems.length > 0) {
        onAssignMany(wallItemsWithSegs, floorItems);
      }
      return;
    }

    // Обычный режим добавления
    const wallItemsWithSegs: { item: SegmentPriceItem; segIds: string[] | null }[] = [];
    const floorItems: SegmentPriceItem[] = [];
    const unknownWallItems: SegmentPriceItem[] = [];

    items_.forEach(voiceItem => {
      const matched = matchItem(voiceItem, allPrices);
      if (!matched) { console.log("[voice] no match for:", voiceItem.name); return; }

      if (
        SILENT_CATEGORIES.has(matched.category) ||
        matched.name === "Раскрой ПВХ" ||
        matched.name === "Огарпунивание ПВХ"
      ) {
        floorItems.push({ ...matched, quantity: voiceItem.qty ?? 1 });
        return;
      }

      if (matched.isWallItem && state.segments.length > 0) {
        // Стеновой алюминиевый — детерминированно на свободные стены, текст не читаем
        if (/стеновой алюминиевый/i.test(matched.name)) {
          const freeSegs = findSegsWithoutSpecialProfile(wallItemsWithSegs);
          console.log("[voice] stenovoy → free segs:", freeSegs);
          if (freeSegs && freeSegs.length > 0) {
            wallItemsWithSegs.push({ item: matched, segIds: freeSegs });
          }
          return;
        }
        const itemSegIds = findSegIdsForItem(matched.name, matched.category, transcript, state);
        console.log("[voice] segIds for", matched.name, "->", itemSegIds);
        if (!itemSegIds) {
          unknownWallItems.push(matched);
        } else {
          wallItemsWithSegs.push({ item: matched, segIds: itemSegIds });
        }
      } else {
        floorItems.push({ ...matched, quantity: voiceItem.qty ?? 1 });
      }
    });

    if (wallItemsWithSegs.length > 0 || floorItems.length > 0) {
      onAssignMany(wallItemsWithSegs, floorItems);
    }

    if (unknownWallItems.length > 0) {
      setPendingWall({
        item: unknownWallItems[0],
        otherWallItems: [],
        floorItems: [],
      });
    }
  };

  // Регистрируем handleVoiceItems чтобы внешние компоненты могли его вызвать
  useEffect(() => {
    onRegisterVoiceHandler?.(handleVoiceItems);
  });

  return {
    pendingWall,
    pendingSelectedSegs,
    voicePopupItems,
    setVoicePopupItems,
    handleVoiceItems,
    handleTranscript,
    handlePendingConfirm,
    handlePendingClose,
  };
}
