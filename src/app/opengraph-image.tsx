import { ImageResponse } from "next/og";
import { SITE_DOMAIN } from "@/lib/site";

export const alt = "Daribot — подбор подарков с ИИ";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Картинка для превью ссылки в мессенджерах и соцсетях. Рисуем фигурами и
// текстом, без эмодзи: своих шрифтов с эмодзи у генератора нет, и вместо
// значка получились бы пустые квадраты.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #ff5c7a 0%, #7c5cfc 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {/* Подарочная коробка: белый квадрат с янтарной лентой и бантом. */}
        <div
          style={{
            display: "flex",
            position: "relative",
            width: 132,
            height: 132,
            borderRadius: 28,
            background: "#ffffff",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 24,
              height: 132,
              background: "#ffb020",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 132,
              height: 24,
              background: "#ffb020",
            }}
          />
          {/* Бант — две петли по краям ленты, а не одно кольцо: одиночный
              овал поверх вертикальной ленты читался как буква «Ф». */}
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 20,
              width: 46,
              height: 30,
              borderRadius: 999,
              border: "11px solid #ffb020",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 12,
              right: 20,
              width: 46,
              height: 30,
              borderRadius: 999,
              border: "11px solid #ffb020",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 44,
            fontSize: 96,
            fontWeight: 800,
            letterSpacing: -2,
          }}
        >
          Daribot
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 12,
            fontSize: 40,
            opacity: 0.95,
            textAlign: "center",
          }}
        >
          Дарить точно в цель — за пару минут
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 40,
            padding: "12px 32px",
            borderRadius: 999,
            background: "rgba(255, 255, 255, 0.18)",
            fontSize: 30,
          }}
        >
          {SITE_DOMAIN}
        </div>
      </div>
    ),
    size,
  );
}
