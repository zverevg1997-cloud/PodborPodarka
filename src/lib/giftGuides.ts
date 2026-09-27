/**
 * Страницы-подборки под поисковые запросы: «что подарить мальчику на 10 лет»,
 * «что подарить коллегам на Новый год» и так далее.
 *
 * Идеи заданы заранее, а не генерируются при открытии: страница должна
 * открываться мгновенно и показывать роботу и человеку одно и то же. Подбор
 * под конкретного получателя живёт в анкете, ссылка на неё стоит на каждой
 * странице.
 *
 * Важно: страницы должны отличаться не только словом в заголовке. Если они
 * начнут повторять друг друга, поисковик сочтёт раздел штамповкой и понизит
 * сайт целиком. Поэтому каждая подборка пишется отдельно и лежит отдельным
 * файлом в `src/content/guides`.
 */

import { detyamNaNovyyGod } from "@/content/guides/detyam-na-novyy-god";
import { devochke8Let } from "@/content/guides/devochke-8-let";
import { malchiku9Let } from "@/content/guides/malchiku-9-let";
import { malchiku7Let } from "@/content/guides/malchiku-7-let";
import { malchiku6Let } from "@/content/guides/malchiku-6-let";
import { malchiku2Goda } from "@/content/guides/malchiku-2-goda";
import { malchiku12Let } from "@/content/guides/malchiku-12-let";
import { malchiku11Let } from "@/content/guides/malchiku-11-let";
import { devochke5Let } from "@/content/guides/devochke-5-let";
import { devochke3Goda } from "@/content/guides/devochke-3-goda";
import { devochke14Let } from "@/content/guides/devochke-14-let";
import { devochke10Let } from "@/content/guides/devochke-10-let";
import { devochkeNaNovyyGod } from "@/content/guides/devochke-na-novyy-god";
import { klassuNaNovyyGod } from "@/content/guides/klassu-na-novyy-god";
import { kollegamNaNovyyGod } from "@/content/guides/kollegam-na-novyy-god";
import { malchiku10Let } from "@/content/guides/malchiku-10-let";
import { malchiku5Let } from "@/content/guides/malchiku-5-let";
import { malchiku8Let } from "@/content/guides/malchiku-8-let";
import { mameNaNovyyGod } from "@/content/guides/mame-na-novyy-god";
import { muzhchineNaNovyyGod } from "@/content/guides/muzhchine-na-novyy-god";
import { papeNaNovyyGod } from "@/content/guides/pape-na-novyy-god";
import { parnyuNaNovyyGod } from "@/content/guides/parnyu-na-novyy-god";
import { kollege } from "@/content/guides/kollege";
import { kollegeMuzhchine } from "@/content/guides/kollege-muzhchine";
import { kollegeZhenshchine } from "@/content/guides/kollege-zhenshchine";
import { pape } from "@/content/guides/pape";
import { papeNa23Fevralya } from "@/content/guides/pape-na-23-fevralya";
import { papeNaDenRozhdeniya } from "@/content/guides/pape-na-den-rozhdeniya";
import { podrugeNaNovyyGod } from "@/content/guides/podruge-na-novyy-god";
import { rebenkuNaDenRozhdeniya } from "@/content/guides/rebenku-na-den-rozhdeniya";
import { uchitelyu } from "@/content/guides/uchitelyu";
import { uchitelyuOtKlassa } from "@/content/guides/uchitelyu-ot-klassa";
import { vospitatelyu } from "@/content/guides/vospitatelyu";

export interface GuideIdea {
  name: string;
  /** Почему подойдёт. Этого нет в чужих списках, ради этого и остаются. */
  reason: string;
  /** Ориентировочная вилка, рублей. Точные цены показывает сам Маркет. */
  priceFrom: number;
  priceTo: number;
  /** Запрос, с которым уходим на Маркет. */
  searchQuery: string;
  /**
   * Точная фраза для поиска по нашим выгрузкам. Заполнена только там, где
   * товар в каталоге действительно есть и совпадение проверено глазами.
   *
   * Отдельно от searchQuery намеренно: тот написан для поиска Маркета, где
   * лишние слова только уточняют, а здесь каждое слово обязано найтись в
   * названии товара — иначе под «настольной игрой» окажется настольная лампа.
   */
  productQuery?: string;
}

export interface GiftGuide {
  slug: string;
  /**
   * Заголовок и h1 — дословно так, как люди ищут, включая порядок слов.
   * «Что подарить мальчику на 10 лет» набирает 10 684, а «мальчику 10 лет на
   * день рождения» — вдвое меньше. Поэтому начинаем с сильной формы, а слабую
   * дописываем во второй половине: страница совпадает с обеими.
   */
  title: string;
  description: string;
  /** Вводный абзац: чем этот получатель или повод отличается от соседних. */
  intro: string;
  /** Короткие оговорки от себя — то, чего нет в чужих списках. */
  notes: string[];
  ideas: GuideIdea[];
  /** Бюджетный блок. Планка у подарка на класс и у подарка маме разная. */
  budget: {
    title: string;
    note: string;
    ideas: GuideIdea[];
  };
  /** Приглашение в анкету — про конкретного получателя, а не вообще. */
  cta: string;
  /**
   * Страницы, на которые эта ссылается. Заполнена у страниц-хабов.
   *
   * Хаб отвечает на общий запрос вроде «что подарить ребёнку на день
   * рождения», на который одной подборкой не ответишь: всё зависит от
   * возраста. Его задача — развести людей по частным страницам и связать
   * раздел перелинковкой, без которой поисковик не видит его вес целиком.
   *
   * Заводить хаб имеет смысл, только когда частных страниц уже несколько.
   * Хаб, ведущий на одну страницу, — её дубль, и засчитан будет так же.
   */
  related?: string[];
}

export const GIFT_GUIDES: GiftGuide[] = [
  kollegamNaNovyyGod,
  detyamNaNovyyGod,
  devochkeNaNovyyGod,
  klassuNaNovyyGod,
  mameNaNovyyGod,
  papeNaNovyyGod,
  parnyuNaNovyyGod,
  muzhchineNaNovyyGod,
  podrugeNaNovyyGod,
  malchiku10Let,
  uchitelyu,
  uchitelyuOtKlassa,
  vospitatelyu,
  malchiku5Let,
  malchiku8Let,
  rebenkuNaDenRozhdeniya,
  kollege,
  kollegeMuzhchine,
  kollegeZhenshchine,
  pape,
  papeNa23Fevralya,
  papeNaDenRozhdeniya,
  devochke8Let,
  devochke10Let,
  devochke14Let,
  devochke3Goda,
  devochke5Let,
  malchiku11Let,
  malchiku12Let,
  malchiku2Goda,
  malchiku6Let,
  malchiku7Let,
  malchiku9Let,
];

/**
 * Разделы списка подборок.
 *
 * Плоский список из шестнадцати ссылок читается как свалка, а дальше будет
 * только хуже: возрастных страниц по данным Вордстата напрашивается около
 * сорока. Группы нужны и человеку, и поисковику — по ним видно, что раздел
 * устроен, а не насыпан.
 *
 * Порядок разделов — по тому, насколько мы в них сильны, а не по размеру
 * спроса. Школьная ниша почти свободна, и начинать стоит с неё.
 */
export const GUIDE_GROUPS: Array<{
  title: string;
  note: string;
  slugs: string[];
}> = [
  {
    title: "С чего начать",
    note: "Общий вопрос, на который одной подборкой не ответить: всё зависит от возраста. Эта страница разводит по остальным.",
    slugs: ["rebenku-na-den-rozhdeniya", "pape", "kollege"],
  },
  {
    title: "Учителям и воспитателям",
    note: "Здесь у подарка есть потолок по закону — три тысячи рублей на человека. Разбираем, как в него уложиться.",
    slugs: ["uchitelyu", "uchitelyu-ot-klassa", "vospitatelyu", "klassu-na-novyy-god"],
  },
  {
    title: "Мальчикам по возрасту",
    note: "Год разницы в детстве меняет всё. Поэтому страницы отдельные, а не «детям от 5 до 10».",
    slugs: [
      "malchiku-2-goda",
      "malchiku-5-let",
      "malchiku-6-let",
      "malchiku-7-let",
      "malchiku-8-let",
      "malchiku-9-let",
      "malchiku-10-let",
      "malchiku-11-let",
      "malchiku-12-let",
    ],
  },
  {
    title: "Девочкам по возрасту",
    note: "То же самое и по тем же причинам: в три года и в четырнадцать это разные люди.",
    slugs: [
      "devochke-3-goda",
      "devochke-5-let",
      "devochke-8-let",
      "devochke-10-let",
      "devochke-14-let",
    ],
  },
  {
    title: "Папе",
    note: "Самый трудный получатель в семье: на «что тебе подарить» отвечает «ничего не надо» — и не лукавит.",
    slugs: ["pape-na-den-rozhdeniya", "pape-na-23-fevralya", "pape-na-novyy-god"],
  },
  {
    title: "Коллегам",
    note: "Здесь важнее не попасть в душу, а не поставить человека в неловкое положение.",
    slugs: ["kollege-zhenshchine", "kollege-muzhchine", "kollegam-na-novyy-god"],
  },
  {
    title: "На Новый год",
    note: "Один повод, но очень разные получатели: коллеге и маме дарят по разным правилам.",
    slugs: [
      "kollegam-na-novyy-god",
      "mame-na-novyy-god",
      "pape-na-novyy-god",
      "podruge-na-novyy-god",
      "parnyu-na-novyy-god",
      "muzhchine-na-novyy-god",
      "detyam-na-novyy-god",
      "devochke-na-novyy-god",
    ],
  },
];

export function findGuide(slug: string): GiftGuide | undefined {
  return GIFT_GUIDES.find((guide) => guide.slug === slug);
}

/**
 * Подборки, разложенные по разделам.
 *
 * Всё, что не попало ни в один раздел, собирается в последний. Без этого
 * забытая в GUIDE_GROUPS страница молча исчезла бы из списка и осталась бы
 * доступной только поисковику.
 */
export function groupedGuides(): Array<{
  title: string;
  note: string;
  guides: GiftGuide[];
}> {
  const taken = new Set<string>();

  const groups = GUIDE_GROUPS.map((group) => {
    const guides = group.slugs
      .map((slug) => {
        taken.add(slug);
        return findGuide(slug);
      })
      .filter((guide): guide is GiftGuide => Boolean(guide));

    return { title: group.title, note: group.note, guides };
  }).filter((group) => group.guides.length > 0);

  const rest = GIFT_GUIDES.filter((guide) => !taken.has(guide.slug));
  if (rest.length > 0) {
    groups.push({ title: "Остальные подборки", note: "", guides: rest });
  }

  return groups;
}
