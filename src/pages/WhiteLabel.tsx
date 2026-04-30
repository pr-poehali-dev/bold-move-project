import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Spin, Center } from "./whitelabel/WLHelpers";
import { WLContent } from "./whitelabel/WLContent";

export default function WhiteLabel() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && !user.is_master) navigate("/");
  }, [user, loading, navigate]);

  if (loading) return <Center><Spin /><span className="ml-2 text-white/40 text-sm">Загрузка...</span></Center>;
  if (!user)        return <Center><span className="text-white/40 text-sm">Нужно войти как мастер</span></Center>;
  if (!user.is_master) return <Center><span className="text-white/40 text-sm">Доступ только для мастера</span></Center>;

  return <WLContent />;
}
