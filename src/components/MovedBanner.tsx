import Icon from "@/components/ui/icon";

/**
 * Экран «Проект переехал» — показывается на главной странице вместо контента.
 *
 * Сделан неперекрываемым намеренно: это не модалка, а полноэкранная заглушка
 * без кнопки закрытия. Отрисовывается ВМЕСТО главной страницы, поэтому её
 * нельзя убрать ни Escape, ни кликом мимо, ни через DevTools-закрытие модалки —
 * под ней просто нет старого контента.
 *
 * Чтобы вернуть главную страницу обратно — достаточно убрать один флаг
 * SHOW_MOVED_BANNER в src/config/moved.ts, код самой страницы не тронут.
 */

interface Props {
  /** Адрес, куда переехал проект */
  url: string;
}

export default function MovedBanner({ url }: Props) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-8 overflow-y-auto"
      style={{ background: "#0b0b11" }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="moved-title"
    >
      <div
        className="w-full max-w-lg rounded-3xl p-8 sm:p-10 text-center shadow-2xl"
        style={{
          background: "linear-gradient(180deg,#15131f 0%,#121019 100%)",
          border: "1px solid rgba(124,58,237,0.35)",
        }}
      >
        <div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.4)" }}
        >
          <Icon name="Rocket" size={30} style={{ color: "#a78bfa" }} />
        </div>

        <h1 id="moved-title" className="mb-3 text-2xl sm:text-3xl font-bold" style={{ color: "#fff" }}>
          Проект переехал
        </h1>

        <p className="mb-7 text-sm sm:text-base leading-relaxed" style={{ color: "#a1a1aa" }}>
          Мы переехали на новый адрес. Здесь сайт больше не работает —
          перейдите по ссылке ниже, чтобы продолжить работу.
        </p>

        <a
          href={url}
          className="flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-bold transition hover:opacity-90"
          style={{ background: "#7c3aed", color: "#fff" }}
        >
          Перейти на новый адрес
          <Icon name="ArrowRight" size={18} />
        </a>

        <div
          className="mt-5 rounded-xl px-4 py-3 text-xs sm:text-sm break-all"
          style={{ background: "rgba(255,255,255,0.04)", color: "#8b8b96" }}
        >
          {url}
        </div>
      </div>
    </div>
  );
}
