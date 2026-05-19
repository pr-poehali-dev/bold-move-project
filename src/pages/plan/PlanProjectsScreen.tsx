import { useEffect, useState, useMemo } from "react";
import Icon from "@/components/ui/icon";
import { PlanProject, usePlanProjects } from "./usePlanProjects";
import PlanExportModal from "./PlanExportMenu";
import PlanMaterialsScreen from "./PlanMaterialsScreen";
import { FormData, EMPTY_FORM } from "./PlanProjectsConstants";
import PlanProjectForm from "./PlanProjectForm";
import PlanProjectsSearchBar from "./PlanProjectsSearchBar";
import PlanProjectCard from "./PlanProjectCard";
import func2url from "@/../backend/func2url.json";

const CRM_URL = (func2url as Record<string, string>)["crm-manager"];

interface Props {
  token?: string | null;
  onSelectProject: (project: PlanProject) => void;
  initialProjectId?: number;
}

export default function PlanProjectsScreen({ token, onSelectProject, initialProjectId }: Props) {
  const { projects, loading, loadProjects, createProject, updateProject, deleteProject, syncWithCrm } = usePlanProjects(token);

  const [exportOpen,       setExportOpen]       = useState(false);
  const [exportProject,    setExportProject]    = useState<PlanProject | null>(null);
  const [materialsProject, setMaterialsProject] = useState<PlanProject | null>(null);
  const [showCreate,       setShowCreate]       = useState(false);
  const [editingId,        setEditingId]        = useState<number | null>(null);
  const [deletingId,       setDeletingId]       = useState<number | null>(null);
  const [form,             setForm]             = useState<FormData>(EMPTY_FORM);
  const [saving,           setSaving]           = useState(false);
  const [error,            setError]            = useState("");
  const [search,           setSearch]           = useState("");
  const [filterStatus,     setFilterStatus]     = useState("all");

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // Автовыбор проекта по initialProjectId (переход из CRM)
  useEffect(() => {
    if (!initialProjectId || loading || projects.length === 0) return;
    const found = projects.find(p => p.id === initialProjectId);
    if (found) onSelectProject(found);
  }, [initialProjectId, projects, loading]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const { id, crm_chat_id } = await createProject({
        name: form.name.trim(),
        client_name: form.client_name.trim() || null,
        address: form.address.trim() || null,
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
        crm_chat_id: crm_chat_id ?? null,
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
      const patch = {
        name: form.name.trim(),
        client_name: form.client_name.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        status: form.status,
      };
      await updateProject(editingId, patch);
      // Синхронизируем изменения в CRM
      syncWithCrm(editingId, patch);
      await loadProjects();
      setEditingId(null);
    } finally { setSaving(false); }
  };

  // ── Перейти в CRM ────────────────────────────────────────────────────────────
  const handleCrm = async (p: PlanProject) => {
    if (p.crm_chat_id) {
      window.open(`/crm?order=${p.crm_chat_id}`, "_blank");
      return;
    }
    // Нет связи — создаём заявку в CRM через пересоздание проекта
    if (!confirm(`Создать заявку в CRM для проекта "${p.name}"?`)) return;
    try {
      const res = await fetch(`${CRM_URL}?r=plan-crm-link&project_id=${p.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.crm_chat_id) {
        await loadProjects();
        window.open(`/crm?order=${data.crm_chat_id}`, "_blank");
      }
    } catch { /* ignore */ }
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
    <div className="h-screen flex flex-col overflow-y-auto" style={{ background: "#07070f" }}>

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
          <PlanProjectForm
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
          <PlanProjectsSearchBar
            search={search}
            setSearch={setSearch}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
          />
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
          {visible.map(project => (
            <PlanProjectCard
              key={project.id}
              project={project}
              editingId={editingId}
              deletingId={deletingId}
              form={form}
              setForm={setForm}
              saving={saving}
              error={error}
              onSelect={onSelectProject}
              onStartEdit={startEdit}
              onCancelEdit={() => setEditingId(null)}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onExport={p => { setExportProject(p); setExportOpen(true); }}
              onMaterials={setMaterialsProject}
              onCrm={handleCrm}
            />
          ))}
        </div>
      </div>
    </div>
  );
}