import Link from "next/link";
import { OPERATOR, SITE_NAME } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-border/70 bg-muted/40">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-1">
          <span className="font-display font-bold text-foreground">
            🎁 {SITE_NAME}
          </span>
          <span>Идеи подарков подбирает ИИ — проверяйте наличие и цену.</span>
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
    </footer>
  );
}
