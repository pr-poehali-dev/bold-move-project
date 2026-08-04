import { useEffect, useState } from "react";

// Картинка лежит локально в проекте — иначе без интернета её не загрузить
const OFFLINE_IMAGE = "/offline.png";

// Полноэкранная заглушка при пропаже интернета: вместо английской ошибки браузера
// показываем свою картинку и кнопку «Перезагрузить».
export default function OfflineScreen() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline  = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "#07070f",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 24, padding: 24, textAlign: "center",
      }}>
      <img
        src={OFFLINE_IMAGE}
        alt="Нет подключения к интернету"
        style={{ maxWidth: "min(420px, 85vw)", width: "100%", height: "auto", objectFit: "contain" }}
      />
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: "14px 32px",
          background: "#7c3aed", color: "#fff",
          border: "none", borderRadius: 14,
          fontSize: 16, fontWeight: 700, cursor: "pointer",
          boxShadow: "0 8px 24px rgba(124,58,237,0.35)",
        }}>
        Перезагрузить
      </button>
    </div>
  );
}