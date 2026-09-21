import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Страницы за авторизацией индексировать нечего: робот всё равно
      // увидит только редирект на вход.
      disallow: ["/api/", "/profile", "/results", "/search", "/login"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
