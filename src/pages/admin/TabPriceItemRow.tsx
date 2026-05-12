import Icon from "@/components/ui/icon";
import EditableCell from "./EditableCell";
import TruncatedCell from "./TruncatedCell";
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

  return (
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
      <td className={`px-4 py-2.5 ${muted} text-xs`}>
        <div className="flex items-center gap-1 min-w-0">
          <div className="flex-1 min-w-0">
            <TruncatedCell value={item.description} onSave={v => onSaveField(item, "description", v)} placeholder="Как AI понимает позицию..." maxChars={28} />
          </div>
          <button
            onClick={() => onGenerateDescription(item)}
            disabled={aiDescLoadingId === item.id}
            title="Сгенерировать описание через AI"
            className="flex-shrink-0 bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 text-violet-400 rounded px-1.5 py-0.5 disabled:opacity-40 transition flex items-center gap-1"
          >
            {aiDescLoadingId === item.id ? <Icon name="Loader" size={11} className="animate-spin" /> : <Icon name="Sparkles" size={11} />}
            <span className="text-[10px]">AI</span>
          </button>
        </div>
      </td>
      <td className="px-4 py-2.5 text-amber-400/60 text-xs w-[180px] max-w-[180px]">
        <div className="flex items-center gap-1 min-w-0">
          <div className="flex-1 min-w-0 overflow-hidden">
            <TruncatedCell value={item.synonyms || ""} onSave={v => onSaveField(item, "synonyms", v)} placeholder="карниз, гардина..." maxChars={25} />
          </div>
          <button
            onClick={() => onGenerateSynonyms(item)}
            disabled={aiLoadingId === item.id}
            title="Сгенерировать синонимы через AI"
            className="flex-shrink-0 bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 text-violet-400 rounded px-1.5 py-0.5 disabled:opacity-40 transition flex items-center gap-1"
          >
            {aiLoadingId === item.id ? <Icon name="Loader" size={11} className="animate-spin" /> : <Icon name="Sparkles" size={11} />}
            <span className="text-[10px]">AI</span>
          </button>
        </div>
      </td>
      <td className="px-3 py-2.5 w-8">
        <div className="flex items-center gap-1.5 justify-end">
          {!readOnly && (
            <button
              onClick={() => onDelete(item)}
              title="Удалить"
              className={`${isDark ? "text-white/20" : "text-gray-300"} hover:text-red-400 transition`}
            >
              <Icon name="X" size={13} />
            </button>
          )}
        </div>
      </td>
    </tr>
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

  return (
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
      {/* Строка 3: описание + AI */}
      <div className="flex flex-col gap-0.5">
        <span className={`text-[9px] font-bold uppercase tracking-wider ${muted} opacity-50`}>Описание для AI</span>
        <div className="flex items-center gap-2">
          <div className={`flex-1 text-xs ${muted}`}>
            <TruncatedCell value={item.description} onSave={v => onSaveField(item, "description", v)} placeholder="Как AI понимает позицию..." maxChars={40} />
          </div>
          <button
            onClick={() => onGenerateDescription(item)}
            disabled={aiDescLoadingId === item.id}
            className="flex-shrink-0 bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 text-violet-400 rounded px-2 py-1 disabled:opacity-40 transition flex items-center gap-1"
          >
            {aiDescLoadingId === item.id ? <Icon name="Loader" size={11} className="animate-spin" /> : <Icon name="Sparkles" size={11} />}
            <span className="text-[10px]">AI</span>
          </button>
        </div>
      </div>
      {/* Строка 4: синонимы + AI */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400/40">Синонимы поиска</span>
        <div className="flex items-center gap-2">
          <div className="flex-1 text-xs text-amber-400/60">
            <TruncatedCell value={item.synonyms || ""} onSave={v => onSaveField(item, "synonyms", v)} placeholder="карниз, гардина..." maxChars={40} />
          </div>
          <button
            onClick={() => onGenerateSynonyms(item)}
            disabled={aiLoadingId === item.id}
            className="flex-shrink-0 bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 text-violet-400 rounded px-2 py-1 disabled:opacity-40 transition flex items-center gap-1"
          >
            {aiLoadingId === item.id ? <Icon name="Loader" size={11} className="animate-spin" /> : <Icon name="Sparkles" size={11} />}
            <span className="text-[10px]">AI</span>
          </button>
        </div>
      </div>
    </div>
  );
}