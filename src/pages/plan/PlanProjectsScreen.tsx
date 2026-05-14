import { useEffect, useState, useMemo } from "react";
import Icon from "@/components/ui/icon";
import { PlanProject, usePlanProjects } from "./usePlanProjects";
import PlanExportModal from "./PlanExportMenu";
import PlanMaterialsScreen from "./PlanMaterialsScreen";

interface Props {
  token?: string | null;
  onSelectProject: (project: PlanProject) => void;
}

const STATUSES = [
  { id: "all",       label: "Все" },
  { id: "draft",     label: "Черновик" },
  { id: "estimate",  label: "Предрасчёт ознакомлен" },
  { id: "contract",  label: "Договор заключён" },
  { id: "scheduled", label: "Монтаж запланирован" },
  { id: "installed", label: "Монтаж завершён" },
  { id: "done",      label: "Завершён" },
];

const STATUS_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  draft:     { bg: "rgba(148,163,184,0.15)",  text: "#94a3b8", glow: "rgba(148,163,184,0.3)" },
  estimate:  { bg: "rgba(251,191,36,0.18)",   text: "#fbbf24", glow: "rgba(251,191,36,0.4)" },
  contract:  { bg: "rgba(59,130,246,0.18)",   text: "#60a5fa", glow: "rgba(59,130,246,0.4)" },
  scheduled: { bg: "rgba(249,115,22,0.18)",   text: "#fb923c", glow: "rgba(249,115,22,0.4)" },
  installed: { bg: "rgba(34,197,94,0.18)",    text: "#4ade80", glow: "rgba(34,197,94,0.4)" },
  done:      { bg: "rgba(99,102,241,0.18)",   text: "#818cf8", glow: "rgba(99,102,241,0.4)" },
};

interface FormData {
  name: string;
  client_name: string;
  address: string;
  phone: string;
  status: string;
}

const EMPTY_FORM: FormData = { name: "", client_name: "", address: "", phone: "", status: "draft" };

function ProjectForm({
  title, form, setForm, onSubmit, onCancel, saving, error, submitLabel,
}: {
  title: string;
  form: FormData;
  setForm: (f: FormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
  submitLabel: string;
}) {
  return (
    <div className="mb-5 rounded-2xl p-5 space-y-4" style={{ background: "#0e0e1c", border: "1px solid rgba(124,58,237,0.3)" }}>
      <div className="flex items-center justify-between">
        <span className="text-white font-bold text-[15px]">{title}</span>
        <button onClick={onCancel} className="text-white/30 hover:text-white/70 transition">
          <Icon name="X" size={16} />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[11px] text-white/40 uppercase tracking-wider font-semibold mb-1.5 block">
            Название <span className="text-red-400">*</span>
          </label>
          <input
            autoFocus
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            onKeyDown={e => e.key === "Enter" && onSubmit()}
            placeholder="Квартира Иванова, 3-к"
            className="w-full rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-white/40 uppercase tracking-wider font-semibold mb-1.5 block">Заказчик</label>
            <input
              value={form.client_name}
              onChange={e => setForm({ ...form, client_name: e.target.value })}
              placeholder="Иванов Иван"
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
            />
          </div>
          <div>
            <label className="text-[11px] text-white/40 uppercase tracking-wider font-semibold mb-1.5 block">Телефон</label>
            <input
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              onFocus={e => { if (!e.target.value) setForm({ ...form, phone: "+7 " }); }}
              placeholder="+7 (___) ___-__-__"
              type="tel"
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
            />
          </div>
        </div>

        <div>
          <label className="text-[11px] text-white/40 uppercase tracking-wider font-semibold mb-1.5 block">Адрес объекта</label>
          <input
            value={form.address}
            onChange={e => setForm({ ...form, address: e.target.value })}
            placeholder="ул. Ленина, 5, кв. 12"
            className="w-full rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
          />
        </div>

        <div>
          <label className="text-[11px] text-white/40 uppercase tracking-wider font-semibold mb-1.5 block">Статус</label>
          <div className="grid grid-cols-3 gap-1.5">
            {STATUSES.filter(s => s.id !== "all").map(s => (
              <button
                key={s.id}
                onClick={() => setForm({ ...form, status: s.id })}
                className="py-2 px-2 rounded-xl text-[11px] font-semibold transition text-center leading-tight"
                style={{
                  background: form.status === s.id ? (STATUS_COLORS[s.id]?.bg ?? "rgba(255,255,255,0.07)") : "rgba(255,255,255,0.04)",
                  color: form.status === s.id ? (STATUS_COLORS[s.id]?.text ?? "#fff") : "rgba(255,255,255,0.35)",
                  border: `1px solid ${form.status === s.id ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)"}`,
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="text-red-400 text-[12px]">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onSubmit}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff" }}
        >
          {saving ? "Сохраняем..." : submitLabel}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl text-sm transition"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

export default function PlanProjectsScreen({ token, onSelectProject }: Props) {
  const { projects, loading, loadProjects, createProject, updateProject, deleteProject } = usePlanProjects(token);

  const [exportOpen,      setExportOpen]      = useState(false);
  const [exportProject,   setExportProject]   = useState<PlanProject | null>(null);
  const [materialsProject, setMaterialsProject] = useState<PlanProject | null>(null);
  const [showCreate,   setShowCreate]   = useState(false);
  const [editingId,    setEditingId]    = useState<number | null>(null);
  const [deletingId,   setDeletingId]   = useState<number | null>(null);
  const [form,         setForm]         = useState<FormData>(EMPTY_FORM);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState("");
  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // ── Фильтрация ──────────────────────────────────────────────────────────────
  const visible = useMemo(() => {
    const q = search.toLowerCase().trim();
    return projects.filter(p => {
      if (p.status === "deleted") return false;
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.client_name ?? "").toLowerCase().includes(q) ||
        (p.address ?? "").toLowerCase().includes(q) ||
        (p.phone ?? "").toLowerCase().includes(q)
      );
    });
  }, [projects, search, filterStatus]);

  // ── Создать ─────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.name.trim()) { setError("Введите название проекта"); return; }
    setSaving(true); setError("");
    try {
      const id = await createProject({
        name: form.name.trim(),
        client_name: form.client_name.trim() || undefined,
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
      });
      await loadProjects();
      setShowCreate(false);
      setForm(EMPTY_FORM);
      const created: PlanProject = {
        id, name: form.name.trim(),
        client_name: form.client_name || null,
        address: form.address || null,
        phone: form.phone || null,
        company_id: 0, status: "draft",
        created_at: "", updated_at: "",
      };
      onSelectProject(created);
    } finally { setSaving(false); }
  };

  // ── Редактировать ────────────────────────────────────────────────────────────
  const startEdit = (p: PlanProject) => {
    setEditingId(p.id);
    setForm({ name: p.name, client_name: p.client_name ?? "", address: p.address ?? "", phone: p.phone ?? "", status: p.status });
    setError("");
    setShowCreate(false);
  };

  const handleUpdate = async () => {
    if (!form.name.trim()) { setError("Введите название проекта"); return; }
    if (!editingId) return;
    setSaving(true); setError("");
    try {
      await updateProject(editingId, {
        name: form.name.trim(),
        client_name: form.client_name.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        status: form.status,
      });
      await loadProjects();
      setEditingId(null);
    } finally { setSaving(false); }
  };

  // ── Удалить ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteProject(id);
      await loadProjects();
    } finally { setDeletingId(null); }
  };

  if (materialsProject) {
    return (
      <PlanMaterialsScreen
        project={materialsProject}
        token={token}
        onBack={() => setMaterialsProject(null)}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#07070f" }}>

      {/* Шапка */}
      <div className="flex items-center justify-between px-4 sm:px-8 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}>
            <Icon name="Layers2" size={16} className="text-white" />
          </div>
          <span className="text-white font-bold text-lg">Проекты</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowCreate(true); setEditingId(null); setForm(EMPTY_FORM); setError(""); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition hover:opacity-90 active:scale-[0.97]"
            style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff" }}
          >
            <Icon name="Plus" size={15} />
            Новый проект
          </button>
        </div>
      </div>

      <PlanExportModal
        open={exportOpen}
        onClose={() => { setExportOpen(false); setExportProject(null); }}
        onExport={cfg => { console.log("export", cfg, exportProject); }}
        showScope={true}
      />

      {/* Контент */}
      <div className="flex-1 px-4 sm:px-8 py-5 max-w-3xl mx-auto w-full">

        {/* Форма создания */}
        {showCreate && (
          <ProjectForm
            title="Новый проект"
            form={form}
            setForm={setForm}
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
            saving={saving}
            error={error}
            submitLabel="Создать проект"
          />
        )}

        {/* Поиск + фильтр */}
        {!showCreate && (
          <div className="flex flex-col gap-3 mb-5">
            {/* Поиск */}
            <div className="relative">
              <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "rgba(255,255,255,0.3)" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск по имени, адресу, телефону..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm text-white focus:outline-none transition"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition">
                  <Icon name="X" size={13} />
                </button>
              )}
            </div>
            {/* Фильтр по статусу — скролл на мобиле, flex-wrap на ПК */}
            <div className="flex gap-1.5 overflow-x-auto sm:overflow-visible sm:flex-wrap" style={{ scrollbarWidth: "none" }}>
              {STATUSES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setFilterStatus(s.id)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition whitespace-nowrap shrink-0 sm:shrink"
                  style={{
                    background: filterStatus === s.id
                      ? (s.id === "all" ? "rgba(255,255,255,0.15)" : (STATUS_COLORS[s.id]?.bg ?? "rgba(255,255,255,0.1)"))
                      : "rgba(255,255,255,0.05)",
                    color: filterStatus === s.id
                      ? (s.id === "all" ? "#fff" : (STATUS_COLORS[s.id]?.text ?? "#fff"))
                      : "rgba(255,255,255,0.65)",
                    border: `1px solid ${filterStatus === s.id ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Загрузка */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          </div>
        )}

        {/* Пусто */}
        {!loading && projects.filter(p => p.status !== "deleted").length === 0 && !showCreate && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(124,58,237,0.12)" }}>
              <Icon name="FolderOpen" size={28} style={{ color: "#7c3aed" }} />
            </div>
            <div className="text-white/60 text-[15px] font-semibold mb-1">Проектов пока нет</div>
            <div className="text-white/30 text-[13px] mb-5">Создайте первый проект чтобы начать</div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff" }}
            >
              <Icon name="Plus" size={15} />
              Создать проект
            </button>
          </div>
        )}

        {/* Пусто после фильтра */}
        {!loading && projects.filter(p => p.status !== "deleted").length > 0 && visible.length === 0 && (
          <div className="flex flex-col items-center py-14 text-center">
            <Icon name="SearchX" size={28} style={{ color: "rgba(255,255,255,0.2)" }} />
            <div className="text-white/40 text-[14px] mt-3">Ничего не найдено</div>
          </div>
        )}

        {/* Список проектов */}
        <div className="space-y-2">
          {visible.map(project => {
            const sc = STATUS_COLORS[project.status] ?? STATUS_COLORS.draft;
            const isEditing = editingId === project.id;
            const isDeleting = deletingId === project.id;

            if (isEditing) {
              return (
                <div key={project.id}>
                  <ProjectForm
                    title={`Редактировать: ${project.name}`}
                    form={form}
                    setForm={setForm}
                    onSubmit={handleUpdate}
                    onCancel={() => setEditingId(null)}
                    saving={saving}
                    error={error}
                    submitLabel="Сохранить"
                  />
                </div>
              );
            }

            return (
              <div
                key={project.id}
                className="rounded-2xl overflow-hidden transition group flex"
                style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                {/* Статус — вертикальная полоска слева */}
                <div className="flex-shrink-0 flex items-center justify-center w-12 self-stretch px-1"
                  style={{ background: `linear-gradient(to right, ${sc.glow ?? sc.bg}, transparent)` }}>
                  <span className="font-bold uppercase whitespace-nowrap select-none"
                    style={{ color: sc.text, writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 10, letterSpacing: "0.1em" }}>
                    {STATUSES.find(s => s.id === project.status)?.label ?? project.status}
                  </span>
                </div>

                {/* Правая часть */}
                <div className="flex-1 min-w-0">
                {/* Основная строка */}
                <div className="px-4 py-3.5 flex items-center gap-3">
                  <button
                    className="flex items-start gap-3 flex-1 min-w-0 text-left hover:opacity-90 transition active:scale-[0.99]"
                    onClick={() => onSelectProject(project)}
                  >
                    {/* Данные */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-bold text-[14px] truncate">{project.name}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {project.client_name && (
                          <span className="flex items-center gap-1 text-[12px]" style={{ color: "rgba(255,255,255,0.75)" }}>
                            <Icon name="User" size={11} />
                            {project.client_name}
                          </span>
                        )}
                        {project.address && (
                          <span className="flex items-center gap-1 text-[12px]" style={{ color: "rgba(255,255,255,0.75)" }}>
                            <Icon name="MapPin" size={11} />
                            {project.address}
                          </span>
                        )}
                        {project.phone && (
                          <span className="flex items-center gap-1 text-[12px]" style={{ color: "rgba(255,255,255,0.75)" }}>
                            <Icon name="Phone" size={11} />
                            {project.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Две кнопки справа */}
                  <div className="flex-shrink-0 flex flex-col gap-1.5">
                    {/* Скачать смету */}
                    <button
                      onClick={() => { setExportProject(project); setExportOpen(true); }}
                      className="flex flex-col items-center justify-center gap-1 rounded-xl transition hover:brightness-110 active:scale-95"
                      style={{ width: 64, height: 52, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                      title="Скачать смету"
                    >
                      <Icon name="FileDown" size={18} style={{ color: "rgba(255,255,255,0.8)" }} />
                      <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.55)" }}>Смета</span>
                    </button>
                    {/* Материалы */}
                    <button
                      onClick={() => setMaterialsProject(project)}
                      className="flex flex-col items-center justify-center gap-1 rounded-xl transition hover:brightness-110 active:scale-95"
                      style={{ width: 64, height: 52, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                      title="Материалы"
                    >
                      <Icon name="ClipboardList" size={18} style={{ color: "rgba(255,255,255,0.8)" }} />
                      <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.55)" }}>Состав</span>
                    </button>
                  </div>
                </div>

                {/* Кнопки действий */}
                <div className="flex border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  <button
                    onClick={() => startEdit(project)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-semibold transition hover:bg-white/[0.04]"
                    style={{ color: "rgba(255,255,255,0.55)" }}
                  >
                    Редактировать
                  </button>
                  <div className="w-px" style={{ background: "rgba(255,255,255,0.05)" }} />
                  <button
                    onClick={() => handleDelete(project.id)}
                    disabled={isDeleting}
                    className="flex items-center justify-center gap-1.5 px-5 py-2.5 text-[12px] font-semibold transition hover:bg-red-500/10 disabled:opacity-50"
                    style={{ color: "rgba(239,68,68,0.6)" }}
                  >
                    {isDeleting
                      ? <div className="w-3.5 h-3.5 border border-red-400/40 border-t-red-400 rounded-full animate-spin" />
                      : <Icon name="Trash2" size={13} />
                    }
                    {isDeleting ? "..." : "Удалить"}
                  </button>
                </div>
                </div>{/* /правая часть */}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}