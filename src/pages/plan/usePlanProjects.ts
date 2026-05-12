import { useState, useCallback } from "react";
import func2url from "@/../backend/func2url.json";

const CRM_URL = (func2url as Record<string, string>)["crm-manager"];

function headers(token?: string | null) {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export interface PlanProject {
  id: number;
  company_id: number;
  name: string;
  client_name: string | null;
  address: string | null;
  phone: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PlanRoom {
  id: number;
  project_id: number;
  name: string;
  data: object;
  thumbnail: string | null;
  created_at: string;
  updated_at: string;
}

export function usePlanProjects(token?: string | null) {
  const [projects, setProjects] = useState<PlanProject[]>([]);
  const [rooms,    setRooms]    = useState<PlanRoom[]>([]);
  const [loading,  setLoading]  = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${CRM_URL}?r=plan-projects`, { headers: headers(token) });
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const createProject = useCallback(async (body: {
    name: string; client_name?: string; address?: string; phone?: string;
  }): Promise<number> => {
    const res = await fetch(`${CRM_URL}?r=plan-projects`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data.id as number;
  }, [token]);

  const loadRooms = useCallback(async (projectId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${CRM_URL}?r=plan-rooms&project_id=${projectId}`, {
        headers: headers(token),
      });
      const data = await res.json();
      setRooms(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const createRoom = useCallback(async (projectId: number, name: string): Promise<number> => {
    const res = await fetch(`${CRM_URL}?r=plan-rooms`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({ project_id: projectId, name }),
    });
    const data = await res.json();
    return data.id as number;
  }, [token]);

  const loadRoom = useCallback(async (roomId: number): Promise<PlanRoom | null> => {
    const res = await fetch(`${CRM_URL}?r=plan-rooms&id=${roomId}`, {
      headers: headers(token),
    });
    const data = await res.json();
    if (data.error || !data.id) return null;
    return data as PlanRoom;
  }, [token]);

  const updateRoom = useCallback(async (roomId: number, body: { name?: string; data?: object; thumbnail?: string }) => {
    await fetch(`${CRM_URL}?r=plan-rooms&id=${roomId}`, {
      method: "PUT",
      headers: headers(token),
      body: JSON.stringify(body),
    });
  }, [token]);

  const deleteRoom = useCallback(async (roomId: number) => {
    await fetch(`${CRM_URL}?r=plan-rooms&id=${roomId}`, {
      method: "DELETE",
      headers: headers(token),
    });
  }, [token]);

  const updateProject = useCallback(async (id: number, body: Partial<Pick<PlanProject, "name" | "client_name" | "address" | "phone" | "status">>) => {
    await fetch(`${CRM_URL}?r=plan-projects&id=${id}`, {
      method: "PUT",
      headers: headers(token),
      body: JSON.stringify(body),
    });
  }, [token]);

  const deleteProject = useCallback(async (id: number) => {
    await fetch(`${CRM_URL}?r=plan-projects&id=${id}`, {
      method: "DELETE",
      headers: headers(token),
    });
  }, [token]);

  const saveRoom = useCallback(async (roomId: number, planData: object, thumbnail?: string) => {
    await fetch(`${CRM_URL}?r=plan-rooms&id=${roomId}`, {
      method: "PUT",
      headers: headers(token),
      body: JSON.stringify({ data: planData, ...(thumbnail ? { thumbnail } : {}) }),
    });
  }, [token]);

  return { projects, rooms, loading, loadProjects, createProject, updateProject, deleteProject, loadRooms, createRoom, loadRoom, saveRoom, updateRoom, deleteRoom };
}