import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import { crmFetch, uploadFile } from "@/pages/admin/crm/crmApi";
import func2url from "@/../backend/func2url.json";
import { SEVERITY, REPORT_TYPE, type Attachment } from "./bugReportTypes";
import BugReportGuideModal from "./BugReportGuideModal";

const TRANSCRIBE_URL = (func2url as Record<string, string>)["deepgram-transcribe"];
const WHISPER_URL = (func2url as Record<string, string>)["whisper-transcribe"];

// ── Форма создания ─────────────────────────────────────────────────────────
export default function BugReportForm({ onClose, onCreated, authorName }: {
  onClose: () => void; onCreated: () => void; authorName: string;
}) {
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("normal");
  const [reportType, setReportType] = useState("bug");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Голос
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadOne = async (f: File) => {
    setUploading(true);
    try {
      const url = await uploadFile(f);
      setAttachments(prev => [...prev, { url, name: f.name, type: f.type }]);
    } finally {
      setUploading(false);
    }
  };

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    for (const f of files) await uploadOne(f);
    if (fileRef.current) fileRef.current.value = "";
  };

  // Вставка скриншота из буфера обмена (Ctrl+V)
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imgItem = items.find(it => it.type.startsWith("image"));
    if (!imgItem) return;
    const blob = imgItem.getAsFile();
    if (!blob) return;
    e.preventDefault();
    const ext = (blob.type.split("/")[1] || "png").split("+")[0];
    const named = new File([blob], `screenshot-${Date.now()}.${ext}`, { type: blob.type });
    await uploadOne(named);
  };

  const transcribeBlob = async (blob: Blob) => {
    if (blob.size === 0) { setVoiceError("Пустая запись"); return; }
    setIsTranscribing(true);
    try {
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const b64 = btoa(bin);
      let data: { text?: string; error?: string } = {};
      let res = await fetch(TRANSCRIBE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: b64, mimeType: blob.type || "audio/mp4" }),
      });
      data = await res.json();
      if (!data.text && res.status !== 200) {
        res = await fetch(WHISPER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio: b64, mimeType: blob.type || "audio/mp4" }),
        });
        data = await res.json();
      }
      if (data.text) setDescription(prev => (prev.trim() + " " + data.text).trim());
      else if (data.error) setVoiceError(`Ошибка: ${data.error}`);
    } catch {
      setVoiceError("Ошибка распознавания");
    } finally {
      setIsTranscribing(false);
    }
  };

  const startRecording = async () => {
    setVoiceError("");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setVoiceError("Нет доступа к микрофону");
      return;
    }
    const formats = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg", ""];
    const mimeType = formats.find(m => m === "" || MediaRecorder.isTypeSupported(m)) ?? "";
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunksRef.current, { type: mimeType || "audio/mp4" });
      transcribeBlob(blob);
    };
    recorderRef.current = recorder;
    recorder.start(500);
    setIsRecording(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setIsRecording(false);
  };

  const submit = async () => {
    if (!description.trim()) { setVoiceError("Опишите проблему"); return; }
    setSaving(true);
    try {
      await crmFetch("bug_reports", {
        method: "POST",
        body: JSON.stringify({
          description: description.trim(),
          severity, report_type: reportType,
          attachments, author_name: authorName,
        }),
      });
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
        style={{ background: "#14141c", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={e => e.stopPropagation()}
        onPaste={handlePaste}>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Icon name="Bug" size={20} /> Новый репорт
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition">
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* Приглашение прочитать инструкцию — на видном месте */}
        <button
          onClick={() => setShowGuide(true)}
          className="w-full flex items-center gap-2.5 rounded-xl px-3.5 py-3 mb-4 text-left transition hover:brightness-110"
          style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.4)" }}
        >
          <Icon name="GraduationCap" size={18} style={{ color: "#fb923c" }} className="flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold" style={{ color: "#fb923c" }}>Как правильно составить репорт?</div>
            <div className="text-[11px] text-white/50">Нажми, чтобы увидеть пример хорошего описания — так проблему исправят быстрее</div>
          </div>
          <Icon name="ChevronRight" size={16} style={{ color: "#fb923c" }} className="flex-shrink-0" />
        </button>

        {/* Важность */}
        <label className="text-xs font-semibold text-white/50 mb-2 block">Важность</label>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {SEVERITY.map(s => (
            <button key={s.id} onClick={() => setSeverity(s.id)}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-medium transition"
              style={{
                background: severity === s.id ? s.color + "22" : "rgba(255,255,255,0.05)",
                border: `1px solid ${severity === s.id ? s.color + "66" : "rgba(255,255,255,0.08)"}`,
                color: severity === s.id ? s.color : "rgba(255,255,255,0.6)",
              }}>
              <Icon name={s.icon} size={14} /> {s.label}
            </button>
          ))}
        </div>

        {/* Тип */}
        <label className="text-xs font-semibold text-white/50 mb-2 block">Тип</label>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {REPORT_TYPE.map(t => (
            <button key={t.id} onClick={() => setReportType(t.id)}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-medium transition"
              style={{
                background: reportType === t.id ? "rgba(249,115,22,0.2)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${reportType === t.id ? "rgba(249,115,22,0.5)" : "rgba(255,255,255,0.08)"}`,
                color: reportType === t.id ? "#fb923c" : "rgba(255,255,255,0.6)",
              }}>
              <Icon name={t.icon} size={14} /> {t.label}
            </button>
          ))}
        </div>

        {/* Описание + голос */}
        <label className="text-xs font-semibold text-white/50 mb-2 block">Что случилось?</label>
        <div className="relative mb-2">
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Опишите проблему или пожелание…"
            rows={4}
            className="w-full rounded-xl px-3 py-2.5 pr-12 text-sm text-white resize-none outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isTranscribing}
            title={isRecording ? "Остановить" : "Записать голосом"}
            className="absolute right-2.5 top-2.5 w-8 h-8 rounded-lg flex items-center justify-center transition disabled:opacity-50"
            style={{
              background: isRecording ? "#ef4444" : "rgba(249,115,22,0.2)",
              color: isRecording ? "#fff" : "#fb923c",
            }}>
            {isTranscribing
              ? <Icon name="Loader2" size={16} className="animate-spin" />
              : <Icon name={isRecording ? "Square" : "Mic"} size={16} />}
          </button>
        </div>
        {isRecording && <div className="text-xs text-red-400 mb-2 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Идёт запись… нажмите стоп</div>}
        {isTranscribing && <div className="text-xs text-orange-300 mb-2">Распознаю речь…</div>}
        {voiceError && <div className="text-xs text-red-400 mb-2">{voiceError}</div>}

        {/* Вложения */}
        <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt" onChange={handleFiles} style={{ display: "none" }} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition mb-3 disabled:opacity-50"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px dashed rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)" }}>
          {uploading ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="Paperclip" size={16} />}
          {uploading ? "Загрузка…" : "Прикрепить скриншот или файл"}
        </button>
        <div className="flex items-center justify-center gap-1.5 -mt-1 mb-3 text-[11px] text-white/35">
          <Icon name="Clipboard" size={12} />
          или вставьте скриншот из буфера — <kbd className="px-1 rounded bg-white/10 text-white/60">Ctrl</kbd>+<kbd className="px-1 rounded bg-white/10 text-white/60">V</kbd>
        </div>

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {attachments.map((a, i) => (
              <div key={i} className="relative">
                {a.type?.startsWith("image") ? (
                  <img src={a.url} alt={a.name} className="w-16 h-16 object-cover rounded-lg border border-white/10" />
                ) : (
                  <div className="w-16 h-16 rounded-lg flex items-center justify-center text-[9px] text-white/60 text-center p-1 border border-white/10" style={{ background: "rgba(255,255,255,0.06)" }}>
                    {a.name.slice(0, 14)}
                  </div>
                )}
                <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white"
                  style={{ background: "#ef4444" }}>
                  <Icon name="X" size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Кнопки */}
        <div className="flex gap-2 mt-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)" }}>
            Отмена
          </button>
          <button onClick={submit} disabled={saving || uploading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition active:scale-95 disabled:opacity-50"
            style={{ background: "#f97316" }}>
            {saving ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="Send" size={16} />}
            Отправить
          </button>
        </div>
      </div>

      {showGuide && <BugReportGuideModal onClose={() => setShowGuide(false)} />}
    </div>
  );
}