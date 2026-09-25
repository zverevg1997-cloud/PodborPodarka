"use client";

import { useEffect, useState } from "react";

/**
 * Страница возврата после входа во ВКонтакте.
 *
 * Нужна из-за того, что новый вход ВК (VK ID) не принимает служебный адрес
 * oauth.vk.com/blank.html, которым пользовался старый: адрес возврата должен
 * быть на нашем домене и заранее прописан в настройках приложения.
 *
 * Делать здесь обмен кода на токен нельзя — для него нужен секрет, который
 * живёт в запустившем всё скрипте и в браузер не попадает. Поэтому страница
 * просто показывает адрес, чтобы его было удобно скопировать целиком.
 */
export default function VkCallbackPage() {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(window.location.href);
  }, []);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-6 py-16">
      <h1 className="font-display text-2xl font-extrabold">
        Вход выполнен
      </h1>
      <p className="text-muted-foreground">
        Скопируйте адрес целиком и вставьте его в терминал, где ждёт скрипт.
      </p>

      <textarea
        readOnly
        value={url}
        rows={4}
        onFocus={(event) => event.currentTarget.select()}
        className="w-full rounded-2xl border border-border bg-card p-4 font-mono text-xs"
      />

      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(url).then(() => setCopied(true));
        }}
        className="gradient-brand self-start rounded-full px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition hover:opacity-90"
      >
        {copied ? "Скопировано" : "Скопировать адрес"}
      </button>

      <p className="text-sm text-muted-foreground">
        В адресе одноразовый код. Он действует несколько минут и сам по себе
        доступа не даёт — без секрета, оставшегося в скрипте, обменять его не
        получится.
      </p>
    </div>
  );
}
