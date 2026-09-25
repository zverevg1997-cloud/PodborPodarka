import Link from "next/link";
import { OPERATOR, SITE_NAME, SOCIAL_LINKS } from "@/lib/site";

// Значки рисуем сами, а не тянем библиотеку иконок: их всего два, и каждая
// такая библиотека — это лишние сотни килобайт в сборке ради одного пути.
const ICONS: Record<string, React.ReactNode> = {
  ВКонтакте: (
    <path d="M13.162 18.994c.609 0 .858-.406.851-.915-.031-1.917.714-2.949 2.059-1.604 1.488 1.488 1.796 2.519 3.603 2.519h3.2c.808 0 1.126-.26 1.126-.668 0-.863-1.421-2.386-2.678-3.564-1.72-1.608-1.799-1.65-.316-3.544 1.865-2.379 4.16-5.334 2.157-5.334h-3.31c-.763 0-.819.43-1.09 1.077-.984 2.34-2.837 5.421-3.542 4.968-.74-.475-.4-2.359-.344-5.271.015-.768.011-1.295-1.141-1.563-.629-.147-1.24-.207-1.805-.207-2.259 0-3.837.953-2.94 1.119 1.582.293 1.434 3.83 1.068 5.357-.638 2.662-3.171-2.239-4.184-4.458-.245-.534-.315-.923-1.135-.923h-2.797c-.472 0-.756.153-.756.508 0 .599 2.914 6.699 5.677 9.6 2.53 2.657 5.1 2.903 6.297 2.903z" />
  ),
  Телеграм: (
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm4.906 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212-.07-.062-.174-.041-.249-.024-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  ),
};

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-border/70 bg-muted/40">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-1">
          <span className="font-display font-bold text-foreground">
            🎁 {SITE_NAME}
          </span>
          <span>Идеи подарков подбирает ИИ — проверяйте наличие и цену.</span>
        </div>

        <div className="flex flex-col gap-4 sm:items-end">
          <div className="flex items-center gap-2">
            {SOCIAL_LINKS.map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                // noreferrer не ставим намеренно: по переходам с сайта
                // сообщества видят, откуда пришёл человек.
                rel="noopener"
                aria-label={social.name}
                title={social.name}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                  className="h-[18px] w-[18px]"
                >
                  {ICONS[social.name]}
                </svg>
              </a>
            ))}
          </div>

          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/privacy" className="transition hover:text-foreground">
              Конфиденциальность
            </Link>
            <Link href="/terms" className="transition hover:text-foreground">
              Соглашение
            </Link>
            <a
              href={`mailto:${OPERATOR.email}`}
              className="transition hover:text-foreground"
            >
              {OPERATOR.email}
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
