/**
 * Посредник между нашим сервером и Telegram.
 *
 * Зачем: с российского сервера Timeweb соединение с api.telegram.org не
 * устанавливается — проверено, все остальные адреса, включая Cloudflare,
 * Google и GitHub, при этом доступны. Значит, блокировка прицельная, и
 * запросы к телеграму надо вести через точку за её пределами.
 *
 * Как разворачивать — в docs/telegram-relay.md.
 *
 * Секрет лежит первым сегментом пути, а не в заголовке: тогда наш код
 * менять не нужно вовсе. Он собирает адрес как «<база>/bot<токен>/<метод>»,
 * и достаточно указать базой «https://<воркер>.workers.dev/<секрет>».
 *
 * Без проверки секрета воркер стал бы открытым прокси к телеграму: любой,
 * кто узнает адрес, смог бы гонять через него чужой трафик, а счёт за
 * превышение лимитов пришёл бы владельцу.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);

    if (!env.RELAY_SECRET || parts[0] !== env.RELAY_SECRET) {
      return new Response("forbidden", { status: 403 });
    }

    const target =
      "https://api.telegram.org/" + parts.slice(1).join("/") + url.search;

    const init = {
      method: request.method,
      headers: {
        "content-type":
          request.headers.get("content-type") ?? "application/json",
      },
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = await request.text();
    }

    try {
      return await fetch(target, init);
    } catch (error) {
      return new Response(
        JSON.stringify({ ok: false, description: String(error) }),
        { status: 502, headers: { "content-type": "application/json" } },
      );
    }
  },
};
