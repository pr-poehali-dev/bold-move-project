import { STATUS_LABELS, Client, ClientStatus } from "./crmApi";
import Icon from "@/components/ui/icon";
import { ThemeCtx } from "./themeContext";
import { useCallClient } from "./useCallClient";

interface Props {
  t: ThemeCtx;
  ord: Client;
  data: Client;
  save: (patch: Partial<Client>) => void;
  contactMode: boolean;
  editingTitle: boolean;
  setEditingTitle: (v: boolean) => void;
  orderTitle: string;
  lsKey: string;
  displayColor: string;
  statuses: ClientStatus[];
  canEdit: boolean;
  canFinance: boolean;
  saving: boolean;
  copied: boolean;
  hideHidden: boolean;
  setHideHidden: (fn: (v: boolean) => boolean) => void;
  setConfirmDelete: (v: boolean) => void;
  onClose: () => void;
  onOpenAgent?: (client: Client) => void;
  onOpenBuilder?: (client: Client) => void;
}

export function DrawerHeader({
  t, ord, data, save, contactMode, editingTitle, setEditingTitle, orderTitle, lsKey, displayColor,
  statuses, canEdit, canFinance, saving, copied, hideHidden, setHideHidden, setConfirmDelete, onClose,
  onOpenAgent, onOpenBuilder,
}: Props) {
  const { call: callViaUis, calling } = useCallClient();
  return (
    <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-4 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 mr-2">
        {/* Цветной аватар с номером */}
        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-bold text-white"
          style={{ background: displayColor + "35", border: `2px solid ${displayColor}50` }}>
          <span className="text-xs sm:text-sm">{ord.id}</span>
        </div>

        <div className="min-w-0 flex-1">
          {/* Название заявки (или имя клиента — в contactMode) */}
          {editingTitle && !contactMode ? (
            <input
              autoFocus
              defaultValue={orderTitle}
              onBlur={e => {
                const val = e.target.value.trim();
                if (val && val !== `Заявка №${ord.id}`) {
                  localStorage.setItem(lsKey, val);
                } else {
                  localStorage.removeItem(lsKey);
                }
                setEditingTitle(false);
              }}
              onKeyDown={e => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setEditingTitle(false);
              }}
              className="text-sm sm:text-base font-bold bg-transparent focus:outline-none block w-full"
              style={{ color: "#fff", borderBottom: "1px solid #7c3aed", minWidth: 0 }}
            />
          ) : (
            <div
              className={`text-sm sm:text-base font-bold text-white truncate transition ${contactMode ? "" : "cursor-text hover:opacity-80"}`}
              style={{ maxWidth: "min(180px, 40vw)" }}
              title={contactMode ? undefined : "Нажмите чтобы изменить название"}
              onClick={() => !contactMode && setEditingTitle(true)}>
              {orderTitle}
            </div>
          )}

          {/* Статус + статус клиента + сумма */}
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-md font-semibold flex-shrink-0"
              style={{ background: displayColor + "25", color: displayColor }}>
              {STATUS_LABELS[ord.status] || ord.status}
            </span>
            {/* Выбор статуса клиента */}
            {statuses.length > 0 && (
              <div className="relative flex-shrink-0">
                <select
                  value={data.client_status || ""}
                  onChange={e => save({ client_status: e.target.value || null })}
                  disabled={!canEdit}
                  className="appearance-none text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md font-semibold focus:outline-none cursor-pointer transition pr-5"
                  style={data.client_status
                    ? (() => { const s = statuses.find(s => s.name === data.client_status); return s ? { background: s.color + "25", color: s.color, border: `1px solid ${s.color}40` } : { background: "rgba(255,255,255,0.07)", color: t.textMute }; })()
                    : { background: "rgba(255,255,255,0.07)", color: t.textMute, border: "1px solid transparent" }
                  }>
                  <option value="">— Статус клиента</option>
                  {statuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
                <Icon name="ChevronDown" size={9} className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: data.client_status ? statuses.find(s => s.name === data.client_status)?.color : t.textMute }} />
              </div>
            )}
            {canFinance && ord.contract_sum ? (
              <span className="text-xs font-bold text-emerald-400 flex-shrink-0">
                {ord.contract_sum.toLocaleString("ru-RU")} ₽
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Правые кнопки */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {saving && <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />}
        {copied && <span className="hidden sm:inline text-xs text-violet-300 whitespace-nowrap">Скопировано!</span>}

        {/* Позвонить клиенту — через АТС UIS, если настроена, иначе обычный tel: */}
        {ord.phone && (
          <button
            onClick={() => callViaUis(ord.phone)}
            disabled={calling}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition hover:opacity-90 disabled:opacity-60"
            style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}
            title={`Позвонить: ${ord.phone}`}
          >
            <Icon name={calling ? "Loader2" : "PhoneCall"} size={13} className={calling ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Позвонить</span>
          </button>
        )}

        {/* Открыть диалог в Avito */}
        {ord.avito_chat_url && (
          <a
            href={ord.avito_chat_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition hover:opacity-90"
            style={{ background: "rgba(249,115,22,0.15)", color: "#f97316", border: "1px solid rgba(249,115,22,0.25)" }}
            title="Открыть диалог в Avito"
          >
            <Icon name="ExternalLink" size={13} />
            <span className="hidden sm:inline">Avito</span>
          </a>
        )}

        {/* Перейти в бот — только на десктопе */}
        {onOpenAgent && (
          <button
            onClick={() => onOpenAgent(ord)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition hover:opacity-90"
            style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.25)" }}
            title="Перейти в бот"
          >
            <Icon name="Bot" size={13} />
            Агент
          </button>
        )}

        {/* Перейти в построитель — только на десктопе */}
        {onOpenBuilder && (
          <button
            onClick={() => onOpenBuilder(ord)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition hover:opacity-90"
            style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}
            title={ord.project_id ? "Открыть чертёж" : "Создать чертёж"}
          >
            <Icon name="PenTool" size={13} />
            Построитель
          </button>
        )}

        {/* Скрыть блоки — только на десктопе */}
        <button
          onClick={() => setHideHidden(v => { const next = !v; localStorage.setItem("drawer_hide_hidden", String(next)); return next; })}
          className="hidden sm:flex p-2 rounded-lg hover:bg-white/5 transition"
          style={{ color: hideHidden ? "#a78bfa" : t.textMute }}
          title={hideHidden ? "Показать скрытые блоки" : "Скрыть скрытые блоки"}>
          <Icon name={hideHidden ? "EyeOff" : "Eye"} size={15} />
        </button>

        {canEdit && (
          <button onClick={() => setConfirmDelete(true)} className="p-2 rounded-lg hover:bg-red-500/10 transition" style={{ color: t.textMute }}>
            <Icon name="Trash2" size={15} />
          </button>
        )}
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition" style={{ color: t.textMute }}>
          <Icon name="X" size={16} />
        </button>
      </div>
    </div>
  );
}