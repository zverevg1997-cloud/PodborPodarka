"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { trackPageView } from "@/lib/metrika";

const COUNTER_ID = process.env.NEXT_PUBLIC_METRIKA_ID;

/**
 * Счётчик Яндекс Метрики.
 *
 * Вебвизор намеренно выключен: он записывает сессии вместе с тем, что человек
 * печатает в формах, а у нас в анкете — сведения о третьем лице (имя, возраст,
 * увлечения получателя подарка). Записывать это и хранить у стороннего
 * сервиса мы людям не обещали.
 *
 * Идентификатор берём из переменной окружения, поэтому при локальной
 * разработке счётчик просто не подключается и не портит статистику.
 */
export default function Metrika() {
  const pathname = usePathname();
  const firstRender = useRef(true);

  useEffect(() => {
    // Next.js меняет страницы без перезагрузки, и счётчик сам этого не
    // замечает: без этого вся воронка после первой страницы была бы невидимой.
    // Первый заход считает сам init при загрузке скрипта, поэтому пропускаем.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    trackPageView(window.location.href);
  }, [pathname]);

  if (!COUNTER_ID) return null;

  return (
    <>
      <Script id="yandex-metrika" strategy="afterInteractive">
        {`
          (function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for (var j = 0; j < document.scripts.length; j++) {
              if (document.scripts[j].src === r) { return; }
            }
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,
            a.parentNode.insertBefore(k,a)
          })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js?id=${COUNTER_ID}', 'ym');

          ym(${COUNTER_ID}, 'init', {
            ssr: true,
            webvisor: false,
            clickmap: true,
            accurateTrackBounce: true,
            trackLinks: true
          });
        `}
      </Script>
      <noscript>
        <div>
          <img
            src={`https://mc.yandex.ru/watch/${COUNTER_ID}`}
            style={{ position: "absolute", left: "-9999px" }}
            alt=""
          />
        </div>
      </noscript>
    </>
  );
}
