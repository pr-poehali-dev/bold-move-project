import { useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import EditableCell from "./EditableCell";
import PriceFieldModal from "./PriceFieldModal";
import { ImageUploadButton, IMAGE_URL } from "./TabPricesShared";
import type { ThemeClasses } from "./TabPricesShared";
import { PRICE_UNITS } from "./constants";
import type { PriceItem } from "./types";

interface RowProps {
  item: PriceItem;
  idx: number;
  isDark: boolean;
  readOnly: boolean;
  theme: ThemeClasses;
  dragOverId: number | null;
  itemImageUrl: string | undefined;
  aiLoadingId: number | null;
  aiDescLoadingId: number | null;
  token?: string;
  onDragStart: (item: PriceItem) => void;
  onDragEnter: (item: PriceItem) => void;
  onDragEnd: () => void;
  onToggleActive: (item: PriceItem) => void;
  onSaveField: (item: PriceItem, field: keyof PriceItem, val: string) => void;
  onDelete: (item: PriceItem) => void;
  onGenerateDescription: (item: PriceItem) => void;
  onGenerateSynonyms: (item: PriceItem) => void;
  onImageUploaded: (item: PriceItem, url: string) => void;
}

// ── Десктопная строка таблицы ─────────────────────────────────────────────────

export function PriceItemRow({
  item, idx, isDark, readOnly, theme, dragOverId,
  itemImageUrl, aiLoadingId, aiDescLoadingId, token,
  onDragStart, onDragEnter, onDragEnd, onToggleActive,
  onSaveField, onDelete, onGenerateDescription, onGenerateSynonyms, onImageUploaded,
}: RowProps) {
  const { text, muted, muted2, border2, selectBg } = theme;
  const [modal, setModal] = useState<"description" | "synonyms" | null>(null);

  const hasDesc = !!item.description?.trim();
  const hasSyn  = !!item.synonyms?.trim();

  return (
    <>
      <tr
        draggable
        onDragStart={() => onDragStart(item)}
        onDragEnter={() => onDragEnter(item)}
        onDragEnd={onDragEnd}
        onDragOver={e => e.preventDefault()}
        className={`border-b ${border2} last:border-0 transition-colors cursor-grab active:cursor-grabbing
          ${!item.active ? "opacity-40" : ""}
          ${idx % 2 ? (isDark ? "bg-white/[0.01]" : "bg-gray-50/50") : ""}
          ${dragOverId === item.id ? "bg-violet-500/10 border-violet-500/30" : ""}
        `}
      >
        <td className="px-2 py-2.5 w-6">
          {!readOnly && (
            <Icon name="GripVertical" size={14}
              className={`${isDark ? "text-white/15 hover:text-white/40" : "text-gray-300 hover:text-gray-500"} transition mx-auto`} />
          )}
        </td>
        <td className={`px-4 py-2.5 ${text}`}>
          <div className="flex items-center gap-2">
            <button
              onClick={e => { e.stopPropagation(); onToggleActive(item); }}
              title={item.active ? "Отключить" : "Включить"}
              className={`w-3 h-3 rounded-full border flex-shrink-0 transition ${
                item.active
                  ? "bg-green-400 border-green-400"
                  : isDark ? "border-white/20 hover:border-white/40" : "border-gray-300 hover:border-gray-400"
              }`}
            />
            {!readOnly && (
              <ImageUploadButton
                currentUrl={itemImageUrl ?? (item as PriceItem & { image_url?: string }).image_url}
                uploadEndpoint={`${IMAGE_URL}?type=item&id=${item.id}`}
                isDark={isDark}
                token={token}
                onUploaded={url => onImageUploaded(item, url)}
              />
            )}
            <EditableCell value={item.name} onSave={v => onSaveField(item, "name", v)} />
          </div>
        </td>
        <td className="px-4 py-2.5 text-right font-mono text-green-400">
          <EditableCell value={item.price} type="number" onSave={v => onSaveField(item, "price", v)} className="text-right" />
        </td>
        <td className="px-4 py-2.5 text-right font-mono text-blue-400">
          <EditableCell value={item.purchase_price ?? ""} type="number" onSave={v => onSaveField(item, "purchase_price", v)} className="text-right" placeholder="—" />
        </td>
        <td className="px-4 py-2.5 text-right font-mono text-cyan-400">
          <EditableCell value={item.installation_price ?? 100} type="number" onSave={v => onSaveField(item, "installation_price", v)} className="text-right" placeholder="—" />
        </td>
        <td className="px-4 py-2.5 text-right font-mono text-teal-400">
          <EditableCell value={item.measure_price ?? 100} type="number" onSave={v => onSaveField(item, "measure_price", v)} className="text-right" placeholder="—" />
        </td>
        <td className="px-4 py-2.5 text-right font-mono text-fuchsia-400">
          <EditableCell value={item.management_price ?? 100} type="number" onSave={v => onSaveField(item, "management_price", v)} className="text-right" placeholder="—" />
        </td>
        <td className={`px-4 py-2.5 ${muted} text-xs`}>
          <select
            value={item.unit}
            onChange={e => onSaveField(item, "unit", e.target.value)}
            className={`bg-transparent text-sm outline-none cursor-pointer transition appearance-none ${muted}`}
            style={{ colorScheme: isDark ? "dark" : "light" }}
          >
            {PRICE_UNITS.map(u => <option key={u} value={u} style={{ background: selectBg }}>{u}</option>)}
          </select>
        </td>

        {/* Тихие кнопки вместо колонок */}
        <td className="px-3 py-2.5 w-8">
          <div className="flex items-center gap-1 justify-end">
            {/* Описание */}
            <button
              onClick={() => setModal("description")}
              title={hasDesc ? item.description : "Добавить описание"}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition text-[10px] font-medium
                ${hasDesc
                  ? "text-violet-400 bg-violet-500/10 hover:bg-violet-500/20"
                  : `${muted2} opacity-30 hover:opacity-70 hover:bg-white/5`
                }`}
            >
              <Icon name="FileText" size={11} />
              <span className="hidden lg:inline">Описание</span>
            </button>

            {/* Синонимы */}
            <button
              onClick={() => setModal("synonyms")}
              title={hasSyn ? item.synonyms : "Добавить синонимы"}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition text-[10px] font-medium
                ${hasSyn
                  ? "text-amber-400/80 bg-amber-500/10 hover:bg-amber-500/20"
                  : `${muted2} opacity-30 hover:opacity-70 hover:bg-white/5`
                }`}
            >
              <Icon name="Tag" size={11} />
              <span className="hidden lg:inline">Синонимы</span>
            </button>

            {/* Удалить */}
            {!readOnly && (
              <button
                onClick={() => onDelete(item)}
                title="Удалить"
                className={`${isDark ? "text-white/20" : "text-gray-300"} hover:text-red-400 transition ml-1`}
              >
                <Icon name="X" size={13} />
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Модалки через portal */}
      {modal && createPortal(
        <PriceFieldModal
          item={item}
          field={modal}
          isLoading={modal === "description" ? aiDescLoadingId === item.id : aiLoadingId === item.id}
          onSave={onSaveField}
          onGenerate={modal === "description" ? onGenerateDescription : onGenerateSynonyms}
          onClose={() => setModal(null)}
          isDark={isDark}
        />,
        document.body
      )}
    </>
  );
}

// ── Мобильная карточка ────────────────────────────────────────────────────────

export function PriceItemCard({
  item, isDark, readOnly, theme,
  aiLoadingId, aiDescLoadingId,
  onToggleActive, onSaveField, onDelete,
  onGenerateDescription, onGenerateSynonyms,
}: Omit<RowProps, "idx" | "dragOverId" | "itemImageUrl" | "token" | "onDragStart" | "onDragEnter" | "onDragEnd" | "onImageUploaded">) {
  const { text, muted, muted2, selectBg } = theme;
  const [modal, setModal] = useState<"description" | "synonyms" | null>(null);

  const hasDesc = !!item.description?.trim();
  const hasSyn  = !!item.synonyms?.trim();

  return (
    <>
      <div className={`px-3 py-3 flex flex-col gap-2.5 ${!item.active ? "opacity-40" : ""}`}>
        {/* Строка 1: активность + название + удалить */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleActive(item)}
            className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 transition ${
              item.active ? "bg-green-400 border-green-400" : isDark ? "border-white/25" : "border-gray-300"
            }`}
          />
          <div className={`flex-1 font-medium text-sm ${text}`}>
            <EditableCell value={item.name} onSave={v => onSaveField(item, "name", v)} />
          </div>
          {!readOnly && (
            <button
              onClick={() => onDelete(item)}
              className={`${isDark ? "text-white/20" : "text-gray-300"} hover:text-red-400 transition p-1`}
            >
              <Icon name="X" size={13} />
            </button>
          )}
        </div>

        {/* Строка 2: цены + единица */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-0.5 flex-1">
            <span className={`text-[10px] ${muted2}`}>Продажа ₽</span>
            <div className="font-mono text-green-400 text-sm">
              <EditableCell value={item.price} type="number" onSave={v => onSaveField(item, "price", v)} />
            </div>
          </div>
          <div className="flex flex-col gap-0.5 flex-1">
            <span className={`text-[10px] ${muted2}`}>Закупка ₽</span>
            <div className="font-mono text-blue-400 text-sm">
              <EditableCell value={item.purchase_price ?? ""} type="number" onSave={v => onSaveField(item, "purchase_price", v)} placeholder="—" />
            </div>
          </div>
          <div className="flex flex-col gap-0.5 flex-1">
            <span className={`text-[10px] ${muted2}`}>Монтаж ₽</span>
            <div className="font-mono text-cyan-400 text-sm">
              <EditableCell value={item.installation_price ?? 100} type="number" onSave={v => onSaveField(item, "installation_price", v)} placeholder="—" />
            </div>
          </div>
          <div className="flex flex-col gap-0.5 flex-1">
            <span className={`text-[10px] ${muted2}`}>Замер ₽</span>
            <div className="font-mono text-teal-400 text-sm">
              <EditableCell value={item.measure_price ?? 100} type="number" onSave={v => onSaveField(item, "measure_price", v)} placeholder="—" />
            </div>
          </div>
          <div className="flex flex-col gap-0.5 flex-1">
            <span className={`text-[10px] ${muted2}`}>Менеджмент ₽</span>
            <div className="font-mono text-fuchsia-400 text-sm">
              <EditableCell value={item.management_price ?? 100} type="number" onSave={v => onSaveField(item, "management_price", v)} placeholder="—" />
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className={`text-[10px] ${muted2}`}>Ед.</span>
            <select
              value={item.unit}
              onChange={e => onSaveField(item, "unit", e.target.value)}
              className={`bg-transparent text-sm outline-none cursor-pointer appearance-none ${muted}`}
              style={{ colorScheme: isDark ? "dark" : "light" }}
            >
              {PRICE_UNITS.map(u => <option key={u} value={u} style={{ background: selectBg }}>{u}</option>)}
            </select>
          </div>
        </div>

        {/* Строка 3: кнопки Описание + Синонимы */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModal("description")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition
              ${hasDesc
                ? "text-violet-400 bg-violet-500/10 border border-violet-500/20"
                : `${muted} bg-white/5 border border-white/5 opacity-50`
              }`}
          >
            <Icon name="FileText" size={12} />
            Описание {hasDesc && <span className="text-[9px] opacity-60">✓</span>}
          </button>
          <button
            onClick={() => setModal("synonyms")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition
              ${hasSyn
                ? "text-amber-400/80 bg-amber-500/10 border border-amber-500/20"
                : `${muted} bg-white/5 border border-white/5 opacity-50`
              }`}
          >
            <Icon name="Tag" size={12} />
            Синонимы {hasSyn && <span className="text-[9px] opacity-60">✓</span>}
          </button>
        </div>
      </div>

      {modal && createPortal(
        <PriceFieldModal
          item={item}
          field={modal}
          isLoading={modal === "description" ? aiDescLoadingId === item.id : aiLoadingId === item.id}
          onSave={onSaveField}
          onGenerate={modal === "description" ? onGenerateDescription : onGenerateSynonyms}
          onClose={() => setModal(null)}
          isDark={isDark}
        />,
        document.body
      )}
    </>
  );
}