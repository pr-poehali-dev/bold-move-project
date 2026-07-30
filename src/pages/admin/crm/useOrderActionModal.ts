import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { crmFetch, Client, getCrmToken } from "./crmApi";
import func2url from "@/../backend/func2url.json";

const CRM_URL = (func2url as Record<string, string>)["crm-manager"];

// Модалка подтверждения перехода в Построитель / Агент + сама логика перехода.
export function useOrderActionModal(onReload: () => void) {
  const navigate = useNavigate();
  const [actionModal, setActionModal] = useState<{ type: "builder" | "agent"; client: Client } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const handleSwipeBuilder = (client: Client) => setActionModal({ type: "builder", client });
  const handleSwipeAgent   = (client: Client) => setActionModal({ type: "agent",   client });

  const handleActionConfirm = async () => {
    if (!actionModal) return;
    setActionLoading(true);

    if (actionModal.type === "builder") {
      const client = actionModal.client;

      // Если проект уже привязан — просто открываем его
      if (client.project_id) {
        localStorage.setItem("crm_linked_session", JSON.stringify({
          chat_id: client.id,
          session_id: client.session_id,
          client_name: client.client_name || `Заявка №${client.id}`,
          phone: client.phone || "",
          address: client.address || "",
          auth_token: getCrmToken() || undefined,
        }));
        setActionModal(null);
        setActionLoading(false);
        navigate(`/plan?project_id=${client.project_id}`);
        return;
      }

      // Создаём новый проект в построителе с данными клиента
      const token = getCrmToken();
      const res = await fetch(`${CRM_URL}?r=plan-projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: client.client_name || `Заявка №${client.id}`,
          address: client.address || "",
        }),
      });
      const data = await res.json();
      if (data.id) {
        // Привязываем project_id к заявке в CRM
        await crmFetch("clients", {
          method: "PUT",
          body: JSON.stringify({ project_id: data.id }),
        }, { id: String(client.id) });
        localStorage.setItem("crm_linked_session", JSON.stringify({
          chat_id: client.id,
          session_id: client.session_id,
          client_name: client.client_name || `Заявка №${client.id}`,
          phone: client.phone || "",
          address: client.address || "",
          auth_token: getCrmToken() || undefined,
        }));
        onReload();
        setActionModal(null);
        setActionLoading(false);
        navigate(`/plan?project_id=${data.id}`);
      } else {
        setActionLoading(false);
      }

    } else {
      // Переходим в агент с привязкой к заявке через session_id
      const client = actionModal.client;
      localStorage.setItem("crm_linked_session", JSON.stringify({
        chat_id: client.id,
        session_id: client.session_id,
        client_name: client.client_name || `Заявка №${client.id}`,
        phone: client.phone || "",
        address: client.address || "",
      }));
      setActionModal(null);
      setActionLoading(false);
      navigate("/");
    }
  };

  return { actionModal, actionLoading, handleSwipeBuilder, handleSwipeAgent, handleActionConfirm, closeActionModal: () => { if (!actionLoading) setActionModal(null); } };
}
