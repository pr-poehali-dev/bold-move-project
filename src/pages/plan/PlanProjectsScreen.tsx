import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { PlanProject, usePlanProjects } from "./usePlanProjects";

interface Props {
  token?: string | null;
  onSelectProject: (project: PlanProject) => void;
}

const STATUS_LABELS: Record<string, string> = {
  draft:    "Черновик",
  active:   "Активный",
  done:     "Завершён",
};

interface FormData {
  name: string;
  client_name: string;
  address: string;
  phone: string;
}

const EMPTY_FORM: FormData = { name: "", client_name: "", address: "", phone: "" };

export default function PlanProjectsScreen({ token, onSelectProject }: Props) {
  const { projects, loading, loadProjects, createProject } = usePlanProjects(token);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const handleCreate = async () => {
    if (!form.name.trim()) { setError("Введите название проекта"); return; }
    setSaving(true);
    setError("");
    try {
      const id = await createProject({
        name: form.name.trim(),
        client_name: form.client_name.trim() || undefined,
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
      });
      await loadProjects();
      setShowForm(false);
      setForm(EMPTY_FORM);
      // Сразу открываем созданный проект
      const created = { id, name: form.name.trim(), client_name: form.client_name || null, address: form.address || null, phone: form.phone || null, company_id: 0, status: "draft", created_at: "", updated_at: "" };
      onSelectProject(created as PlanProject);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#07070f" }}>
      {/* Шапка */}
      <div className="flex items-center justify-between px-4 sm:px-8 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}>
            <Icon name="Layers" size={16} className="text-white" />
          </div>
          <span className="text-white font-bold text-lg">Проекты</span>
        </div>
        <button
          onClick={() => { setShowForm(true); setForm(EMPTY_FORM); setError(""); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition hover:opacity-90 active:scale-[0.97]"
          style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff" }}
        >
          <Icon name="Plus" size={15} />
          Новый проект
        </button>
      </div>

      {/* Контент */}
      <div className="flex-1 px-4 sm:px-8 py-6 max-w-3xl mx-auto w-full">

        {/* Форма создания */}
        {showForm && (
          <div className="mb-6 rounded-2xl p-5 space-y-4" style={{ background: "#0e0e1c", border: "1px solid rgba(124,58,237,0.3)" }}>
            <div className="flex items-center justify-between">
              <span className="text-white font-bold text-[15px]">Новый проект</span>
              <button onClick={() => setShowForm(false)} className="text-white/30 hover:text-white/70 transition">
                <Icon name="X" size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-white/40 uppercase tracking-wider font-semibold mb-1.5 block">
                  Название проекта <span className="text-red-400">*</span>
                </label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && handleCreate()}
                  placeholder="Квартира Иванова, 3-к"
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-white/40 uppercase tracking-wider font-semibold mb-1.5 block">Заказчик</label>
                  <input
                    value={form.client_name}
                    onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                    placeholder="Иванов Иван"
                    className="w-full rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                  />
                </div>
                <div>
                  <label className="text-[11px] text-white/40 uppercase tracking-wider font-semibold mb-1.5 block">Телефон</label>
                  <input
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
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
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="ул. Ленина, 5, кв. 12"
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                />
              </div>
            </div>

            {error && <p className="text-red-400 text-[12px]">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 hover:opacity-90"
                style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff" }}
              >
                {saving ? "Создаём..." : "Создать проект"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-xl text-sm transition"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        {/* Список проектов */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          </div>
        )}

        {!loading && projects.filter(p => p.status !== "deleted").length === 0 && !showForm && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(124,58,237,0.12)" }}>
              <Icon name="FolderOpen" size={28} style={{ color: "#7c3aed" }} />
            </div>
            <div className="text-white/60 text-[15px] font-semibold mb-1">Проектов пока нет</div>
            <div className="text-white/30 text-[13px] mb-5">Создайте первый проект чтобы начать</div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff" }}
            >
              <Icon name="Plus" size={15} />
              Создать проект
            </button>
          </div>
        )}

        <div className="space-y-2">
          {projects.filter(p => p.status !== "deleted").map(project => (
            <button
              key={project.id}
              onClick={() => onSelectProject(project)}
              className="w-full text-left rounded-2xl p-4 transition hover:brightness-110 active:scale-[0.99] group"
              style={{ background: "#0e0e1c", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "rgba(124,58,237,0.15)" }}>
                  <Icon name="Building2" size={18} style={{ color: "#a78bfa" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-white font-bold text-[14px] truncate">{project.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold flex-shrink-0"
                      style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa" }}>
                      {STATUS_LABELS[project.status] ?? project.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {project.client_name && (
                      <span className="flex items-center gap-1 text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                        <Icon name="User" size={11} />
                        {project.client_name}
                      </span>
                    )}
                    {project.address && (
                      <span className="flex items-center gap-1 text-[12px] truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
                        <Icon name="MapPin" size={11} />
                        {project.address}
                      </span>
                    )}
                    {project.phone && (
                      <span className="flex items-center gap-1 text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                        <Icon name="Phone" size={11} />
                        {project.phone}
                      </span>
                    )}
                  </div>
                </div>
                <Icon name="ChevronRight" size={16} className="text-white/20 group-hover:text-white/50 transition flex-shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
