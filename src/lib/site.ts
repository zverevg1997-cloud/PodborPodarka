// Канонический адрес сайта. Домен кириллический, а в коде он нужен в punycode:
// дарибот.рф → xn--80achr5ajr.xn--p1ai. Апекс отдаёт 308 на www, поэтому
// каноническим считаем адрес с www — иначе метатеги и карта сайта будут
// ссылаться на редирект.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.xn--80achr5ajr.xn--p1ai";

export const SITE_NAME = "Daribot";
export const SITE_DOMAIN = "дарибот.рф";

export const SITE_DESCRIPTION =
  "Расскажите, кому и по какому поводу нужен подарок — Daribot предложит " +
  "несколько идей с объяснением, почему они подойдут именно этому человеку.";

// Данные оператора персональных данных для политики конфиденциальности и
// пользовательского соглашения. ДО ЗАПУСКА их нужно заменить на реальные:
// без них документы юридической силы не имеют. Пока плейсхолдеры на месте,
// страницы показывают предупреждение (см. OPERATOR_INCOMPLETE).
export const OPERATOR = {
  name: "ЗАПОЛНИТЬ: ИП Фамилия Имя Отчество",
  inn: "ЗАПОЛНИТЬ: ИНН",
  address: "ЗАПОЛНИТЬ: адрес для корреспонденции",
  email: "support@daribot.ru",
};

export const OPERATOR_INCOMPLETE = Object.values(OPERATOR).some((value) =>
  value.startsWith("ЗАПОЛНИТЬ"),
);

// Дата последней редакции юридических документов.
export const LEGAL_REVISION = "21 сентября 2026 года";
