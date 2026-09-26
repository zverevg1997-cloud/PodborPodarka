/**
 * Вход через ВКонтакте.
 *
 * Обычная ссылка, а не кнопка с обработчиком: весь вход — это переход на
 * страницу согласия и возврат обратно, и браузер справляется с этим сам.
 * Никакого состояния на клиенте здесь не нужно.
 */
export default function VkLoginButton({ hint }: { hint?: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        или
        <span className="h-px flex-1 bg-border" />
      </div>

      <a
        href="/api/auth/vk/start"
        className="flex items-center justify-center gap-2.5 rounded-full bg-[#0077FF] px-4 py-3 font-semibold text-white transition hover:opacity-90 active:scale-[0.98]"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-5 w-5">
          <path d="M13.162 18.994c.609 0 .858-.406.851-.915-.031-1.917.714-2.949 2.059-1.604 1.488 1.488 1.796 2.519 3.603 2.519h3.2c.808 0 1.126-.26 1.126-.668 0-.863-1.421-2.386-2.678-3.564-1.72-1.608-1.799-1.65-.316-3.544 1.865-2.379 4.16-5.334 2.157-5.334h-3.31c-.763 0-.819.43-1.09 1.077-.984 2.34-2.837 5.421-3.542 4.968-.74-.475-.4-2.359-.344-5.271.015-.768.011-1.295-1.141-1.563-.629-.147-1.24-.207-1.805-.207-2.259 0-3.837.953-2.94 1.119 1.582.293 1.434 3.83 1.068 5.357-.638 2.662-3.171-2.239-4.184-4.458-.245-.534-.315-.923-1.135-.923h-2.797c-.472 0-.756.153-.756.508 0 .599 2.914 6.699 5.677 9.6 2.53 2.657 5.1 2.903 6.297 2.903z" />
        </svg>
        Войти через ВКонтакте
      </a>

      {hint ? (
        <p className="text-center text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
