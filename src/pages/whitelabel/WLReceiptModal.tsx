import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import { AUTH_URL } from "./wlTypes";
import type { DemoPipelineCompany } from "./wlTypes";

interface Props {
  company: DemoPipelineCompany;
  onSuccess: (demoId: number) => void;
  onCancel:  () => void;
}

const masterToken = () => localStorage.getItem("mp_user_token") || "";

export function WLReceiptModal({ company, onSuccess, onCancel }: Props) {
  const [preview, setPreview]   = useState<string | null>(null);
  const [imageB64, setImageB64] = useState<string | null>(null);
  const [imageExt, setImageExt] = useState("jpg");
  const [uploading, setUploading] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Только изображения (JPG, PNG)");
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    setImageExt(ext);
    const reader = new FileReader();
    reader.onload = e => {
      const result = e.target?.result as string;
      setPreview(result);
      // Убираем data:image/...;base64, префикс
      setImageB64(result.split(",")[1]);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSubmit = async () => {
    if (!imageB64) { setError("Прикрепи чек"); return; }
    setUploading(true);
    setError(null);
    try {
      const r = await fetch(`${AUTH_URL}?action=admin-upload-receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Authorization": masterToken() },
        body: JSON.stringify({
          demo_id:      company.demo_id,
          company_id:   company.company_id,
          company_name: company.company_name,
          image_b64:    imageB64,
          image_ext:    imageExt,
        }),
      });
      const d = await r.json();
      if (d.error) { setError(d.error); return; }
      onSuccess(company.demo_id);
      onCancel();
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: "#0e0e1a", border: "1px solid rgba(16,185,129,0.3)" }}
        onClick={e => e.stopPropagation()}>

        {/* Шапка */}
        <div className="px-5 py-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(16,185,129,0.15)" }}>
              <Icon name="Receipt" size={16} style={{ color: "#10b981" }} />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Прикрепи чек оплаты</div>
              <div className="text-[11px] text-white/35">{company.company_name} · ID #{company.company_id}</div>
            </div>
            <button onClick={onCancel} className="ml-auto text-white/30 hover:text-white/60 transition">
              <Icon name="X" size={16} />
            </button>
          </div>
        </div>

        {/* Контент */}
        <div className="p-5 space-y-4">
          <p className="text-[11px] text-white/40">
            Загрузи фото чека — оно уйдёт тебе в Telegram с подписью компании. Статус изменится на «Оплатили».
          </p>

          {/* Дроп-зона */}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition"
            style={{
              minHeight: preview ? "auto" : 140,
              borderColor: preview ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.12)",
              background: preview ? "transparent" : "rgba(255,255,255,0.02)",
            }}>
            {preview ? (
              <img src={preview} alt="чек" className="w-full rounded-xl object-contain max-h-56" />
            ) : (
              <>
                <Icon name="Upload" size={24} style={{ color: "rgba(255,255,255,0.2)", marginBottom: 8 }} />
                <div className="text-xs text-white/30">Перетащи или нажми для выбора</div>
                <div className="text-[10px] text-white/20 mt-1">JPG, PNG</div>
              </>
            )}
          </div>

          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

          {preview && (
            <button onClick={() => { setPreview(null); setImageB64(null); }}
              className="text-[10px] text-white/30 hover:text-white/60 transition flex items-center gap-1">
              <Icon name="X" size={10} /> Удалить и выбрать другой
            </button>
          )}

          {error && (
            <div className="text-[11px] px-3 py-2 rounded-lg"
              style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
              {error}
            </div>
          )}
        </div>

        {/* Футер */}
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-[11px] font-bold transition"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
            Отмена
          </button>
          <button onClick={handleSubmit} disabled={!imageB64 || uploading}
            className="flex-1 py-2.5 rounded-xl text-[11px] font-bold transition disabled:opacity-40"
            style={{ background: "#10b981", color: "#fff" }}>
            {uploading
              ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block mr-1.5" />Отправка...</>
              : "✓ Подтвердить оплату"
            }
          </button>
        </div>
      </div>
    </div>
  );
}