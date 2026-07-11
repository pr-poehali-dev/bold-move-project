import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { crmFetch, uploadFile } from "@/pages/admin/crm/crmApi";
import func2url from "@/../backend/func2url.json";

const TRANSCRIBE_URL = (func2url as Record<string, string>)["deepgram-transcribe"];
const WHISPER_URL = (func2url as Record<string, string>)["whisper-transcribe"];

// ── Справочники ────────────────────────────────────────────────────────────
export const SEVERITY = [
  { id: "critical",  label: "Критично", color: "#ef4444", icon: "AlertOctagon" },
  { id: "important", label: "Важно",    color: "#f59e0b", icon: "AlertTriangle" },
  { id: "normal",    label: "Обычное",  color: "#3b82f6", icon: "Info" },
  { id: "idea",      label: "Идея",     color: "#10b981", icon: "Lightbulb" },
];

export const REPORT_TYPE = [
  { id: "bug",         label: "Ошибка",     icon: "Bug" },
  { id: "improvement", label: "Доработка",  icon: "Wrench" },
  { id: "idea",        label: "Идея",       icon: "Sparkles" },
];

export const STATUS = [
  { id: "new",         label: "Новый",       color: "#3b82f6", masterOnly: false },
  { id: "in_progress", label: "В работе",    color: "#f59e0b", masterOnly: true },
  { id: "done",        label: "Выполнен",    color: "#10b981", masterOnly: true },
  { id: "rejected",    label: "Не выполнен", color: "#ef4444", masterOnly: true },
];

const sevById = (id: string) => SEVERITY.find(s => s.id === id) ?? SEVERITY[2];
const typeById = (id: string) => REPORT_TYPE.find(t => t.id === id) ?? REPORT_TYPE[0];
const statusById = (id: string) => STATUS.find(s => s.id === id) ?? STATUS[0];

interface Attachment { url: string; name: string; type: string; }
interface Report {
  id: number;
  title: string;
  description: string;
  severity: string;
  report_type: string;
  status: string;
  attachments: Attachment[];
  author_name: string;
  created_at: string;
}

export default function BugReportPanel() {
  const { user } = useAuth();
  const isMaster = !!user?.is_master;

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const load = () => {
    setLoading(true);
    crmFetch("bug_reports")
      .then((d: any) => {
        setReports(Array.isArray(d?.reports) ? d.reports : []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const changeStatus = (id: number, status: string) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    crmFetch("bug_reports", { method: "PUT", body: JSON.stringify({ id, status }) })
      .catch(() => load());
  };

  const removeReport = (id: number) => {
    if (!confirm("Удалить репорт?")) return;
    setReports(prev => prev.filter(r => r.id !== id));
    crmFetch("bug_reports", { method: "DELETE", body: JSON.stringify({ id }) }).catch(() => load());
  };

  const filtered = filter === "all" ? reports : reports.filter(r => r.status === filter);

  const counts = STATUS.reduce((acc, s) => {
    acc[s.id] = reports.filter(r => r.status === s.id).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Icon name="Bug" size={22} /> Баг-репорт
          </h1>
          <p className="text-sm text-white/50 mt-1">
            Расскажите, что улучшить или исправить — текстом, голосом или скриншотом
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition active:scale-95"
          style={{ background: "#f97316" }}
        >
          <Icon name="Plus" size={16} /> Новый репорт
        </button>
      </div>

      {/* Фильтры по статусам */}
      <div className="flex flex-wrap gap-2 mb-4">
        <FilterChip label="Все" count={reports.length} active={filter === "all"} color="#8b5cf6" onClick={() => setFilter("all")} />
        {STATUS.map(s => (
          <FilterChip key={s.id} label={s.label} count={counts[s.id]} active={filter === s.id} color={s.color} onClick={() => setFilter(s.id)} />
        ))}
      </div>

      {/* Список */}
      {loading ? (
        <div className="text-center py-16 text-white/40 text-sm">Загрузка…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Icon name="Inbox" size={40} className="mx-auto mb-3 text-white/20" />
          <p className="text-white/40 text-sm">Пока нет репортов</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(r => (
            <ReportCard
              key={r.id}
              report={r}
              isMaster={isMaster}
              onStatusChange={changeStatus}
              onRemove={removeReport}
            />
          ))}
        </div>
      )}

      {showForm && (
        <BugReportForm
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); load(); }}
          authorName={user?.name || user?.email || "Аноним"}
        />
      )}
    </div>
  );
}

// ── Чип-фильтр ─────────────────────────────────────────────────────────────
function FilterChip({ label, count, active, color, onClick }: {
  label: string; count: number; active: boolean; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition"
      style={{
        background: active ? color + "22" : "rgba(255,255,255,0.05)",
        border: `1px solid ${active ? color + "55" : "rgba(255,255,255,0.08)"}`,
        color: active ? color : "rgba(255,255,255,0.6)",
      }}
    >
      {label}
      <span className="px-1.5 rounded-full text-[10px]" style={{ background: active ? color + "33" : "rgba(255,255,255,0.08)" }}>
        {count}
      </span>
    </button>
  );
}

// ── Карточка репорта ───────────────────────────────────────────────────────
function ReportCard({ report, isMaster, onStatusChange, onRemove }: {
  report: Report; isMaster: boolean;
  onStatusChange: (id: number, status: string) => void;
  onRemove: (id: number) => void;
}) {
  const sev = sevById(report.severity);
  const typ = typeById(report.report_type);
  const st = statusById(report.status);
  const [statusOpen, setStatusOpen] = useState(false);

  const date = new Date(report.created_at).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${sev.color}22` }}>
      <div className="flex items-start gap-3">
        {/* Иконка важности */}
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: sev.color + "1f" }}>
          <Icon name={sev.icon} size={18} style={{ color: sev.color }} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Бейджи */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold" style={{ background: sev.color + "22", color: sev.color }}>
              {sev.label}
            </span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium flex items-center gap-1" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)" }}>
              <Icon name={typ.icon} size={11} /> {typ.label}
            </span>
          </div>

          {report.title && <div className="text-sm font-semibold text-white mb-0.5">{report.title}</div>}
          <div className="text-sm text-white/70 whitespace-pre-wrap break-words">{report.description}</div>

          {/* Вложения */}
          {report.attachments?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2.5">
              {report.attachments.map((a, i) => (
                a.type?.startsWith("image") ? (
                  <a key={i} href={a.url} target="_blank" rel="noreferrer">
                    <img src={a.url} alt={a.name} className="w-16 h-16 object-cover rounded-lg border border-white/10" />
                  </a>
                ) : (
                  <a key={i} href={a.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs text-white/70"
                    style={{ background: "rgba(255,255,255,0.06)" }}>
                    <Icon name="Paperclip" size={13} /> {a.name}
                  </a>
                )
              ))}
            </div>
          )}

          {/* Футер */}
          <div className="flex items-center gap-2 mt-3 text-[11px] text-white/40">
            <Icon name="User" size={12} /> {report.author_name || "Аноним"}
            <span>·</span>
            <Icon name="Clock" size={12} /> {date}
          </div>
        </div>

        {/* Статус + управление */}
        <div className="flex-shrink-0 flex flex-col items-end gap-2 relative">
          <button
            onClick={() => setStatusOpen(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition"
            style={{ background: st.color + "22", color: st.color, border: `1px solid ${st.color}44` }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: st.color }} />
            {st.label}
            <Icon name="ChevronDown" size={13} />
          </button>

          {statusOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setStatusOpen(false)} />
              <div className="absolute top-9 right-0 z-20 rounded-xl overflow-hidden min-w-[150px]"
                style={{ background: "#1a1a24", border: "1px solid rgba(255,255,255,0.1)" }}>
                {STATUS.map(s => {
                  const locked = s.masterOnly && !isMaster;
                  return (
                    <button
                      key={s.id}
                      disabled={locked}
                      onClick={() => { if (!locked) { onStatusChange(report.id, s.id); setStatusOpen(false); } }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition disabled:opacity-35"
                      style={{ color: s.color, background: report.status === s.id ? s.color + "18" : "transparent" }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                      {s.label}
                      {locked && <Icon name="Lock" size={11} className="ml-auto text-white/30" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {isMaster && (
            <button onClick={() => onRemove(report.id)} className="text-white/25 hover:text-red-400 transition p-1">
              <Icon name="Trash2" size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Форма создания ─────────────────────────────────────────────────────────
function BugReportForm({ onClose, onCreated, authorName }: {
  onClose: () => void; onCreated: () => void; authorName: string;
}) {
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("normal");
  const [reportType, setReportType] = useState("bug");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

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

        {/* Важность */}
        <label className="text-xs font-semibold text-white/50 mb-2 block">Важность</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {SEVERITY.map(s => (
            <button key={s.id} onClick={() => setSeverity(s.id)}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-medium transition"
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
    </div>
  );
}