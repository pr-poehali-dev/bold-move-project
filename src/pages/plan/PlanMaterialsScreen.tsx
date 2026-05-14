import { useEffect, useState, useMemo } from "react";
import Icon from "@/components/ui/icon";
import type { PlanProject, PlanRoom } from "./usePlanProjects";
import func2url from "@/../backend/func2url.json";

const CRM_URL = (func2url as Record<string, string>)["crm-manager"];

interface SegmentItem {
  priceId: number;
  name: string;
  category: string;
  imageUrl: string | null;
  unit: string;
  quantity?: number;
}

interface FloorItem {
  id: string;
  priceId: number;
  name: string;
  category: string;
  imageUrl: string | null;
  unit: string;
  quantity: number;
}

interface RoomState {
  segments?: { lengthCm?: number | null; items?: SegmentItem[] }[];
  floorItems?: FloorItem[];
  room?: { name?: string };
  include_in_estimate?: boolean;
}

interface MaterialLine {
  priceId: number;
  name: string;
  category: string;
  imageUrl: string | null;
  unit: string;
  quantity: number; // суммарное количество
  roomQuantities: Record<number, number>; // roomId → quantity
}

type ViewMode = "project" | "room";

function extractMaterials(roomData: object): { items: (SegmentItem & { quantity: number })[]; floorItems: FloorItem[] } {
  const state = roomData as RoomState;
  const items: (SegmentItem & { quantity: number })[] = [];

  (state.segments ?? []).forEach(seg => {
    (seg.items ?? []).forEach(item => {
      const qty = item.quantity ?? (seg.lengthCm ? Math.round(seg.lengthCm / 100 * 100) / 100 : 1);
      items.push({ ...item, quantity: qty });
    });
  });

  return { items, floorItems: state.floorItems ?? [] };
}

function aggregateByRoom(rooms: PlanRoom[]): Record<number, MaterialLine[]> {
  const result: Record<number, MaterialLine[]> = {};
  rooms.forEach(room => {
    const map = new Map<number, MaterialLine>();
    if (!room.data || Object.keys(room.data).length === 0) { result[room.id] = []; return; }
    const { items, floorItems } = extractMaterials(room.data);
    [...items, ...floorItems].forEach(it => {
      const existing = map.get(it.priceId);
      if (existing) {
        existing.quantity += it.quantity ?? 0;
        existing.roomQuantities[room.id] = (existing.roomQuantities[room.id] ?? 0) + (it.quantity ?? 0);
      } else {
        map.set(it.priceId, {
          priceId: it.priceId,
          name: it.name,
          category: it.category,
          imageUrl: it.imageUrl,
          unit: it.unit,
          quantity: it.quantity ?? 0,
          roomQuantities: { [room.id]: it.quantity ?? 0 },
        });
      }
    });
    result[room.id] = Array.from(map.values());
  });
  return result;
}

function aggregateAll(rooms: PlanRoom[]): MaterialLine[] {
  const map = new Map<number, MaterialLine>();
  rooms.forEach(room => {
    if (!room.data || Object.keys(room.data).length === 0) return;
    const { items, floorItems } = extractMaterials(room.data);
    [...items, ...floorItems].forEach(it => {
      const existing = map.get(it.priceId);
      if (existing) {
        existing.quantity += it.quantity ?? 0;
        existing.roomQuantities[room.id] = (existing.roomQuantities[room.id] ?? 0) + (it.quantity ?? 0);
      } else {
        map.set(it.priceId, {
          priceId: it.priceId,
          name: it.name,
          category: it.category,
          imageUrl: it.imageUrl,
          unit: it.unit,
          quantity: it.quantity ?? 0,
          roomQuantities: { [room.id]: it.quantity ?? 0 },
        });
      }
    });
  });
  return Array.from(map.values());
}

function groupByCategory(lines: MaterialLine[]): Record<string, MaterialLine[]> {
  return lines.reduce<Record<string, MaterialLine[]>>((acc, line) => {
    const cat = line.category || "Прочее";
    (acc[cat] ??= []).push(line);
    return acc;
  }, {});
}

interface Props {
  project: PlanProject;
  token?: string | null;
  onBack: () => void;
}

export default function PlanMaterialsScreen({ project, token, onBack }: Props) {
  const [rooms, setRooms] = useState<PlanRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("project");
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  // roomId → priceId → overrideQty
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  useEffect(() => {
    setLoading(true);
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h["Authorization"] = `Bearer ${token}`;
    fetch(`${CRM_URL}?r=plan-rooms&project_id=${project.id}`, { headers: h })
      .then(r => r.json())
      .then(data => {
        const list: PlanRoom[] = Array.isArray(data) ? data.filter((r: PlanRoom) => r.include_in_estimate !== false) : [];
        setRooms(list);
        if (list.length > 0) setSelectedRoomId(list[0].id);
      })
      .finally(() => setLoading(false));
  }, [project.id, token]);

  const overrideKey = (roomId: number | null, priceId: number) => `${roomId ?? "all"}_${priceId}`;

  const setQty = (roomId: number | null, priceId: number, val: number) => {
    setOverrides(prev => ({ ...prev, [overrideKey(roomId, priceId)]: val }));
  };

  const getQty = (roomId: number | null, line: MaterialLine): number => {
    const key = overrideKey(roomId, line.priceId);
    return overrides[key] ?? (roomId != null ? (line.roomQuantities[roomId] ?? 0) : line.quantity);
  };

  // Агрегация
  const byRoom = useMemo(() => aggregateByRoom(rooms), [rooms]);
  const allLines = useMemo(() => aggregateAll(rooms), [rooms]);

  const displayLines: MaterialLine[] = useMemo(() => {
    if (viewMode === "project") return allLines;
    if (selectedRoomId != null) return byRoom[selectedRoomId] ?? [];
    return [];
  }, [viewMode, allLines, byRoom, selectedRoomId]);

  const grouped = useMemo(() => groupByCategory(displayLines), [displayLines]);
  const categories = Object.keys(grouped).sort();

  const currentRoomId = viewMode === "room" ? selectedRoomId : null;

  const totalItems = displayLines.length;
  const hasAny = totalItems > 0;

  return (
    <div className="fixed inset-0 z-[300] flex flex-col" style={{ background: "#07070f" }}>

      {/* Шапка */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition hover:bg-white/10 shrink-0"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          <Icon name="ChevronLeft" size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-white font-bold text-[15px] truncate">Материалы</div>
          <div className="text-[11px] truncate" style={{ color: "rgba(255,255,255,0.4)" }}>{project.name}</div>
        </div>

        {/* Переключатель Общий / Покомнатный */}
        <div className="flex rounded-xl overflow-hidden shrink-0" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}>
          {(["project", "room"] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className="px-3 py-1.5 text-[11px] font-bold transition"
              style={{
                background: viewMode === mode ? "rgba(124,58,237,0.5)" : "transparent",
                color: viewMode === mode ? "#e9d5ff" : "rgba(255,255,255,0.45)",
              }}
            >
              {mode === "project" ? "Общий" : "Покомнатный"}
            </button>
          ))}
        </div>
      </div>

      {/* Покомнатный — табы комнат */}
      {viewMode === "room" && rooms.length > 0 && (
        <div className="shrink-0 border-b overflow-x-auto flex gap-1 px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.06)", scrollbarWidth: "none" }}>
          {rooms.map(room => (
            <button
              key={room.id}
              onClick={() => setSelectedRoomId(room.id)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap shrink-0 transition"
              style={{
                background: selectedRoomId === room.id ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.05)",
                color: selectedRoomId === room.id ? "#c4b5fd" : "rgba(255,255,255,0.5)",
                border: `1px solid ${selectedRoomId === room.id ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.07)"}`,
              }}
            >
              {room.name}
            </button>
          ))}
        </div>
      )}

      {/* Контент */}
      <div className="flex-1 overflow-y-auto px-4 py-4">

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          </div>
        )}

        {!loading && !hasAny && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "rgba(124,58,237,0.1)" }}>
              <Icon name="PackageOpen" size={28} style={{ color: "#7c3aed" }} />
            </div>
            <div className="text-white/50 text-[15px] font-semibold mb-1">Материалов нет</div>
            <div className="text-white/25 text-[12px]">Добавьте товары к стенам на чертеже</div>
          </div>
        )}

        {!loading && hasAny && categories.map(cat => {
          const lines = grouped[cat];
          return (
            <div key={cat} className="mb-5">
              {/* Заголовок категории */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(167,139,250,0.7)" }}>{cat}</span>
                <div className="flex-1 h-px" style={{ background: "rgba(124,58,237,0.15)" }} />
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>{lines.length} поз.</span>
              </div>

              <div className="space-y-2">
                {lines.map(line => {
                  const qty = getQty(currentRoomId, line);
                  return (
                    <div
                      key={line.priceId}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                      style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      {/* Картинка */}
                      <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center"
                        style={{ background: "rgba(124,58,237,0.1)" }}>
                        {line.imageUrl
                          ? <img src={line.imageUrl} alt={line.name} className="w-full h-full object-cover" />
                          : <Icon name="Package" size={16} style={{ color: "#a78bfa" }} />
                        }
                      </div>

                      {/* Название */}
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-[13px] font-semibold truncate">{line.name}</div>
                        <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>{line.unit}</div>
                      </div>

                      {/* Редактируемое количество */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => setQty(currentRoomId, line.priceId, Math.max(0, parseFloat((qty - 0.1).toFixed(2))))}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition active:scale-90"
                          style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}
                        >
                          <Icon name="Minus" size={12} />
                        </button>
                        <input
                          type="number"
                          value={qty}
                          onChange={e => setQty(currentRoomId, line.priceId, parseFloat(e.target.value) || 0)}
                          className="w-14 text-center text-white font-bold text-[13px] rounded-lg focus:outline-none"
                          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", padding: "4px 2px" }}
                        />
                        <button
                          onClick={() => setQty(currentRoomId, line.priceId, parseFloat((qty + 0.1).toFixed(2)))}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition active:scale-90"
                          style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}
                        >
                          <Icon name="Plus" size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Подвал — итог */}
      {!loading && hasAny && (
        <div className="shrink-0 px-4 py-3 border-t flex items-center gap-3" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <div className="flex-1">
            <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>Позиций в смете</div>
            <div className="text-white font-bold text-[15px]">{totalItems}</div>
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition hover:opacity-90 active:scale-[0.97]"
            style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff" }}
          >
            <Icon name="FileDown" size={15} />
            Скачать смету
          </button>
        </div>
      )}
    </div>
  );
}
