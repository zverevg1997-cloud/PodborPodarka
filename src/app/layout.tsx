import type { Metadata } from "next";
import { Nunito, Unbounded } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Metrika from "@/components/Metrika";
import { getCurrentUser } from "@/lib/auth";
import {
  DAILY_RECOMMEND_LIMIT,
  countTodaySearches,
} from "@/lib/recommendLimit";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_NAME_RU,
  SITE_TITLE,
  SITE_URL,
  SOCIAL_LINKS,
} from "@/lib/site";

const bodyFont = Nunito({
  variable: "--font-body",
  subsets: ["latin", "cyrillic"],
});

const headingFont = Unbounded({
  variable: "--font-heading",
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  // Нужен, чтобы относительные пути в og:image и canonical разворачивались
  // в абсолютные — без него Next ругается и ссылки в превью ломаются.
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: SITE_NAME,
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  verification: {
    // Код подтверждения прав в Яндекс.Вебмастере. Держим прямо здесь, а не в
    // переменной окружения: он и так виден в HTML каждой страницы, то есть
    // секретом не является, а из кода его нельзя потерять при переезде.
    yandex: "e6e26fa64a15ada9",
    // Google свой код ещё не выдал. Пока переменной нет, Next метатег
    // не выводит, и это ничего не ломает.
    google: process.env.GOOGLE_SITE_VERIFICATION,
    // Подтверждение прав на площадку для партнёрской сети Яндекс Маркета.
    // Метатег отдаётся на всех страницах, поэтому подойдёт любой адрес сайта.
    other: {
      "yandex-market-verification": "tokfu892m4mzx9d4",
      // Подтверждение площадки в партнёрской сети «Такпродам». Нужна она нам
      // не ради вознаграждения, а ради товарных выгрузок: в них есть
      // фотографии и цены, которых у нас пока неоткуда взять.
      "takprodam-verification": "41eeefa9-c33f-413d-8f91-d6cf010d04bb",
      // Подтверждение площадки в Mitgo — это группа, которой принадлежит
      // Адмитад, и нужна она нам ради тех же товарных выгрузок.
      //
      // Имя тега они выдали кириллицей. Похоже на машинный перевод панели,
      // поэтому отдаём оба написания: лишний метатег ничего не стоит, а
      // проверка, которая не нашла тега, обошлась бы повторной заявкой.
      "mitgo-проверка": "980704f3-4928-497c-823a-b91c4e935308",
      "mitgo-verification": "980704f3-4928-497c-823a-b91c4e935308",
    },
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

// Разметка организации для поисковиков. Главное здесь — sameAs: по нему
// Яндекс и Google связывают сайт с сообществами и перестают считать их
// разными брендами. Без этого по запросу «дарибот» они конкурируют между
// собой, вместо того чтобы усиливать друг друга.
const ORGANIZATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME_RU,
  alternateName: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  sameAs: SOCIAL_LINKS.map((social) => social.href),
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  const usedToday = user ? await countTodaySearches(user.id) : 0;

  return (
    <html
      lang="ru"
      className={`${bodyFont.variable} ${headingFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Header
          userEmail={user?.email ?? null}
          usedToday={usedToday}
          dailyLimit={DAILY_RECOMMEND_LIMIT}
        />
        <main className="flex-1">{children}</main>
        <Footer />
        <Metrika />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION) }}
        />
      </body>
    </html>
  );
}
