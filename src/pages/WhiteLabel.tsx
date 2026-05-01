import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Spin, Center } from "./whitelabel/WLHelpers";
import { WLContent } from "./whitelabel/WLContent";
import { WLLoginPage } from "./whitelabel/WLLoginPage";
import { WLManagerProvider, getWLToken } from "./whitelabel/WLManagerContext";
import func2url from "@/../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];

export default function WhiteLabel() {
  const { user, loading: authLoading } = useAuth();
  const [wlLoading, setWlLoading] = useState(true);
  const [wlOk,      setWlOk]      = useState(false);

  useEffect(() => {
    // Мастер — сразу доступ
    if (!authLoading && user?.is_master) {
      setWlOk(true); setWlLoading(false); return;
    }
    // Проверяем wl-токен менеджера
    if (!authLoading) {
      const tok = getWLToken();
      if (!tok) { setWlLoading(false); return; }
      fetch(`${AUTH_URL}?action=wl-me`, { headers: { "X-Authorization": tok } })
        .then(r => r.json())
        .then(d => { if (d.manager) setWlOk(true); })
        .catch(() => {})
        .finally(() => setWlLoading(false));
    }
  }, [user, authLoading]);

  if (authLoading || wlLoading)
    return <Center><Spin /><span className="ml-2 text-white/40 text-sm">Загрузка...</span></Center>;

  if (!wlOk)
    return (
      <WLManagerProvider isMaster={false}>
        <WLLoginPage />
      </WLManagerProvider>
    );

  return (
    <WLManagerProvider isMaster={!!user?.is_master}>
      <WLContent />
    </WLManagerProvider>
  );
}
