import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Страницы за авторизацией индексировать нечего: робот всё равно
      // увидит только редирект на вход. Анкета (/search) в этот список не
      // входит: первый подбор доступен без регистрации, так что робот видит
      // ровно то же, что и человек, зашедший впервые.
      disallow: ["/api/", "/profile", "/results", "/login", "/reset"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
