// Страница возврата от Avito OAuth — пользователь уже залогинен в CRM (в отличие
// от Google/Yandex, тут не вход, а ПОДКЛЮЧЕНИЕ канала). Отправляет code на backend
// (crm-manager, resource=avito-callback), который обменивает его на токен с правами
// messenger:read/write и перерегистрирует вебхук этим токеном.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { crmFetch } from "@/pages/admin/crm/crmApi";

export default function AvitoCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const errorParam = params.get("error");

      if (errorParam) { setError("Avito отклонил запрос доступа"); return; }
      if (!code) { setError("Avito не передал код авторизации"); return; }

      try {
        const res = await crmFetch("avito-callback", {
          method: "POST",
          body: JSON.stringify({ code }),
        }) as { ok?: boolean; error?: string; webhook_registered?: boolean };
        if (!res?.ok) { setError(res?.error || "Не удалось подключить Avito"); return; }
        setDone(true);
        setTimeout(() => navigate("/company?tab=integrations", { replace: true }), 1200);
      } catch {
        setError("Ошибка сети");
      }
    };
    run();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#0b0b11" }}>
      <div className="text-center">
        {error ? (
          <>
            <Icon name="CircleAlert" size={32} className="mx-auto mb-3" style={{ color: "#ef4444" }} />
            <p className="text-sm text-white/70 mb-4">{error}</p>
            <button onClick={() => navigate("/company?tab=integrations", { replace: true })}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "#f97316" }}>
              Вернуться в Интеграции
            </button>
          </>
        ) : done ? (
          <>
            <Icon name="CheckCircle2" size={32} className="mx-auto mb-3" style={{ color: "#10b981" }} />
            <p className="text-sm text-white/70">Avito подключён!</p>
          </>
        ) : (
          <>
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/70 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-white/50">Подключаем Avito…</p>
          </>
        )}
      </div>
    </div>
  );
}