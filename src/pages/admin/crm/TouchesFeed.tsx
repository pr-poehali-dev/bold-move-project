import { RefObject } from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { Touch, attachmentsOf, imagesOf, channelMeta, fmtTime, fmtDuration, callMeta } from "./touchesShared";

interface Props {
  loading: boolean;
  touches: Touch[];
  expanded: Record<number, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  onReply: (tt: Touch) => void;
  bottomRef: RefObject<HTMLDivElement>;
}

// Лента сообщений и звонков вкладки «Касания»: рендерит каждое касание
// (звонок с расшифровкой либо сообщение с вложениями/цитатой) в виде облачка.
export default function TouchesFeed({ loading, touches, expanded, setExpanded, onReply, bottomRef }: Props) {
  const t = useTheme();

  return (
    <div className="flex-1 overflow-y-auto min-h-0 px-3 sm:px-6 py-4 flex flex-col gap-2.5">
      {loading ? (
        <div className="text-center text-sm py-8" style={{ color: t.textMute }}>Загрузка…</div>
      ) : touches.length === 0 ? (
        <div className="text-center text-sm py-8" style={{ color: t.textMute }}>
          Пока нет касаний. Здесь появятся звонки и сообщения из мессенджеров.
        </div>
      ) : (
        touches.map(tt => {
          const meta = channelMeta(tt.channel);
          const out = tt.direction === "out";
          const isCall = tt.channel === "call";
          const quoted = tt.reply_to_id ? touches.find(x => x.id === tt.reply_to_id) : null;
          const nonImageAttachments = attachmentsOf(tt.attachments).filter(a => a.type !== "image");
          return (
            <div key={tt.id} className={`group flex items-center gap-1.5 ${out ? "justify-end" : "justify-start"}`}>
              {/* Кнопка «Ответить» — слева от чужого сообщения, справа от своего */}
              {!isCall && (
                <button onClick={() => onReply(tt)}
                  className={`flex-shrink-0 opacity-0 group-hover:opacity-100 transition p-1.5 rounded-full ${out ? "order-2" : ""}`}
                  style={{ background: t.surface2, color: t.textMute }} title="Ответить">
                  <Icon name="Reply" size={13} />
                </button>
              )}
              <div className="max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-2"
                style={{
                  background: out ? t.accent + "22" : t.surface2,
                  border: `1px solid ${out ? t.accent + "40" : t.border}`,
                }}>
                {/* Заголовок: канал */}
                <div className="flex items-center gap-1 mb-1">
                  <Icon name={meta.icon} size={11} style={{ color: meta.color }} />
                  <span className="text-[10px] font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                </div>

                {/* Цитата сообщения, на которое отвечаем */}
                {quoted && (
                  <div className="mb-1.5 pl-2 py-1 rounded-md text-[11px] truncate"
                    style={{ borderLeft: `2px solid ${t.accent}`, background: t.bg + "55", color: t.textMute }}>
                    {quoted.text || (attachmentsOf(quoted.attachments).length ? "Вложение" : "Сообщение")}
                  </div>
                )}

                {/* Звонок */}
                {isCall ? (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon name={callMeta(tt.status, out).icon} size={13} style={{ color: callMeta(tt.status, out).color }} />
                      <span className="text-xs font-medium" style={{ color: callMeta(tt.status, out).color }}>
                        {callMeta(tt.status, out).label}
                        {tt.duration_sec ? ` · ${fmtDuration(tt.duration_sec)}` : ""}
                      </span>
                      {tt.status === "transcribing" && (
                        <span className="text-[10px]" style={{ color: t.textMute }}>расшифровка…</span>
                      )}
                      {tt.answered_by === "voicemail" && (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: "#f59e0b22", color: "#f59e0b" }}>
                          <Icon name="Voicemail" size={10} /> Автоответчик
                        </span>
                      )}
                      {tt.answered_by === "human" && (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: "#22c55e22", color: "#22c55e" }}>
                          <Icon name="User" size={10} /> Ответил человек
                        </span>
                      )}
                    </div>
                    {tt.audio_url && (
                      <audio controls src={tt.audio_url} className="w-full h-8 mb-1" style={{ maxWidth: 260 }} />
                    )}
                    {tt.text && (
                      <>
                        <div className="text-xs whitespace-pre-wrap" style={{ color: t.textSub }}>
                          {expanded[tt.id] ? tt.text : tt.text.slice(0, 120) + (tt.text.length > 120 ? "…" : "")}
                        </div>
                        {tt.text.length > 120 && (
                          <button onClick={() => setExpanded(e => ({ ...e, [tt.id]: !e[tt.id] }))}
                            className="text-[10px] mt-1 font-semibold" style={{ color: t.accentLight }}>
                            {expanded[tt.id] ? "Свернуть" : "Показать транскрипт"}
                          </button>
                        )}
                      </>
                    )}
                    <div className="text-right mt-1">
                      <span className="text-[10px]" style={{ color: t.textMute }}>{fmtTime(tt.created_at)}</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Картинки из переписки (например, фото объекта от клиента) */}
                    {imagesOf(tt.attachments).map((src, i) => (
                      <a key={i} href={src} target="_blank" rel="noreferrer" className="block mb-1.5">
                        <img src={src} alt="Вложение" loading="lazy"
                          className="rounded-lg max-w-full object-cover"
                          style={{ maxHeight: 260, border: `1px solid ${t.border}` }} />
                      </a>
                    ))}
                    {/* Голосовые сообщения и обычные файлы */}
                    {nonImageAttachments.map((a, i) => a.type === "voice" ? (
                      <div key={i} className="mb-1.5 flex items-center gap-2">
                        <audio controls src={a.url} className="h-8" style={{ maxWidth: 220 }} />
                      </div>
                    ) : (
                      <a key={i} href={a.url} target="_blank" rel="noreferrer"
                        className="mb-1.5 flex items-center gap-2 rounded-lg px-2.5 py-2 transition hover:brightness-110"
                        style={{ background: t.bg + "55", border: `1px solid ${t.border}` }}>
                        <Icon name="FileText" size={16} style={{ color: t.accentLight }} />
                        <span className="text-xs truncate" style={{ color: t.textSub }}>{a.filename || "Файл"}</span>
                      </a>
                    ))}
                    {(tt.text || !attachmentsOf(tt.attachments).length) && (
                      <div className="text-xs sm:text-sm whitespace-pre-wrap break-words" style={{ color: t.text }}>
                        {tt.text || <span style={{ color: t.textMute }}>(без текста)</span>}
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-1.5 mt-1">
                      {out && tt.status === "pending" && (
                        <span className="text-[10px] flex items-center gap-1" style={{ color: t.textMute }}>
                          <Icon name="Clock" size={10} /> отправляется
                        </span>
                      )}
                      {out && tt.status === "error" && (
                        <span className="text-[10px] flex items-center gap-1" style={{ color: "#ef4444" }}>
                          <Icon name="AlertTriangle" size={10} /> не отправлено
                        </span>
                      )}
                      <span className="text-[10px]" style={{ color: t.textMute }}>{fmtTime(tt.created_at)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
}
