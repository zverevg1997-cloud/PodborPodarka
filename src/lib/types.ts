export interface GiftIdea {
  name: string;
  reason: string;
  searchQuery: string;
  // "local" — сертификаты, услуги, впечатления, цветы: их ищем обычным
  // поиском Яндекса по городу, а не на Маркете. У старых записей поля нет.
  kind?: "product" | "local";
}

export interface RecommendRequestBody {
  profileId: string;
  occasion: string;
  budget?: string;
  timeframe?: string;
  city?: string;
  mood?: string;
  /**
   * Идентификатор подбора, который продолжаем по кнопке «Смотреть ещё».
   * Уже показанные идеи берутся из него и передаются модели как запрет,
   * а результат дописывается к ним, чтобы страница показывала всё разом.
   */
  continueSearchId?: string;
}

export interface ProfileInput {
  name: string;
  gender?: string;
  age?: number;
  relationship?: string;
  job?: string;
  interests?: string;
}
