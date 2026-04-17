import { useState, useEffect } from "react";
import { apiFetch } from "./api";

interface Props { token: string; }

export default function TabPrompt({ token }: Props) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    apiFetch("prompt").then(r => r.ok && r.json().then(d => setContent(d.content)));
  }, []);

  const save = async () => {
    setSaving(true); setMsg("");
    const r = await apiFetch("prompt", { method: "PUT", body: JSON.stringify({ content }) }, token);
    setMsg(r.ok ? "Сохранено!" : "Ошибка сохранения");
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-white/50 text-sm">Главная инструкция для AI — определяет как бот считает сметы, что говорит и как себя ведёт.</p>
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        rows={30}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono resize-y outline-none focus:border-violet-500 transition"
      />
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg px-6 py-2 font-medium transition">
          {saving ? "Сохраняю..." : "Сохранить"}
        </button>
        {msg && <span className={`text-sm ${msg.includes("Ошибка") ? "text-red-400" : "text-green-400"}`}>{msg}</span>}
      </div>
    </div>
  );
}
