import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";
import func2url from "@/../backend/func2url.json";

const NEWS_URL = func2url["news"];

interface NewsItem {
  id: number;
  title: string;
  content: string;
  cover_url: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

// ── Тулбар редактора ────────────────────────────────────────────────────────
function EditorToolbar({ onCommand }: { onCommand: (cmd: string, val?: string) => void }) {
  const btn = (icon: string, cmd: string, title: string, val?: string) => (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onCommand(cmd, val); }}
      className="w-8 h-8 flex items-center justify-center rounded-lg transition hover:bg-white/10 text-white/60 hover:text-white"
    >
      <Icon name={icon} size={14} />
    </button>
  );
  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-white/[0.06] flex-wrap">
      {btn("Bold", "bold", "Жирный")}
      {btn("Italic", "italic", "Курсив")}
      {btn("Underline", "underline", "Подчёркнутый")}
      {btn("Strikethrough", "strikeThrough", "Перечёркнутый")}
      <div className="w-px h-5 bg-white/10 mx-1" />
      {btn("Heading2", "formatBlock", "Заголовок", "h2")}
      {btn("Heading3", "formatBlock", "Подзаголовок", "h3")}
      <div className="w-px h-5 bg-white/10 mx-1" />
      {btn("List", "insertUnorderedList", "Список")}
      {btn("ListOrdered", "insertOrderedList", "Нумерованный список")}
      <div className="w-px h-5 bg-white/10 mx-1" />
      {btn("AlignLeft", "justifyLeft", "По левому краю")}
      {btn("AlignCenter", "justifyCenter", "По центру")}
    </div>
  );
}

// ── Карточка новости (просмотр) ─────────────────────────────────────────────
function NewsCard({ item, isMaster, onEdit, onDelete }: {
  item: NewsItem;
  isMaster: boolean;
  onEdit: (item: NewsItem) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article
      className="rounded-2xl overflow-hidden transition-all"
      style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {item.cover_url && (
        <img src={item.cover_url} alt={item.title}
          className="w-full h-48 object-cover" />
      )}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-white/30">{formatDate(item.created_at)}</span>
            {!item.published && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}>
                Черновик
              </span>
            )}
          </div>
          {isMaster && (
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => onEdit(item)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition">
                <Icon name="Pencil" size={13} />
              </button>
              <button onClick={() => onDelete(item.id)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition">
                <Icon name="Trash2" size={13} />
              </button>
            </div>
          )}
        </div>
        <h2 className="text-[16px] font-black text-white leading-snug mb-2">{item.title}</h2>
        <div
          className={`text-[13px] text-white/60 leading-relaxed news-content ${expanded ? "" : "line-clamp-3"}`}
          dangerouslySetInnerHTML={{ __html: item.content }}
        />
        {item.content.length > 200 && (
          <button onClick={() => setExpanded(v => !v)}
            className="mt-2 text-[12px] font-medium transition"
            style={{ color: "#f97316" }}>
            {expanded ? "Свернуть" : "Читать далее →"}
          </button>
        )}
      </div>
    </article>
  );
}

// ── Форма редактирования ────────────────────────────────────────────────────
function NewsEditor({ item, token, onSave, onCancel }: {
  item: Partial<NewsItem> | null;
  token: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle]         = useState(item?.title ?? "");
  const [coverUrl, setCoverUrl]   = useState(item?.cover_url ?? "");
  const [published, setPublished] = useState(item?.published ?? false);
  const [saving, setSaving]       = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStats, setAiStats]     = useState<Record<string, number> | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = item?.content ?? "";
    }
  }, []);

  const execCmd = useCallback((cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
  }, []);

  const handleAiDraft = async () => {
    setAiLoading(true);
    try {
      const res  = await fetch(`${NEWS_URL}?action=ai_draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Auth-Token": token },
      });
      const data = await res.json();
      if (data.title)   setTitle(data.title);
      if (data.content && editorRef.current) editorRef.current.innerHTML = data.content;
      if (data.stats)   setAiStats(data.stats);
    } catch {
      // ignore
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const content = editorRef.current?.innerHTML ?? "";
    const body = { title, content, cover_url: coverUrl || null, published };
    const isEdit = !!(item?.id);
    const url = isEdit ? `${NEWS_URL}?id=${item!.id}` : NEWS_URL;
    await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", "X-Auth-Token": token },
      body: JSON.stringify(body),
    });
    setSaving(false);
    onSave();
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#0e0e1c", border: "1px solid rgba(249,115,22,0.2)" }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <span className="text-[13px] font-bold text-white">{item?.id ? "Редактировать новость" : "Новая новость"}</span>
        <div className="flex items-center gap-2">
          {/* Кнопка AI */}
          <button
            onClick={handleAiDraft}
            disabled={aiLoading}
            title="Сгенерировать черновик из событий системы"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.2), rgba(249,115,22,0.2))", border: "1px solid rgba(168,85,247,0.35)", color: "#c084fc" }}
          >
            {aiLoading
              ? <Icon name="Loader2" size={13} className="animate-spin" />
              : <Icon name="Sparkles" size={13} />
            }
            {aiLoading ? "Генерирую..." : "AI черновик"}
          </button>
          <button onClick={onCancel} className="text-white/40 hover:text-white transition">
            <Icon name="X" size={16} />
          </button>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3">
        {/* Заголовок */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Заголовок новости..."
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[14px] font-bold text-white placeholder-white/25 outline-none focus:border-orange-500/40"
        />

        {/* URL обложки */}
        <input
          value={coverUrl}
          onChange={e => setCoverUrl(e.target.value)}
          placeholder="URL обложки (необязательно)"
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-[13px] text-white/70 placeholder-white/25 outline-none focus:border-orange-500/40"
        />
        {coverUrl && (
          <img src={coverUrl} alt="" className="w-full h-40 object-cover rounded-xl" onError={e => (e.currentTarget.style.display = "none")} />
        )}

        {/* Редактор */}
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <EditorToolbar onCommand={execCmd} />
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className="min-h-[160px] p-3 text-[13px] text-white/80 leading-relaxed outline-none news-content"
            style={{ background: "rgba(255,255,255,0.02)" }}
            data-placeholder="Текст новости..."
          />
        </div>

        {/* Блок статистики после AI-генерации */}
        {aiStats && (
          <div className="rounded-xl p-3 flex flex-wrap gap-3"
            style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)" }}>
            <span className="text-[10px] font-bold w-full" style={{ color: "#c084fc" }}>
              ✦ Данные за 7 дней (использованы для черновика)
            </span>
            {[
              ["Новых заявок", aiStats.new_chats],
              ["Новых смет", aiStats.new_estimates],
              ["Обновлено цен", aiStats.updated_prices],
              ["Всего заявок", aiStats.total_chats],
            ].map(([label, val]) => (
              <div key={label} className="flex flex-col">
                <span className="text-[15px] font-black text-white">{val}</span>
                <span className="text-[10px] text-white/40">{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Публикация + кнопки */}
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setPublished(v => !v)}
              className="w-9 h-5 rounded-full transition-all relative"
              style={{ background: published ? "#f97316" : "rgba(255,255,255,0.1)" }}>
              <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow"
                style={{ left: published ? "18px" : "2px" }} />
            </div>
            <span className="text-[12px] text-white/50">Опубликовать</span>
          </label>
          <div className="flex items-center gap-2">
            <button onClick={onCancel}
              className="px-3 py-1.5 rounded-xl text-[12px] text-white/40 hover:text-white/70 transition">
              Отмена
            </button>
            <button onClick={handleSave} disabled={saving || !title.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[12px] font-bold transition disabled:opacity-50"
              style={{ background: "#f97316", color: "#fff" }}>
              {saving ? <Icon name="Loader2" size={13} className="animate-spin" /> : <Icon name="Check" size={13} />}
              {saving ? "Сохраняю..." : "Сохранить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Главная страница новостей ────────────────────────────────────────────────
export default function NewsPage() {
  const { user, token } = useAuth();
  const isMaster = !!(user?.is_master);

  const [items, setItems]       = useState<NewsItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState<Partial<NewsItem> | null | false>(false);

  const load = useCallback(async () => {
    setLoading(true);
    const url = isMaster ? `${NEWS_URL}?all=1` : NEWS_URL;
    const res = await fetch(url, {
      headers: token ? { "X-Auth-Token": token } : {},
    });
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }, [isMaster, token]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить новость?")) return;
    await fetch(`${NEWS_URL}?id=${id}`, {
      method: "DELETE",
      headers: { "X-Auth-Token": token ?? "" },
    });
    load();
  };

  return (
    <div className="min-h-screen bg-[#0b0b11] text-white font-rubik">
      {/* Хедер */}
      <header className="sticky top-0 z-20 h-12 flex items-center px-4 md:px-8 border-b border-white/[0.05] bg-[#0d0d14]/90 backdrop-blur-xl">
        <button onClick={() => window.history.back()}
          className="flex items-center gap-1.5 text-white/40 hover:text-white/80 transition mr-3">
          <Icon name="ArrowLeft" size={16} />
        </button>
        <div className="flex items-center gap-2">
          <Icon name="Newspaper" size={15} style={{ color: "#f97316" }} />
          <span className="font-black text-[14px]">Новости</span>
        </div>
        {isMaster && (
          <button
            onClick={() => setEditing({})}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold transition"
            style={{ background: "rgba(249,115,22,0.15)", color: "#f97316", border: "1px solid rgba(249,115,22,0.25)" }}>
            <Icon name="Plus" size={13} />
            Новая новость
          </button>
        )}
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4">
        {/* Редактор (новая или существующая) */}
        {editing !== false && (
          <NewsEditor
            item={editing || null}
            token={token ?? ""}
            onSave={() => { setEditing(false); load(); }}
            onCancel={() => setEditing(false)}
          />
        )}

        {/* Список */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-white/30">
            <Icon name="Loader2" size={24} className="animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(249,115,22,0.1)" }}>
              <Icon name="Newspaper" size={22} style={{ color: "#f97316" }} />
            </div>
            <div className="text-[14px] font-bold text-white/50">Новостей пока нет</div>
            <div className="text-[12px] text-white/30">Мы активно развиваем эко-систему — следи за обновлениями</div>
          </div>
        ) : (
          items.map(item => (
            <NewsCard
              key={item.id}
              item={item}
              isMaster={isMaster}
              onEdit={it => setEditing(it)}
              onDelete={handleDelete}
            />
          ))
        )}

        {/* Футер-подпись */}
        {!loading && (
          <div className="text-center py-4">
            <span className="text-[11px] text-white/20">AI-potolki · Экосистема для натяжных потолков</span>
          </div>
        )}
      </div>

      <style>{`
        .news-content h2 { font-size: 1.1rem; font-weight: 800; color: white; margin: 1rem 0 0.4rem; }
        .news-content h3 { font-size: 0.95rem; font-weight: 700; color: rgba(255,255,255,0.8); margin: 0.8rem 0 0.3rem; }
        .news-content p  { margin: 0.4rem 0; }
        .news-content ul { list-style: disc; padding-left: 1.3rem; margin: 0.4rem 0; }
        .news-content ol { list-style: decimal; padding-left: 1.3rem; margin: 0.4rem 0; }
        .news-content li { margin: 0.2rem 0; }
        .news-content b, .news-content strong { color: white; font-weight: 700; }
        .news-content u  { text-decoration: underline; }
        .news-content s, .news-content strike { text-decoration: line-through; }
        [contenteditable]:empty:before { content: attr(data-placeholder); color: rgba(255,255,255,0.2); pointer-events: none; }
      `}</style>
    </div>
  );
}