import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { DEFAULT_TAGS } from "./crmApi";
import { Section } from "./drawerComponents";
import { BlockId } from "./drawerTypes";

// ── DrawerTagsBlock ────────────────────────────────────────────────────────────
// Ровно 2 метки на выбор (Недозвон / Перезвонить), у клиента может стоять только
// одна из них одновременно. Обе видны сразу в сером виде; клик красит выбранную
// и снимает предыдущую. Метка сбрасывается автоматически при смене этапа заказа
// (см. backend/crm-manager: сброс tags при обновлении status).
export function DrawerTagsBlock({ id, tags, hiddenBlocks, toggleHidden, save, logAction }: {
  id: BlockId;
  tags: string[] | null;
  editingBlock: BlockId | null;
  hiddenBlocks: Set<BlockId>;
  toggleHidden: (id: BlockId) => void;
  setEditingBlock: (id: BlockId | null) => void;
  save: (patch: { tags: string[] }) => void;
  logAction: (icon: string, color: string, text: string) => void;
}) {
  const t = useTheme();
  const isHiddenTags = hiddenBlocks.has(id);
  const current = (tags || [])[0] || null;

  const selectTag = (label: string) => {
    if (current === label) return;
    save({ tags: [label] });
    logAction("Tag", "#06b6d4", `Метка: ${label}`);
  };

  const clearTag = () => {
    if (!current) return;
    save({ tags: [] });
    logAction("Tag", "#ef4444", `Метка снята: ${current}`);
  };

  return (
    <Section icon="Tag" title="Метки" color="#06b6d4"
      hidden={isHiddenTags}
      onToggleHidden={() => toggleHidden(id)}>
      <div className="flex items-center gap-1.5 flex-wrap py-2">
        {DEFAULT_TAGS.map(tg => {
          const active = current === tg.label;
          return (
            <div key={tg.label} className="flex items-center gap-1">
              <button
                onClick={() => active ? clearTag() : selectTag(tg.label)}
                title={active ? "Нажмите, чтобы снять метку" : `Поставить метку «${tg.label}»`}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold transition"
                style={active
                  ? { background: tg.color + "30", color: tg.color, border: `1px solid ${tg.color}60` }
                  : { background: t.surface2, color: t.textMute, border: `1px solid ${t.border}` }}>
                {tg.label}
              </button>
              {active && (
                <button onClick={() => selectTag(current === "Недозвон" ? "Перезвонить" : "Недозвон")}
                  title="Сменить метку"
                  className="p-1 rounded-md transition hover:bg-white/10" style={{ color: tg.color }}>
                  <Icon name="RefreshCw" size={11} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
