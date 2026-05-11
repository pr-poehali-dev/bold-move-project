import Icon from "@/components/ui/icon";
import { ImageUploadButton, CategoryFunctionsButton, IMAGE_URL, EMPTY_NEW } from "./TabPricesShared";
import type { ThemeClasses } from "./TabPricesShared";
import { PriceItemRow, PriceItemCard } from "./TabPriceItemRow";
import { PRICE_UNITS } from "./constants";
import type { PriceItem } from "./types";

interface Props {
  category: string;
  items: PriceItem[];
  isDark: boolean;
  readOnly: boolean;
  theme: ThemeClasses;
  dragOverId: number | null;
  itemImages: Record<number, string>;
  catImages: Record<string, string>;
  aiLoadingId: number | null;
  aiDescLoadingId: number | null;
  addingInCat: string | null;
  newItem: typeof EMPTY_NEW;
  editingCat: string | null;
  editingCatVal: string;
  onDragStart: (item: PriceItem) => void;
  onDragEnter: (item: PriceItem) => void;
  onDragEnd: () => void;
  onToggleActive: (item: PriceItem) => void;
  onSaveField: (item: PriceItem, field: keyof PriceItem, val: string) => void;
  onDelete: (item: PriceItem) => void;
  onGenerateDescription: (item: PriceItem) => void;
  onGenerateSynonyms: (item: PriceItem) => void;
  onImageUploaded: (item: PriceItem, url: string) => void;
  onCatImageUploaded: (category: string, url: string) => void;
  onSetAddingInCat: (cat: string | null) => void;
  onSetNewItem: React.Dispatch<React.SetStateAction<typeof EMPTY_NEW>>;
  onAddItem: (category: string) => void;
  onSetEditingCat: (cat: string | null) => void;
  onSetEditingCatVal: (val: string) => void;
  onRenameCategory: (category: string) => void;
  token?: string;
}

export default function TabPriceCategoryBlock({
  category, items, isDark, readOnly, theme,
  dragOverId, itemImages, catImages,
  aiLoadingId, aiDescLoadingId,
  addingInCat, newItem, editingCat, editingCatVal,
  onDragStart, onDragEnter, onDragEnd,
  onToggleActive, onSaveField, onDelete,
  onGenerateDescription, onGenerateSynonyms,
  onImageUploaded, onCatImageUploaded,
  onSetAddingInCat, onSetNewItem, onAddItem,
  onSetEditingCat, onSetEditingCatVal, onRenameCategory,
  token,
}: Props) {
  const { text, muted, muted2, border, border2, bg, bgInput, borderInput } = theme;
  const isMaterial   = items[0]?.is_material  !== false;
  const isWall       = items[0]?.is_wall_item !== false;
  const showInDrum   = items[0]?.show_in_drum !== false;

  return (
    <div>
      {/* Заголовок категории */}
      <div className="flex items-center justify-between mb-2 px-1 group">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Картинка категории */}
          {!readOnly && (
            <ImageUploadButton
              currentUrl={catImages[category]}
              uploadEndpoint={`${IMAGE_URL}?type=category&category=${encodeURIComponent(category)}`}
              isDark={isDark}
              onUploaded={url => onCatImageUploaded(category, url)}
            />
          )}
          {catImages[category] && readOnly && (
            <img src={catImages[category]} alt="" className="w-6 h-6 rounded object-cover" />
          )}
          {editingCat === category ? (
            <input
              autoFocus
              value={editingCatVal}
              onChange={e => onSetEditingCatVal(e.target.value)}
              onBlur={() => onRenameCategory(category)}
              onKeyDown={e => {
                if (e.key === "Enter") onRenameCategory(category);
                if (e.key === "Escape") onSetEditingCat(null);
              }}
              className={`text-violet-500 text-xs font-semibold uppercase tracking-wider bg-violet-500/10 border border-violet-500/40 rounded px-2 py-0.5 outline-none w-48 ${isDark ? "" : "bg-violet-50"}`}
            />
          ) : (
            <h3
              className={`${isDark ? "text-violet-300 hover:text-violet-200" : "text-violet-600 hover:text-violet-700"} text-xs font-semibold uppercase tracking-wider cursor-pointer transition flex items-center gap-1.5 shrink-0`}
              onClick={() => { onSetEditingCat(category); onSetEditingCatVal(category); }}
              title="Нажмите чтобы переименовать группу"
            >
              {category}
              <Icon name="Pencil" size={10} className="opacity-0 group-hover:opacity-40 transition" />
            </h3>
          )}


        </div>
        {!readOnly && (
          <CategoryFunctionsButton
            category={category}
            initialIsMaterial={isMaterial}
            initialIsWall={isWall}
            initialShowInDrum={showInDrum}
            isDark={isDark}
            token={token}
          />
        )}
      </div>

      {/* Тело */}
      <div className={`${bg} border ${border} rounded-xl overflow-hidden`}>
        {/* Десктоп: таблица */}
        <table className="hidden sm:table w-full text-sm">
          <thead>
            <tr className={`border-b ${border}`}>
              <th className="px-2 py-2.5 w-6" />
              <th className={`text-left ${muted2} font-normal px-4 py-2.5 w-[32%]`}>Название</th>
              <th className={`text-right ${muted2} font-normal px-4 py-2.5 w-[9%] whitespace-nowrap`}>Продажа ₽</th>
              <th className={`text-right ${muted2} font-normal px-4 py-2.5 w-[9%] whitespace-nowrap`}>Закупка ₽</th>
              <th className={`text-left ${muted2} font-normal px-4 py-2.5 w-[6%] whitespace-nowrap`}>Ед.</th>
              <th className={`text-left ${muted2} font-normal px-4 py-2.5 w-[20%] whitespace-nowrap`}>Описание (AI)</th>
              <th className={`text-left ${muted2} font-normal px-4 py-2.5 whitespace-nowrap`}>Синонимы</th>
              <th className="px-3 py-2.5 w-8" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <PriceItemRow
                key={item.id}
                item={item}
                idx={idx}
                isDark={isDark}
                readOnly={readOnly}
                theme={theme}
                dragOverId={dragOverId}
                itemImageUrl={itemImages[item.id]}
                aiLoadingId={aiLoadingId}
                aiDescLoadingId={aiDescLoadingId}
                onDragStart={onDragStart}
                onDragEnter={onDragEnter}
                onDragEnd={onDragEnd}
                onToggleActive={onToggleActive}
                onSaveField={onSaveField}
                onDelete={onDelete}
                onGenerateDescription={onGenerateDescription}
                onGenerateSynonyms={onGenerateSynonyms}
                onImageUploaded={onImageUploaded}
              />
            ))}
          </tbody>
        </table>

        {/* Мобиле: карточки */}
        <div className="sm:hidden flex flex-col divide-y" style={{ borderColor: isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6" }}>
          {items.map(item => (
            <PriceItemCard
              key={item.id}
              item={item}
              isDark={isDark}
              readOnly={readOnly}
              theme={theme}
              aiLoadingId={aiLoadingId}
              aiDescLoadingId={aiDescLoadingId}
              onToggleActive={onToggleActive}
              onSaveField={onSaveField}
              onDelete={onDelete}
              onGenerateDescription={onGenerateDescription}
              onGenerateSynonyms={onGenerateSynonyms}
            />
          ))}
        </div>

        {/* Форма добавления позиции */}
        {!readOnly && addingInCat === category ? (
          <div className={`border-t ${border} px-4 py-3 flex gap-2 items-end flex-wrap bg-violet-500/5`}>
            <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
              <span className={`${muted2} text-xs`}>Название</span>
              <input
                autoFocus
                value={newItem.name}
                onChange={e => onSetNewItem(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && onAddItem(category)}
                placeholder="Новая позиция..."
                className={`${bgInput} border ${borderInput} rounded-lg px-3 py-1.5 ${text} text-sm outline-none focus:border-violet-500`}
              />
            </div>
            <div className="flex flex-col gap-1 w-24">
              <span className={`${muted2} text-xs`}>Цена продажи ₽</span>
              <input
                type="number"
                value={newItem.price}
                onChange={e => onSetNewItem(p => ({ ...p, price: e.target.value }))}
                placeholder="0"
                className={`${bgInput} border ${borderInput} rounded-lg px-3 py-1.5 text-green-500 text-sm outline-none focus:border-violet-500 font-mono`}
              />
            </div>
            <div className="flex flex-col gap-1 w-24">
              <span className={`${muted2} text-xs`}>Цена закупки ₽</span>
              <input
                type="number"
                value={newItem.purchase_price}
                onChange={e => onSetNewItem(p => ({ ...p, purchase_price: e.target.value }))}
                placeholder="0"
                className={`${bgInput} border ${borderInput} rounded-lg px-3 py-1.5 text-blue-500 text-sm outline-none focus:border-violet-500 font-mono`}
              />
            </div>
            <div className="flex flex-col gap-1 w-24">
              <span className={`${muted2} text-xs`}>Единица</span>
              <select
                value={newItem.unit}
                onChange={e => onSetNewItem(p => ({ ...p, unit: e.target.value }))}
                className={`${bgInput} border ${borderInput} rounded-lg px-3 py-1.5 ${text} text-sm outline-none focus:border-violet-500 cursor-pointer`}
              >
                {PRICE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-[2] min-w-[150px]">
              <span className={`${muted2} text-xs`}>Описание для AI</span>
              <input
                value={newItem.description}
                onChange={e => onSetNewItem(p => ({ ...p, description: e.target.value }))}
                placeholder="Как AI понимает позицию..."
                className={`${bgInput} border ${borderInput} rounded-lg px-3 py-1.5 ${text} text-sm outline-none focus:border-violet-500`}
              />
            </div>
            <div className="flex gap-2 pb-0.5">
              <button
                onClick={() => onAddItem(category)}
                className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-1.5 text-sm transition"
              >
                Добавить
              </button>
              <button
                onClick={() => { onSetAddingInCat(null); onSetNewItem(() => ({ ...EMPTY_NEW })); }}
                className={`${muted} hover:${text} text-sm transition`}
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          !readOnly && (
            <button
              onClick={() => { onSetAddingInCat(category); onSetNewItem(() => ({ ...EMPTY_NEW })); }}
              className={`w-full py-2.5 ${isDark ? "text-violet-400/60" : "text-violet-500/70"} hover:text-violet-400 text-xs flex items-center justify-center gap-1.5 border-t ${border2} transition hover:bg-violet-500/5`}
            >
              <Icon name="Plus" size={13} /> Добавить позицию в «{category}»
            </button>
          )
        )}
      </div>
    </div>
  );
}