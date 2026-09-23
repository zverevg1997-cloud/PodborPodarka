import type { Metadata } from "next";
import { Nunito, Unbounded } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getCurrentUser } from "@/lib/auth";
import {
  DAILY_RECOMMEND_LIMIT,
  countTodaySearches,
} from "@/lib/recommendLimit";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

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
    default: `${SITE_NAME} — подбор подарков с ИИ`,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: SITE_NAME,
    url: SITE_URL,
    title: `${SITE_NAME} — подбор подарков с ИИ`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — подбор подарков с ИИ`,
    description: SITE_DESCRIPTION,
  },
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
      </body>
    </html>
  );
}
