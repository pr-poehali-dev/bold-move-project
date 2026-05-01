import { useState, useCallback } from "react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Icon from "@/components/ui/icon";
import type { DemoPipelineCompany, DemoStatus } from "./wlTypes";
import { AUTH_URL } from "./wlTypes";
import { WLNextStepModal }       from "./WLNextStepModal";
import { WLReceiptModal }        from "./WLReceiptModal";
import { WLLprModal }            from "./WLLprModal";
import { WLBalanceHistoryModal } from "./WLBalanceHistoryModal";
import { WLPipelineFilters }     from "./WLPipelineFilters";
import { WLPipelineCard }        from "./WLPipelineCard";
import { getWLToken }            from "./WLManagerContext";
import type { DemoFilter, EstFilter, AgentFilter } from "./WLPipelineFilters";

interface Props {
  companies:      DemoPipelineCompany[];
  filterStatus:   DemoStatus | "all";
  onFilterChange: (s: DemoStatus | "all") => void;
  onSelect:       (c: DemoPipelineCompany) => void;
  onMove:         (demoId: number, status: DemoStatus) => void;
  onUpdate:       (demoId: number, patch: Partial<DemoPipelineCompany>) => void;
  onBrand:        (companyId: number) => void;
  onReorder:      (orderedIds: number[]) => void;
}

const DEMO_DAYS = 10;
function demoDaysLeft(c: DemoPipelineCompany) {
  const passed = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000);
  return Math.max(0, DEMO_DAYS - passed);
}

// ── Sortable обёртка карточки ─────────────────────────────────────────────
function SortableCard({ c, ...props }: { c: DemoPipelineCompany } & Omit<React.ComponentProps<typeof WLPipelineCard>, "c">) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: c.demo_id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: "relative",
        zIndex: isDragging ? 50 : "auto",
      }}>
      {/* Ручка перетаскивания */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-5 flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
        style={{ color: "rgba(255,255,255,0.12)" }}
        title="Перетащить"
        onClick={e => e.stopPropagation()}>
        <Icon name="GripVertical" size={12} />
      </div>
      <div style={{ paddingLeft: "16px" }}>
        <WLPipelineCard c={c} {...props} />
      </div>
    </div>
  );
}

export function WLPipelineList({ companies, filterStatus, onFilterChange, onSelect, onMove, onUpdate, onBrand, onReorder }: Props) {
  const [expanded,    setExpanded]    = useState<Set<number>>(new Set());
  const [nextStepFor, setNextStepFor] = useState<{ company: DemoPipelineCompany; status: DemoStatus } | null>(null);
  const [receiptFor,  setReceiptFor]  = useState<DemoPipelineCompany | null>(null);
  const [lprFor,      setLprFor]      = useState<DemoPipelineCompany | null>(null);
  const [historyFor,  setHistoryFor]  = useState<{ company: DemoPipelineCompany; mode: "demo" | "est" | "info" } | null>(null);

  const [demoFilter,  setDemoFilter]  = useState<DemoFilter>("all");
  const [estFilter,   setEstFilter]   = useState<EstFilter>("all");
  const [agentFilter, setAgentFilter] = useState<AgentFilter>("all");
  const [search,      setSearch]      = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleMove = (c: DemoPipelineCompany, status: DemoStatus) => {
    if (status === c.status) return;
    if (status === "paid") { setReceiptFor(c); return; }
    setNextStepFor({ company: c, status });
  };

  const toggle = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const byStatus = filterStatus === "all" ? companies : companies.filter(c => c.status === filterStatus);

  const searchLower = search.trim().toLowerCase();
  const filtered = byStatus.filter(c => {
    // Поиск по названию и домену
    if (searchLower) {
      const nameMatch = c.company_name.toLowerCase().includes(searchLower);
      const siteMatch = c.site_url.toLowerCase().includes(searchLower);
      if (!nameMatch && !siteMatch) return false;
    }

    const dl = demoDaysLeft(c);
    if (demoFilter === "active"   && dl === 0)             return false;
    if (demoFilter === "expiring" && (dl === 0 || dl > 3)) return false;
    if (demoFilter === "expired"  && dl > 0)               return false;

    const used      = c.estimates_used || 0;
    const boughtEst = c.estimates_balance > 10;
    if (estFilter === "redflag" && (used > 0 || boughtEst)) return false;
    if (estFilter === "used"    && used === 0)               return false;
    if (estFilter === "bought"  && !boughtEst)               return false;

    const agentPaid  = c.status === "paid";
    const agentTrial = c.has_own_agent && !agentPaid;
    if (agentFilter === "demo"   && !agentTrial) return false;
    if (agentFilter === "bought" && !agentPaid)  return false;

    return true;
  });

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = filtered.findIndex(c => c.demo_id === active.id);
    const newIndex = filtered.findIndex(c => c.demo_id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(filtered, oldIndex, newIndex);
    const orderedIds = reordered.map(c => c.demo_id);
    onReorder(orderedIds);

    // Сохраняем на бэкенде
    fetch(`${AUTH_URL}?action=wl-reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Authorization": getWLToken() },
      body: JSON.stringify({ ordered_ids: orderedIds }),
    }).catch(() => {});
  }, [filtered, onReorder]);

  return (
    <div className="mt-4 space-y-3">
      {/* Поиск на мобиле — компактная строка */}
      <div className="flex sm:hidden items-center gap-2 px-3 py-2 rounded-xl"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <Icon name="Search" size={12} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск..."
          className="flex-1 bg-transparent text-[11px] text-white/80 outline-none placeholder-white/20" />
        {search && <button onClick={() => setSearch("")}><Icon name="X" size={11} style={{ color: "rgba(255,255,255,0.3)" }} /></button>}
      </div>

      {/* Фильтры — только на десктопе */}
      <div className="hidden sm:block">
        <WLPipelineFilters
          companies={companies}
          filterStatus={filterStatus}
          onFilterChange={onFilterChange}
          demoFilter={demoFilter}
          estFilter={estFilter}
          agentFilter={agentFilter}
          onDemoFilter={setDemoFilter}
          onEstFilter={setEstFilter}
          onAgentFilter={setAgentFilter}
          search={search}
          onSearch={setSearch}
        />
      </div>

      {/* Список с DnD */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={filtered.map(c => c.demo_id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {filtered.map(c => (
              <SortableCard
                key={c.demo_id}
                c={c}
                isOpen={expanded.has(c.demo_id)}
                onToggle={toggle}
                onSelect={onSelect}
                onMove={handleMove}
                onBrand={onBrand}
                onLpr={setLprFor}
                onHistory={(company, mode) => setHistoryFor({ company, mode })}
                onUpdate={onUpdate}
              />
            ))}

            {filtered.length === 0 && (
              <div className="text-center py-10 text-white/20 text-sm">
                Нет компаний в этом статусе
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Модалка следующего шага */}
      {nextStepFor && (
        <WLNextStepModal
          company={nextStepFor.company}
          newStatus={nextStepFor.status}
          onSuccess={patch => {
            onMove(nextStepFor.company.demo_id, nextStepFor.status);
            onUpdate(nextStepFor.company.demo_id, patch);
            setNextStepFor(null);
          }}
          onCancel={() => setNextStepFor(null)}
        />
      )}

      {/* Модалка чека при оплате */}
      {receiptFor && (
        <WLReceiptModal
          company={receiptFor}
          onSuccess={(demoId) => {
            onMove(demoId, "paid");
            onUpdate(demoId, { status: "paid" });
            setReceiptFor(null);
          }}
          onCancel={() => setReceiptFor(null)}
        />
      )}

      {/* Модалка заполнения ЛПР */}
      {lprFor && (
        <WLLprModal
          company={lprFor}
          onSuccess={patch => {
            onUpdate(lprFor.demo_id, patch);
            setLprFor(null);
          }}
          onClose={() => setLprFor(null)}
        />
      )}

      {/* Модалка истории демо/смет */}
      {historyFor && (
        <WLBalanceHistoryModal
          company={historyFor.company}
          mode={historyFor.mode}
          onClose={() => setHistoryFor(null)}
        />
      )}
    </div>
  );
}