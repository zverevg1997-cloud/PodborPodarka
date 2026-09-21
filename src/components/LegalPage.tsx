import type { ReactNode } from "react";
import { LEGAL_REVISION, OPERATOR_INCOMPLETE } from "@/lib/site";

interface LegalPageProps {
  title: string;
  children: ReactNode;
}

/**
 * Общая обёртка для юридических страниц: узкая колонка, единая типографика
 * и предупреждение, пока в OPERATOR не подставлены реальные данные.
 */
export default function LegalPage({ title, children }: LegalPageProps) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-14">
      <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
        {title}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Редакция от {LEGAL_REVISION}
      </p>

      {OPERATOR_INCOMPLETE && (
        <p className="mt-6 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
          Черновик: в документе не заполнены данные оператора. Перед запуском
          подставьте их в <code>src/lib/site.ts</code>.
        </p>
      )}

      <div className="mt-8 flex flex-col gap-6 text-[0.95rem] leading-relaxed text-foreground/90 [&_a]:font-semibold [&_a]:text-primary [&_a:hover]:underline [&_h2]:font-display [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2">
        {children}
      </div>
    </article>
  );
}
