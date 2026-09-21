import { useLocation } from "react-router-dom";
import MovedBanner from "@/components/MovedBanner";
import { isMovedBannerVisible, MOVED_URL } from "@/config/moved";

/**
 * Глобальный «шлагбаум» переезда.
 *
 * Стоит ВМЕСТО всех страниц сразу, а не на каждом маршруте по отдельности —
 * поэтому закрывает и те адреса, которые появятся в будущем, и никакой
 * страницы под ним не монтируется (обойти нечем).
 *
 * Исключения (адрес переезда, ссылки для клиентов, возвраты после входа)
 * перечислены одним списком в src/config/moved.ts.
 */
export default function MovedGate({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  if (isMovedBannerVisible(pathname)) return <MovedBanner url={MOVED_URL} />;
  return <>{children}</>;
}
