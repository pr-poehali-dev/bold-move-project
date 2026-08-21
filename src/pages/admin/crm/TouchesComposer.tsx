import { RefObject } from "react";
import Icon from "@/components/ui/icon";
import { useTheme } from "./themeContext";
import { Touch, AttachmentItem, MessengerAccount, attachmentsOf } from "./touchesShared";

interface Props {
  sendChannel: string;
  setSendChannel: (v: string) => void;
  /** Линии (аккаунты) Telegram/MAX компании — для ручного выбора отправителя */
  accounts: MessengerAccount[];
  sendAccountId: string;
  setSendAccountId: (v: string) => void;
  draft: string;
  setDraft: (v: string) => void;
  sending: boolean;
  sendError: string | null;
  replyTo: Touch | null;
  setReplyTo: (v: Touch | null) => void;
  pendingAttachment: AttachmentItem | null;
  setPendingAttachment: (v: AttachmentItem | null) => void;
  uploadingFile: boolean;
  isRecording: boolean;
  recSeconds: number;
  fileInputRef: RefObject<HTMLInputElement>;
  textareaRef: RefObject<HTMLTextAreaElement>;
  flashInput: boolean;
  onPickFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStartVoiceRecording: () => void;
  onStopVoiceRecording: () => void;
  onSend: () => void;
}

// Панель отправки сообщения вкладки «Касания»: цитата reply, превью вложения,
// выбор канала, прикрепление файла, запись голоса и сама текстовая область.
export default function TouchesComposer({
  sendChannel, setSendChannel, accounts, sendAccountId, setSendAccountId,
  draft, setDraft, sending, sendError,
  replyTo, setReplyTo, pendingAttachment, setPendingAttachment, uploadingFile,
  isRecording, recSeconds, fileInputRef, textareaRef, flashInput,
  onPickFile, onStartVoiceRecording, onStopVoiceRecording, onSend,
}: Props) {
  const t = useTheme();

  // Линии выбранного канала — селект показываем только если их больше одной
  // (иначе выбирать не из чего, автовыбор backend'а и так справится).
  const channelAccounts = accounts.filter(a => a.channel === sendChannel && a.is_active && a.auth_status === "authorized");

  return (
    <>
      {/* Цитата сообщения, на которое отвечаем */}
      {replyTo && (
        <div className="flex-shrink-0 px-3 sm:px-6 pt-2 flex items-center gap-2">
          <div className="flex-1 min-w-0 flex items-center gap-2 rounded-lg px-2.5 py-1.5"
            style={{ background: t.surface2, borderLeft: `2px solid ${t.accent}` }}>
            <Icon name="Reply" size={13} style={{ color: t.accentLight }} className="flex-shrink-0" />
            <span className="text-[11px] truncate" style={{ color: t.textMute }}>
              {replyTo.text || (attachmentsOf(replyTo.attachments).length ? "Вложение" : "Сообщение")}
            </span>
          </div>
          <button onClick={() => setReplyTo(null)} className="flex-shrink-0 p-1 rounded-full" style={{ color: t.textMute }}>
            <Icon name="X" size={14} />
          </button>
        </div>
      )}

      {/* Превью прикреплённого файла/голоса перед отправкой */}
      {pendingAttachment && (
        <div className="flex-shrink-0 px-3 sm:px-6 pt-2 flex items-center gap-2">
          <div className="flex-1 min-w-0 flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: t.surface2 }}>
            <Icon name={pendingAttachment.type === "voice" ? "Mic" : pendingAttachment.type === "image" ? "Image" : "FileText"}
              size={14} style={{ color: t.accentLight }} className="flex-shrink-0" />
            <span className="text-[11px] truncate" style={{ color: t.textSub }}>
              {pendingAttachment.type === "voice" ? "Голосовое сообщение" : (pendingAttachment.filename || "Файл")}
            </span>
          </div>
          <button onClick={() => setPendingAttachment(null)} className="flex-shrink-0 p-1 rounded-full" style={{ color: t.textMute }}>
            <Icon name="X" size={14} />
          </button>
        </div>
      )}

      {/* Выбор линии — только если у канала подключено больше одной линии */}
      {channelAccounts.length > 1 && (
        <div className="flex-shrink-0 px-3 sm:px-6 pt-2 flex items-center gap-1.5">
          <Icon name="Radio" size={12} style={{ color: t.textMute }} className="flex-shrink-0" />
          <select value={sendAccountId} onChange={e => setSendAccountId(e.target.value)}
            className="text-[11px] rounded-lg px-2 py-1 focus:outline-none"
            style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.textSub }}>
            <option value="">Линия автоматически</option>
            {channelAccounts.map(a => (
              <option key={a.id} value={a.id}>{a.title}</option>
            ))}
          </select>
        </div>
      )}

      {/* Поле ввода */}
      <div className="flex-shrink-0 px-3 sm:px-6 py-3 flex items-end gap-2" style={{ borderTop: `1px solid ${t.border}` }}>
        <select value={sendChannel} onChange={e => setSendChannel(e.target.value)}
          className="text-xs rounded-lg px-2 py-2 focus:outline-none flex-shrink-0"
          style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text }}>
          <option value="telegram">Telegram</option>
          <option value="max">MAX</option>
          <option value="avito">Avito</option>
        </select>

        <input ref={fileInputRef} type="file" className="hidden" onChange={onPickFile} />
        <button onClick={() => fileInputRef.current?.click()}
          disabled={sendChannel === "avito" || uploadingFile || isRecording}
          title={sendChannel === "avito" ? "Avito не поддерживает вложения" : "Прикрепить файл"}
          className="flex-shrink-0 rounded-lg p-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: t.surface2, color: t.textSub }}>
          <Icon name={uploadingFile ? "Loader2" : "Paperclip"} size={16} className={uploadingFile ? "animate-spin" : ""} />
        </button>

        {isRecording ? (
          <button onClick={onStopVoiceRecording}
            className="flex-shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold"
            style={{ background: "#ef444422", color: "#ef4444" }}>
            <Icon name="Square" size={13} /> {Math.floor(recSeconds / 60)}:{String(recSeconds % 60).padStart(2, "0")}
          </button>
        ) : (
          <button onClick={onStartVoiceRecording}
            disabled={sendChannel === "avito" || uploadingFile || !!pendingAttachment}
            title={sendChannel === "avito" ? "Avito не поддерживает вложения" : "Голосовое сообщение"}
            className="flex-shrink-0 rounded-lg p-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: t.surface2, color: t.textSub }}>
            <Icon name="Mic" size={16} />
          </button>
        )}

        <textarea ref={textareaRef} value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
          }}
          rows={1} placeholder="Написать сообщение…"
          className={`flex-1 text-sm rounded-lg px-3 py-2 focus:outline-none resize-none ${flashInput ? "animate-ring-flash-red" : ""}`}
          style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text, maxHeight: 120 }} />
        <button onClick={onSend} disabled={(!draft.trim() && !pendingAttachment) || sending}
          className="flex-shrink-0 rounded-lg px-3 py-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: t.accent, color: "#fff" }}>
          <Icon name={sending ? "Loader" : "Send"} size={16} className={sending ? "animate-spin" : ""} />
        </button>
      </div>
      {sendError && (
        <div className="px-3 sm:px-6 pb-2 text-[11px] flex items-center gap-1" style={{ color: "#ef4444" }}>
          <Icon name="AlertTriangle" size={11} /> {sendError}
        </div>
      )}
    </>
  );
}