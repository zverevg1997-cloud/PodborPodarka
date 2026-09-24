import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { GIFT_GUIDES } from "@/lib/giftGuides";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  // Подборки под поисковые запросы: страниц будет много, поэтому
  // перечисляем их из того же списка, из которого они и строятся.
  const guides: MetadataRoute.Sitemap = GIFT_GUIDES.map((guide) => ({
    url: `${SITE_URL}/chto-podarit/${guide.slug}`,
    lastModified,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [
    // Со слешем на конце: без пути получается голый адрес хоста, и строгие
    // разборщики карты считают такую запись неполной.
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    // Анкета — вторая по важности страница после главной: на неё ведёт
    // кнопка с главной, и она же отвечает на запросы вроде «подобрать
    // подарок онлайн».
    {
      url: `${SITE_URL}/search`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/chto-podarit`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...guides,
    {
      url: `${SITE_URL}/register`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
