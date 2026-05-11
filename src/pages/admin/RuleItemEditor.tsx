import Icon from "@/components/ui/icon";
import BundleSelector from "./BundleSelector";
import type { RuleItem, RuleType, DraftMap } from "./RuleTypes";
import type { PriceItem } from "./types";

interface Props {
  item: RuleItem;
  d: DraftMap[number];
  isSaving: boolean;
  isDark: boolean;
  activeRuleTypes: RuleType[];
  prices: PriceItem[];
  onAutoBundle?: (item: RuleItem) => void;
  autoBundleLoadingId?: number | null;
  onPatchDraft: (id: number, patch: Partial<DraftMap[number]>) => void;
  onSaveRow: (item: RuleItem) => void;
  onCloseRow: () => void;
  desktop?: boolean;
}

export default function RuleItemEditor({
  item, d, isSaving, isDark, activeRuleTypes, prices,
  onAutoBundle, autoBundleLoadingId,
  onPatchDraft, onSaveRow, onCloseRow,
  desktop = false,
}: Props) {
  if (desktop) {
    return (
      <div className="bg-white/[0.02] border-b border-white/5 px-5 py-4 flex flex-col gap-4">
        <p className="text-white/40 text-xs">Правила для <span className="text-violet-300 font-medium">{item.name}</span></p>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-white/60 text-xs font-medium flex items-center gap-1.5">
              <Icon name="CircleCheck" size={11} className="text-green-400" />
              1. Добавляется если...
            </label>
            <textarea
              value={d.when_condition}
              onChange={e => onPatchDraft(item.id, { when_condition: e.target.value })}
              placeholder={"Например:\n• клиент выбрал ПВХ полотно\n• в смете есть точечные светильники\n• клиент упомянул люстру\n• всегда добавлять"}
              rows={5}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-green-500/60 resize-none transition placeholder-white/20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-white/60 text-xs font-medium flex items-center gap-1.5">
              <Icon name="CircleX" size={11} className="text-red-400" />
              2. НЕ добавляется если...
            </label>
            <textarea
              value={d.when_not_condition}
              onChange={e => onPatchDraft(item.id, { when_not_condition: e.target.value })}
              placeholder={"Например:\n• клиент выбрал тканевое полотно\n• в смете уже есть теневой профиль\n• клиент написал «без монтажа»"}
              rows={5}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-red-500/60 resize-none transition placeholder-white/20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-white/60 text-xs font-medium flex items-center gap-1.5">
              <Icon name="Calculator" size={11} className="text-violet-400" />
              3. Логика расчёта
            </label>
            <textarea
              value={d.calc_rule}
              onChange={e => onPatchDraft(item.id, { calc_rule: e.target.value })}
              placeholder={"Сколько добавлять и при каких условиях:\n• площадь комнаты\n• периметр × 1.3\n• 1 шт на каждый светильник\n• длина ниши (спросить у клиента)\n• площадь + 30% если высота > 3м"}
              rows={5}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-violet-500 resize-none transition placeholder-white/20"
            />
          </div>
        </div>

        {activeRuleTypes.filter(rt => rt.name !== "calc_rule" && rt.name !== "bundle").map(rt => (
          <div key={rt.id} className="flex flex-col gap-1.5">
            <label className="text-white/60 text-xs font-medium">{rt.label}</label>
            <textarea
              value={d.custom[rt.id] ?? ""}
              onChange={e => onPatchDraft(item.id, { custom: { ...d.custom, [rt.id]: e.target.value } })}
              placeholder={rt.placeholder || "—"}
              rows={2}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-violet-500 resize-none transition"
            />
          </div>
        ))}

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-white/60 text-xs font-medium flex items-center gap-1.5">
              <Icon name="Package" size={11} className="text-green-400" />
              Вместе добавить позиции
            </label>
            {onAutoBundle && (
              <button
                onClick={() => onAutoBundle(item)}
                disabled={autoBundleLoadingId === item.id}
                className="flex items-center gap-1 text-[10px] bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 text-violet-300 px-2 py-1 rounded-lg transition disabled:opacity-50"
                title="ИИ предложит подходящие позиции для комплекта"
              >
                {autoBundleLoadingId === item.id
                  ? <Icon name="Loader2" size={10} className="animate-spin" />
                  : <Icon name="Sparkles" size={10} />}
                Авто
              </button>
            )}
          </div>
          <BundleSelector
            prices={prices}
            selectedPriceId={item.id}
            excludeId={item.id}
            bundleIds={d.bundleIds}
            bundleSearch={d.bundleSearch}
            bundleOpen={d.bundleOpen}
            onToggleOpen={() => onPatchDraft(item.id, { bundleOpen: !d.bundleOpen })}
            onBundleSearchChange={v => onPatchDraft(item.id, { bundleSearch: v })}
            onToggleItem={id => onPatchDraft(item.id, {
              bundleIds: d.bundleIds.includes(id) ? d.bundleIds.filter(x => x !== id) : [...d.bundleIds, id]
            })}
            onRemoveItem={id => onPatchDraft(item.id, { bundleIds: d.bundleIds.filter(x => x !== id) })}
          />
        </div>

        <div className="flex gap-2 pt-1 border-t border-white/5">
          <button onClick={() => onSaveRow(item)} disabled={isSaving}
            className="bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-xs px-4 py-2 rounded-lg transition flex items-center gap-1.5">
            {isSaving ? <Icon name="Loader" size={12} className="animate-spin" /> : <Icon name="Check" size={12} />}
            Сохранить
          </button>
          <button onClick={onCloseRow} className="text-white/40 hover:text-white/70 text-xs transition px-3 py-2">Отмена</button>
        </div>
      </div>
    );
  }

  // Mobile version
  return (
    <div className={`px-4 pb-4 flex flex-col gap-3 ${isDark ? "bg-white/[0.02]" : "bg-gray-50/50"}`}>
      <p className={`text-xs pt-2`} style={{ color: isDark ? "rgba(255,255,255,0.3)" : "#9ca3af" }}>
        Правила для <span className={isDark ? "text-violet-300 font-medium" : "text-violet-600 font-medium"}>{item.name}</span>
      </p>

      <div className="flex flex-col gap-1.5">
        <label className={`${isDark ? "text-white/60" : "text-gray-500"} text-xs font-medium flex items-center gap-1.5`}>
          <Icon name="CircleCheck" size={11} className="text-green-400" />
          Добавляется если...
        </label>
        <textarea value={d.when_condition}
          onChange={e => onPatchDraft(item.id, { when_condition: e.target.value })}
          placeholder={"• клиент выбрал ПВХ полотно\n• всегда добавлять"}
          rows={3}
          className={`${isDark ? "bg-white/5 border-white/10 text-white placeholder-white/20 focus:border-green-500/60" : "bg-white border-gray-200 text-gray-900 placeholder-gray-300 focus:border-green-500"} border rounded-lg px-3 py-2 text-xs outline-none resize-none transition`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={`${isDark ? "text-white/60" : "text-gray-500"} text-xs font-medium flex items-center gap-1.5`}>
          <Icon name="CircleX" size={11} className="text-red-400" />
          НЕ добавляется если...
        </label>
        <textarea value={d.when_not_condition}
          onChange={e => onPatchDraft(item.id, { when_not_condition: e.target.value })}
          placeholder={"• клиент выбрал тканевое полотно"}
          rows={3}
          className={`${isDark ? "bg-white/5 border-white/10 text-white placeholder-white/20 focus:border-red-500/60" : "bg-white border-gray-200 text-gray-900 placeholder-gray-300 focus:border-red-500"} border rounded-lg px-3 py-2 text-xs outline-none resize-none transition`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={`${isDark ? "text-white/60" : "text-gray-500"} text-xs font-medium flex items-center gap-1.5`}>
          <Icon name="Calculator" size={11} className="text-violet-400" />
          Логика расчёта
        </label>
        <textarea value={d.calc_rule}
          onChange={e => onPatchDraft(item.id, { calc_rule: e.target.value })}
          placeholder={"• площадь комнаты\n• периметр × 1.3"}
          rows={3}
          className={`${isDark ? "bg-white/5 border-white/10 text-white placeholder-white/20 focus:border-violet-500" : "bg-white border-gray-200 text-gray-900 placeholder-gray-300 focus:border-violet-500"} border rounded-lg px-3 py-2 text-xs outline-none resize-none transition`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={`${isDark ? "text-white/60" : "text-gray-500"} text-xs font-medium flex items-center gap-1.5`}>
          <Icon name="PenLine" size={11} className="text-amber-400" />
          Изменения клиента
        </label>
        <textarea value={d.client_changes}
          onChange={e => onPatchDraft(item.id, { client_changes: e.target.value })}
          placeholder={"что может изменить клиент..."}
          rows={2}
          className={`${isDark ? "bg-white/5 border-white/10 text-white placeholder-white/20" : "bg-white border-gray-200 text-gray-900 placeholder-gray-300"} border rounded-lg px-3 py-2 text-xs outline-none resize-none transition`}
        />
      </div>

      {activeRuleTypes.filter(rt => rt.name !== "calc_rule" && rt.name !== "bundle").map(rt => (
        <div key={rt.id} className="flex flex-col gap-1.5">
          <label className={`${isDark ? "text-white/60" : "text-gray-500"} text-xs font-medium`}>{rt.label}</label>
          <textarea
            value={d.custom[rt.id] ?? ""}
            onChange={e => onPatchDraft(item.id, { custom: { ...d.custom, [rt.id]: e.target.value } })}
            placeholder={rt.placeholder || "—"}
            rows={2}
            className={`${isDark ? "bg-white/5 border-white/10 text-white placeholder-white/20" : "bg-white border-gray-200 text-gray-900 placeholder-gray-300"} border rounded-lg px-3 py-2 text-xs outline-none resize-none transition`}
          />
        </div>
      ))}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className={`${isDark ? "text-white/60" : "text-gray-500"} text-xs font-medium flex items-center gap-1.5`}>
            <Icon name="Package" size={11} className="text-green-400" />
            Вместе добавить позиции
          </label>
          {onAutoBundle && (
            <button
              onClick={() => onAutoBundle(item)}
              disabled={autoBundleLoadingId === item.id}
              className="flex items-center gap-1 text-[10px] bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 text-violet-300 px-2 py-1 rounded-lg transition disabled:opacity-50"
              title="ИИ предложит подходящие позиции для комплекта"
            >
              {autoBundleLoadingId === item.id
                ? <Icon name="Loader2" size={10} className="animate-spin" />
                : <Icon name="Sparkles" size={10} />}
              Авто
            </button>
          )}
        </div>
        <BundleSelector
          prices={prices}
          selectedPriceId={item.id}
          excludeId={item.id}
          bundleIds={d.bundleIds}
          bundleSearch={d.bundleSearch}
          bundleOpen={d.bundleOpen}
          onToggleOpen={() => onPatchDraft(item.id, { bundleOpen: !d.bundleOpen })}
          onBundleSearchChange={v => onPatchDraft(item.id, { bundleSearch: v })}
          onToggleItem={id => onPatchDraft(item.id, {
            bundleIds: d.bundleIds.includes(id) ? d.bundleIds.filter(x => x !== id) : [...d.bundleIds, id]
          })}
          onRemoveItem={id => onPatchDraft(item.id, { bundleIds: d.bundleIds.filter(x => x !== id) })}
        />
      </div>

      <div className="flex gap-2 pt-2 border-t" style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb" }}>
        <button onClick={() => onSaveRow(item)} disabled={isSaving}
          className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-xs px-4 py-2.5 rounded-lg transition flex items-center justify-center gap-1.5">
          {isSaving ? <Icon name="Loader" size={12} className="animate-spin" /> : <Icon name="Check" size={12} />}
          Сохранить
        </button>
        <button onClick={onCloseRow}
          className={`px-4 py-2.5 text-xs rounded-lg transition ${isDark ? "text-white/40 hover:text-white/70" : "text-gray-500 hover:text-gray-700"}`}>
          Отмена
        </button>
      </div>
    </div>
  );
}
