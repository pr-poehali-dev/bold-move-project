import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);

// Офлайн-режим: регистрируем service worker, чтобы при попытке открыть сайт без
// интернета показывалась своя страница с картинкой, а не английская ошибка браузера.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* не критично */ });
  });
}