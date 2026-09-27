// Входные кадры для генераторов видео из картинки.
//
// Генератору нужен вертикальный кадр со сценой, а не квадратный снимок
// товара на белом. С белого фона он двигает один предмет посреди пустоты и
// часто начинает его перерисовывать: у кружки отрастает вторая ручка, у
// лампы появляется лишняя кнопка. Когда по краям есть за что зацепиться,
// движение получается спокойнее и товар остаётся собой.
//
// Фон делаем из самой же фотографии: растягиваем на весь кадр, размываем и
// притемняем. Цвета совпадают с товаром, шва не видно, и генератор получает
// текстуру, а не пустоту.
//
// Запуск: node clips/frames.mjs   (с ВЫКЛЮЧЕННЫМ VPN)

import { mkdirSync } from "node:fs";
import sharp from "sharp";

const W = 1080;
const H = 1920;

/** Товары из нашего каталога, которые в кадре что-то делают. */
const ITEMS = [
  { id: "lampa-xiaomi", name: "Умная лампа Xiaomi, 846 ₽", url: "https://mi-shop.com/upload/iblock/8ae/mcu0rmy5s3e07nub1ei3rw8oxnd31w1d.png" },
  { id: "kolonka-xiaomi", name: "Портативная колонка Xiaomi, 1131 ₽", url: "https://mi-shop.com/upload/iblock/957/rhq6mnyu0tsgu04kjvlzvkmh4xlwxqb9.png" },
  { id: "termokruzhka", name: "Термокружка Polaris, 1399 ₽", url: "https://shop-polaris.ru/upload/iblock/ad8/Kontur-500TM-A.jpg" },
  { id: "uvlazhnitel", name: "Увлажнитель Polaris, 2110 ₽", url: "https://shop-polaris.ru/upload/iblock/cd4/PUH%205004_K01-min.jpg" },
];

const dir = (name) =>
  decodeURIComponent(new URL(name, import.meta.url).pathname.slice(1));

mkdirSync(dir("input/"), { recursive: true });

async function fetchPhoto(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`магазин ответил ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (error) {
      if (attempt === 3) {
        throw new Error(
          `не скачалась ${url}\n` +
            `Причина: ${String(error instanceof Error ? error.message : error)}\n` +
            "Если это таймаут — выключите VPN и запустите ещё раз.",
        );
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

for (const item of ITEMS) {
  const photo = await fetchPhoto(item.url);

  // Фон: та же фотография во весь кадр, размытая и притемнённая.
  const background = await sharp(photo)
    .resize(W, H, { fit: "cover" })
    .blur(60)
    .modulate({ brightness: 0.72, saturation: 1.15 })
    .toBuffer();

  // Товар — крупно, но с полями: генератору нужно место, чтобы двигать
  // камеру, и запас на случай, если он чуть сместит предмет.
  const product = await sharp(photo)
    .resize(820, 820, { fit: "inside" })
    .png()
    .toBuffer();

  const { height = 820 } = await sharp(product).metadata();

  await sharp(background)
    .composite([{ input: product, top: Math.round((H - height) / 2), left: Math.round((W - 820) / 2) }])
    .jpeg({ quality: 92 })
    .toFile(dir(`input/${item.id}.jpg`));

  console.log(`${item.id}.jpg — ${item.name}`);
}

console.log(`\nкадры в clips/input/ — их и подавайте генератору`);
