#!/usr/bin/env python3
"""
Автопостер на Claude для Telegram и ВКонтакте, с чередованием форматов постов.

1. По расписанию собирает свежие посты из источников:
   публичных TG-каналов (t.me/s/...) и сообществ ВК (VK API, wall.get).
2. Claude пишет черновики разных форматов согласно заданному миксу
   (подборки, разбор одного товара, вовлечение, повод, опрос).
3. Черновики приходят вам в личку Telegram с кнопками:
   В Telegram / Во ВКонтакте / Везде / Другой вариант / Отклонить.
4. Бот публикует пост туда, куда вы выбрали. Опросы публикуются
   как нативные Telegram-опросы (во ВК их пока нужно создавать вручную).

Правки: ответьте (reply) на черновик текстом, например «сделай короче».
"""
import asyncio
import json
import logging
import os
import random
import re
import sqlite3
from collections import Counter
from datetime import datetime, timezone

import httpx
from anthropic import AsyncAnthropic
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ChatAction
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

load_dotenv()


def env_list(name: str) -> list[str]:
    return [s.strip() for s in os.getenv(name, "").split(",") if s.strip()]


# ---------------------------------------------------------------- настройки
BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
ADMIN_ID = int(os.environ["ADMIN_ID"])

# Telegram
TARGET_CHANNEL = os.getenv("TARGET_CHANNEL", "").strip()          # @mychannel или -100...
TG_SOURCES = [s.lstrip("@") for s in env_list("SOURCE_CHANNELS")]

# ВКонтакте
VK_TOKEN = os.getenv("VK_TOKEN", "").strip()                      # токен админа сообщества (для публикации)
VK_READ_TOKEN = os.getenv("VK_READ_TOKEN", "").strip() or VK_TOKEN  # сервисный ключ (для чтения)
VK_GROUP_ID = os.getenv("VK_GROUP_ID", "").strip().lstrip("-")     # id вашего сообщества, без минуса
VK_SOURCES = env_list("VK_SOURCES")                               # короткие имена или id сообществ
VK_SUFFIX = os.getenv("VK_SUFFIX", "").strip()                    # напр. хэштеги для ВК
VK_API_VERSION = os.getenv("VK_API_VERSION", "5.199")

TG_ENABLED = bool(TARGET_CHANNEL)
VK_ENABLED = bool(VK_TOKEN and VK_GROUP_ID)

# Генерация
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-5")
DRAFTS_PER_RUN = int(os.getenv("DRAFTS_PER_RUN", "3"))
RUN_EVERY_HOURS = float(os.getenv("RUN_EVERY_HOURS", "6"))
MAX_SOURCE_POSTS = int(os.getenv("MAX_SOURCE_POSTS", "30"))
STYLE_FILE = os.getenv("STYLE_FILE", "style.txt")
DB_PATH = os.getenv("DB_PATH", "bot.db")

# Микс форматов: "тип:вес,тип:вес,...". Типы: podborka, single, engagement, seasonal, poll
DEFAULT_MIX = {"podborka": 40, "single": 20, "engagement": 15, "seasonal": 15, "poll": 10}
TYPE_LABELS = {
    "podborka": "🗂 Подборка",
    "single": "🔎 Разбор",
    "engagement": "💬 Вовлечение",
    "seasonal": "🎉 Повод",
}
TYPE_GUIDE = {
    "podborka": "подборка из 2–4 товаров на одну тему или бюджет, с номерами и ссылкой на каждый",
    "single": "подробный разбор одного товара: что это, почему хороший подарок, кому подойдёт",
    "engagement": "пост-вовлечение БЕЗ товаров — вопрос к аудитории, который вызывает комментарии "
                  "(например, «покажите вашу находку», «какой подарок дарили сами», «1 или 2»)",
    "seasonal": "пост под ближайший подходящий повод или праздник — подборка или один товар под конкретную дату",
}


def parse_mix(raw: str) -> dict[str, int]:
    result = {}
    for part in raw.split(","):
        part = part.strip()
        if not part or ":" not in part:
            continue
        key, _, weight = part.partition(":")
        key = key.strip().lower()
        if key in TYPE_GUIDE or key == "poll":
            try:
                result[key] = max(0, int(weight.strip()))
            except ValueError:
                continue
    return result or DEFAULT_MIX


CONTENT_MIX = parse_mix(os.getenv("CONTENT_MIX", ""))

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s: %(message)s", level=logging.INFO
)
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("autoposter")

claude = AsyncAnthropic()  # ключ берётся из ANTHROPIC_API_KEY
run_lock = asyncio.Lock()

# ---------------------------------------------------------------- база данных
conn = sqlite3.connect(DB_PATH, check_same_thread=False)
conn.executescript(
    """
    CREATE TABLE IF NOT EXISTS seen (
        post_id TEXT PRIMARY KEY,
        seen_at TEXT
    );
    CREATE TABLE IF NOT EXISTS drafts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic TEXT,
        text TEXT,
        status TEXT DEFAULT 'pending',   -- pending / published / rejected / replaced
        admin_msg_id INTEGER,
        created_at TEXT
    );
    """
)
# Миграции со старых версий
for column, coltype in (
    ("tg_done", "INTEGER DEFAULT 0"),
    ("vk_done", "INTEGER DEFAULT 0"),
    ("kind", "TEXT DEFAULT 'post'"),      # 'post' или 'poll'
    ("poll_options", "TEXT"),             # JSON-список вариантов ответа для опроса
):
    try:
        conn.execute(f"ALTER TABLE drafts ADD COLUMN {column} {coltype}")
    except sqlite3.OperationalError:
        pass  # колонка уже есть
conn.commit()

DRAFT_FIELDS = ("id", "topic", "text", "status", "tg_done", "vk_done", "kind", "poll_options")
DRAFT_SELECT = f"SELECT {', '.join(DRAFT_FIELDS)} FROM drafts"


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def is_seen(post_id: str) -> bool:
    return conn.execute("SELECT 1 FROM seen WHERE post_id=?", (post_id,)).fetchone() is not None


def mark_seen(post_ids: list[str]) -> None:
    conn.executemany("INSERT OR IGNORE INTO seen VALUES (?, ?)", [(p, now()) for p in post_ids])
    conn.commit()


def save_draft(topic: str, text: str, kind: str = "post", poll_options: list[str] | None = None) -> int:
    cur = conn.execute(
        "INSERT INTO drafts (topic, text, kind, poll_options, created_at) VALUES (?, ?, ?, ?, ?)",
        (topic, text, kind, json.dumps(poll_options, ensure_ascii=False) if poll_options else None, now()),
    )
    conn.commit()
    return cur.lastrowid


def get_draft(draft_id: int) -> dict | None:
    row = conn.execute(f"{DRAFT_SELECT} WHERE id=?", (draft_id,)).fetchone()
    return dict(zip(DRAFT_FIELDS, row)) if row else None


def draft_by_admin_msg(msg_id: int) -> dict | None:
    row = conn.execute(f"{DRAFT_SELECT} WHERE admin_msg_id=?", (msg_id,)).fetchone()
    return dict(zip(DRAFT_FIELDS, row)) if row else None


def update_draft(draft_id: int, **fields) -> None:
    cols = ", ".join(f"{k}=?" for k in fields)
    conn.execute(f"UPDATE drafts SET {cols} WHERE id=?", (*fields.values(), draft_id))
    conn.commit()


def recent_published(n: int = 5) -> list[str]:
    rows = conn.execute(
        "SELECT text FROM drafts WHERE (tg_done=1 OR vk_done=1) AND kind='post' ORDER BY id DESC LIMIT ?",
        (n,),
    ).fetchall()
    return [r[0] for r in rows]


# ---------------------------------------------------------------- Telegram-источники
async def fetch_tg_channel(client: httpx.AsyncClient, channel: str) -> list[dict]:
    """Читает веб-превью публичного канала t.me/s/<channel> (последние ~20 постов)."""
    resp = await client.get(
        f"https://t.me/s/{channel}",
        headers={"User-Agent": "Mozilla/5.0 (compatible; autoposter/1.0)"},
        timeout=20,
    )
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    posts = []
    for msg in soup.select(".tgme_widget_message"):
        post_id = msg.get("data-post")
        text_el = msg.select_one(".tgme_widget_message_text")
        if not post_id or not text_el:
            continue  # посты без текста пропускаем
        views_el = msg.select_one(".tgme_widget_message_views")
        posts.append(
            {
                "id": f"tg:{post_id}",
                "source": f"t.me/{channel}",
                "text": text_el.get_text("\n", strip=True),
                "views": views_el.get_text(strip=True) if views_el else "",
            }
        )
    return posts


# ---------------------------------------------------------------- ВКонтакте
async def vk_call(client: httpx.AsyncClient, method: str, token: str, **params):
    params.update(access_token=token, v=VK_API_VERSION)
    resp = await client.post(f"https://api.vk.com/method/{method}", data=params, timeout=20)
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        err = data["error"]
        raise RuntimeError(f"VK {method}: [{err.get('error_code')}] {err.get('error_msg')}")
    return data["response"]


async def fetch_vk_wall(client: httpx.AsyncClient, source: str) -> list[dict]:
    """Последние 20 постов со стены сообщества ВК.
    source: короткое имя (durov), ссылка (vk.com/durov), club123 / public123 или просто 123."""
    name = re.sub(r"^(https?://)?(m\.)?vk\.com/", "", source).strip("/")
    params = {"count": 20, "filter": "owner"}
    m = re.fullmatch(r"(?:club|public)?(\d+)", name)
    if m:
        params["owner_id"] = -int(m.group(1))
    else:
        params["domain"] = name

    resp = await vk_call(client, "wall.get", VK_READ_TOKEN, **params)
    posts = []
    for item in resp.get("items", []):
        text = (item.get("text") or "").strip()
        if not text or item.get("marked_as_ads") or item.get("is_pinned"):
            continue  # пустые, рекламные и закреплённые пропускаем
        posts.append(
            {
                "id": f"vk:{item['owner_id']}_{item['id']}",
                "source": f"vk.com/{name}",
                "text": text,
                "views": str((item.get("views") or {}).get("count", "")),
            }
        )
    return posts


async def vk_publish(text: str) -> str:
    """Публикует пост на стену сообщества от имени группы. Возвращает ссылку."""
    message = f"{text}\n\n{VK_SUFFIX}" if VK_SUFFIX else text
    async with httpx.AsyncClient() as client:
        resp = await vk_call(
            client, "wall.post", VK_TOKEN,
            owner_id=f"-{VK_GROUP_ID}", from_group=1, message=message,
        )
    return f"https://vk.com/wall-{VK_GROUP_ID}_{resp['post_id']}"


# ---------------------------------------------------------------- Claude: текстовые посты
SYSTEM_PROMPT = """Ты — редактор канала в Telegram и сообщества во ВКонтакте и пишешь оригинальные посты на русском языке.

Правила:
- Не копируй и не пересказывай чужие посты близко к тексту. Посты-источники — только ориентир по темам и тому, что интересно аудитории.
- Не выдумывай факты, цифры, цитаты, имена и ссылки. Если для темы нужны свежие данные, которых нет в источниках, пиши так, чтобы не утверждать непроверенное.
- Пиши обычным текстом, без Markdown и HTML-разметки.
- Длина поста — до 1500 знаков.
- Сегодняшняя дата: {today}.

Описание канала и стиля:
{style}"""


def load_style() -> str:
    try:
        with open(STYLE_FILE, encoding="utf-8") as f:
            return f.read().strip()
    except FileNotFoundError:
        return "Стиль не задан: пиши живо, по делу, без воды."


async def ask_claude(prompt: str, max_tokens: int = 4000) -> str:
    resp = await claude.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=max_tokens,
        system=SYSTEM_PROMPT.format(style=load_style(), today=datetime.now().strftime("%d.%m.%Y")),
        messages=[{"role": "user", "content": prompt}],
    )
    return "".join(b.text for b in resp.content if b.type == "text").strip()


def parse_json_block(raw: str, opener: str, closer: str):
    start, end = raw.find(opener), raw.rfind(closer)
    if start == -1 or end == -1:
        raise ValueError(f"Claude вернул не JSON: {raw[:300]}")
    return json.loads(raw[start : end + 1])


def parse_json_list(raw: str) -> list[dict]:
    data = parse_json_block(raw, "[", "]")
    return [d for d in data if isinstance(d, dict) and d.get("text")]


async def generate_drafts(source_posts: list[dict], examples: list[str], types: list[str]) -> list[dict]:
    """types — список запрошенных форматов (podborka/single/engagement/seasonal), может повторяться."""
    counts = Counter(types)
    type_lines = "\n".join(f"- {TYPE_LABELS.get(t, t)} ({t}) × {n}: {TYPE_GUIDE[t]}" for t, n in counts.items())

    sources = "\n\n---\n\n".join(
        f"[{p['source']}, просмотры: {p['views'] or '?'}]\n{p['text'][:1500]}"
        for p in source_posts
    ) or "(источники сейчас недоступны, ориентируйся на общие темы ниши)"
    ex = "\n\n---\n\n".join(e[:1200] for e in examples) or "(примеров пока нет)"

    prompt = f"""Вот свежие посты из каналов и сообществ на близкие темы (Telegram и ВКонтакте):

<sources>
{sources}
</sources>

Вот примеры моих постов (ориентир по стилю):

<examples>
{ex}
</examples>

Напиши ровно {sum(counts.values())} постов следующих форматов:
{type_lines}

Ответь ТОЛЬКО JSON-массивом, без пояснений, в поле "type" укажи код формата (podborka/single/engagement/seasonal):
[{{"type": "podborka", "topic": "короткое название темы", "text": "готовый текст поста"}}]"""
    return parse_json_list(await ask_claude(prompt))


async def rewrite_draft(text: str, feedback: str | None = None) -> str:
    wish = feedback or "Сделай другой вариант: другой заход и структура, та же тема."
    prompt = f"""Вот черновик поста:

<draft>
{text}
</draft>

Перепиши его. Пожелание: {wish}
Ответь только новым текстом поста, без пояснений."""
    return await ask_claude(prompt, max_tokens=2000)


async def write_on_topic(topic: str) -> str:
    prompt = f"Напиши пост на тему: {topic}\nОтветь только текстом поста, без пояснений."
    return await ask_claude(prompt, max_tokens=2000)


# ---------------------------------------------------------------- Claude: опросы
async def generate_poll(source_posts: list[dict] | None = None, topic: str | None = None) -> dict:
    """Возвращает {"question": str, "options": [str, ...]} — 2–5 коротких вариантов ответа."""
    if topic:
        context = f"Тема опроса: {topic}"
    else:
        sources = "\n\n---\n\n".join(p["text"][:800] for p in (source_posts or [])[:15])
        context = f"Вот свежие посты из каналов-источников для вдохновения:\n\n{sources}" if sources else \
            "Источники сейчас недоступны, придумай опрос по общей теме канала."

    prompt = f"""{context}

Придумай ОДИН опрос для читателей канала/группы про находки и подарки с маркетплейсов.
Вопрос короткий, варианты ответа короткие (2–6 слов каждый), 2–5 вариантов.
Не используй товары и артикулы из источников впрямую — опрос должен быть про предпочтения и опыт читателей.

Ответь ТОЛЬКО JSON-объектом, без пояснений:
{{"question": "текст вопроса", "options": ["вариант 1", "вариант 2", "вариант 3"]}}"""
    data = parse_json_block(await ask_claude(prompt, max_tokens=800), "{", "}")
    options = [str(o)[:100] for o in data.get("options", []) if str(o).strip()][:10]
    if len(options) < 2:
        raise ValueError("Claude вернул опрос меньше чем с 2 вариантами")
    return {"question": str(data.get("question", "Опрос"))[:300], "options": options}


async def rewrite_poll(question: str, options: list[str], feedback: str | None = None) -> dict:
    wish = feedback or "Сделай другой вариант вопроса и вариантов ответа на ту же тему."
    prompt = f"""Вот черновик опроса:

Вопрос: {question}
Варианты: {", ".join(options)}

Перепиши его. Пожелание: {wish}

Ответь ТОЛЬКО JSON-объектом, без пояснений:
{{"question": "текст вопроса", "options": ["вариант 1", "вариант 2"]}}"""
    data = parse_json_block(await ask_claude(prompt, max_tokens=800), "{", "}")
    options = [str(o)[:100] for o in data.get("options", []) if str(o).strip()][:10]
    if len(options) < 2:
        raise ValueError("Claude вернул опрос меньше чем с 2 вариантами")
    return {"question": str(data.get("question", question))[:300], "options": options}


def pick_content_types(n: int) -> list[str]:
    types, weights = zip(*CONTENT_MIX.items())
    return random.choices(types, weights=weights, k=n)


# ---------------------------------------------------------------- черновики и кнопки
def draft_keyboard(d: dict) -> InlineKeyboardMarkup | None:
    did = d["id"]
    is_poll = d["kind"] == "poll"
    started = bool(d["tg_done"] or d["vk_done"])
    rows = []

    platform_row = []
    if TG_ENABLED and not d["tg_done"]:
        platform_row.append(InlineKeyboardButton("📢 В Telegram", callback_data=f"pub_tg:{did}"))
    if VK_ENABLED and not d["vk_done"] and not is_poll:
        platform_row.append(InlineKeyboardButton("🟦 Во ВКонтакте", callback_data=f"pub_vk:{did}"))
    if platform_row:
        rows.append(platform_row)

    if not started:
        if TG_ENABLED and VK_ENABLED and not is_poll:
            rows.append([InlineKeyboardButton("🚀 Везде", callback_data=f"pub_all:{did}")])
        rows.append(
            [
                InlineKeyboardButton("🔄 Другой вариант", callback_data=f"re:{did}"),
                InlineKeyboardButton("❌ Отклонить", callback_data=f"rej:{did}"),
            ]
        )
    elif platform_row:
        rows.append([InlineKeyboardButton("✔️ Готово", callback_data=f"done:{did}")])

    return InlineKeyboardMarkup(rows) if rows else None


async def send_draft(bot, topic: str, text: str) -> None:
    draft_id = save_draft(topic, text, kind="post")
    header = f"📝 Черновик #{draft_id}" + (f" · {topic}" if topic else "")
    body = f"{header}\n\n{text}"[:4000]  # лимит Telegram — 4096 символов
    msg = await bot.send_message(ADMIN_ID, body, reply_markup=draft_keyboard(get_draft(draft_id)))
    update_draft(draft_id, admin_msg_id=msg.message_id)


async def send_poll_draft(bot, poll: dict) -> None:
    draft_id = save_draft("", poll["question"], kind="poll", poll_options=poll["options"])
    options_preview = "\n".join(f"  {i+1}. {o}" for i, o in enumerate(poll["options"]))
    body = f"❓ Черновик опроса #{draft_id}\n\n{poll['question']}\n\n{options_preview}"[:4000]
    msg = await bot.send_message(ADMIN_ID, body, reply_markup=draft_keyboard(get_draft(draft_id)))
    update_draft(draft_id, admin_msg_id=msg.message_id)


def tg_post_link(message_id: int) -> str:
    return f"https://t.me/{TARGET_CHANNEL.lstrip('@')}/{message_id}" if TARGET_CHANNEL.startswith("@") else ""


async def publish(bot, draft: dict, targets: set[str]) -> list[str]:
    report = []

    if draft["kind"] == "poll":
        if "tg" in targets and TG_ENABLED and not draft["tg_done"]:
            try:
                options = json.loads(draft["poll_options"])
                msg = await bot.send_poll(TARGET_CHANNEL, question=draft["text"][:300], options=options, is_anonymous=True)
                update_draft(draft["id"], tg_done=1)
                link = tg_post_link(msg.message_id)
                report.append("✅ Telegram: опрос опубликован" + (f"\n{link}" if link else ""))
            except Exception as e:
                report.append(f"⚠️ Telegram: {e}\nПроверьте, что бот — админ канала с правом публикации.")
        if "vk" in targets:
            report.append("ℹ️ Публикация опросов во ВКонтакте пока не поддерживается ботом — создайте его вручную в сообществе.")
        return report

    if "tg" in targets and TG_ENABLED and not draft["tg_done"]:
        try:
            await bot.send_message(TARGET_CHANNEL, draft["text"])
            update_draft(draft["id"], tg_done=1)
            report.append("✅ Telegram: опубликовано")
        except Exception as e:
            report.append(f"⚠️ Telegram: {e}\nПроверьте, что бот — админ канала с правом публикации.")
    if "vk" in targets and VK_ENABLED and not draft["vk_done"]:
        try:
            link = await vk_publish(draft["text"])
            update_draft(draft["id"], vk_done=1)
            report.append(f"✅ ВКонтакте: {link}")
        except Exception as e:
            report.append(f"⚠️ ВКонтакте: {e}")
    return report


# ---------------------------------------------------------------- основной цикл
async def run_pipeline(bot, manual: bool = False) -> None:
    if run_lock.locked():
        if manual:
            await bot.send_message(ADMIN_ID, "Уже работаю над черновиками, подождите.")
        return

    async with run_lock:
        new_posts: list[dict] = []
        errors: list[str] = []
        examples = recent_published()

        async with httpx.AsyncClient(follow_redirects=True) as client:
            jobs = [("tg", s) for s in TG_SOURCES]
            if VK_READ_TOKEN:
                jobs += [("vk", s) for s in VK_SOURCES]
            for kind, src in jobs:
                try:
                    if kind == "tg":
                        posts = await fetch_tg_channel(client, src)
                    else:
                        posts = await fetch_vk_wall(client, src)
                except Exception as e:
                    log.warning("Не удалось прочитать %s %s: %s", kind, src, e)
                    errors.append(f"{kind}:{src} — {e}")
                    continue
                new_posts += [p for p in posts if not is_seen(p["id"])]

            # Мало своих опубликованных постов — берём примеры стиля из своего TG-канала
            if len(examples) < 3 and TARGET_CHANNEL.startswith("@"):
                try:
                    own = await fetch_tg_channel(client, TARGET_CHANNEL[1:])
                    examples += [p["text"] for p in own[-5:]]
                except Exception:
                    pass

        if manual and errors:
            await bot.send_message(ADMIN_ID, "⚠️ Не прочитались источники:\n" + "\n".join(errors)[:3500])

        if not new_posts:
            log.info("Новых постов нет")
            if manual:
                await bot.send_message(ADMIN_ID, "В источниках нет новых постов с прошлого запуска.")
            return

        batch = new_posts[-MAX_SOURCE_POSTS:]
        log.info("Новых постов: %d, отправляю в Claude %d", len(new_posts), len(batch))

        chosen_types = pick_content_types(DRAFTS_PER_RUN)
        text_types = [t for t in chosen_types if t != "poll"]
        want_poll = "poll" in chosen_types  # максимум один опрос за запуск

        mark_seen([p["id"] for p in new_posts])

        if text_types:
            try:
                drafts = await generate_drafts(batch, examples, text_types)
            except Exception as e:
                log.exception("Ошибка генерации постов")
                await bot.send_message(ADMIN_ID, f"⚠️ Ошибка генерации: {e}")
                drafts = []
            for d in drafts:
                label = TYPE_LABELS.get(d.get("type", ""), "")
                topic = f"{label} · {d.get('topic', '')}".strip(" ·")
                await send_draft(bot, topic, d["text"])

        if want_poll:
            try:
                poll = await generate_poll(batch)
                await send_poll_draft(bot, poll)
            except Exception as e:
                log.exception("Ошибка генерации опроса")
                await bot.send_message(ADMIN_ID, f"⚠️ Ошибка генерации опроса: {e}")


# ---------------------------------------------------------------- обработчики
HELP = """Я готовлю посты для вашего канала{vk}, чередуя форматы: подборки, разбор товара, вовлечение, повод и опросы.

/run — собрать свежие посты из источников и написать черновики сейчас
/topic <тема> — написать пост на заданную тему
/poll [тема] — написать опрос (тема необязательна)
/status — какие площадки, источники и микс форматов подключены

Под каждым черновиком есть кнопки публикации. Чтобы попросить правки, ответьте (reply) на черновик текстом, например: «сделай короче и добавь пример»."""


def is_admin(update: Update) -> bool:
    return bool(update.effective_user and update.effective_user.id == ADMIN_ID)


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if is_admin(update):
        await update.message.reply_text(HELP.format(vk=" и сообщества ВК" if VK_ENABLED else ""))


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_admin(update):
        return
    mix = ", ".join(f"{TYPE_LABELS.get(t, t)} {w}%" for t, w in CONTENT_MIX.items())
    lines = [
        f"Telegram-канал: {TARGET_CHANNEL if TG_ENABLED else 'не настроен'}",
        f"ВК-сообщество: {'vk.com/club' + VK_GROUP_ID if VK_ENABLED else 'не настроено'}",
        f"Источники TG: {', '.join(TG_SOURCES) or '—'}",
        f"Источники ВК: {', '.join(VK_SOURCES) or '—'}"
        + ("" if VK_READ_TOKEN or not VK_SOURCES else " (нет токена для чтения!)"),
        f"Микс форматов: {mix}",
        f"Запуск каждые {RUN_EVERY_HOURS:g} ч, черновиков за раз: {DRAFTS_PER_RUN}",
    ]
    await update.message.reply_text("\n".join(lines))


async def cmd_run(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_admin(update):
        return
    await update.message.reply_text("Собираю посты и пишу черновики…")
    await run_pipeline(context.bot, manual=True)


async def cmd_topic(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_admin(update):
        return
    topic = " ".join(context.args).strip()
    if not topic:
        await update.message.reply_text("Использование: /topic тема поста")
        return
    await context.bot.send_chat_action(ADMIN_ID, ChatAction.TYPING)
    await send_draft(context.bot, topic, await write_on_topic(topic))


async def cmd_poll(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_admin(update):
        return
    topic = " ".join(context.args).strip() or None
    await context.bot.send_chat_action(ADMIN_ID, ChatAction.TYPING)
    try:
        poll = await generate_poll(topic=topic)
    except Exception as e:
        await update.message.reply_text(f"⚠️ Не получилось сгенерировать опрос: {e}")
        return
    await send_poll_draft(context.bot, poll)


async def on_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    q = update.callback_query
    if q.from_user.id != ADMIN_ID:
        await q.answer("Нет доступа", show_alert=True)
        return

    action, raw_id = q.data.split(":", 1)
    draft = get_draft(int(raw_id))
    if not draft or draft["status"] != "pending":
        await q.answer("Этот черновик уже обработан")
        return
    await q.answer()

    if action.startswith("pub_"):
        targets = {"pub_tg": {"tg"}, "pub_vk": {"vk"}, "pub_all": {"tg", "vk"}}[action]
        report = await publish(context.bot, draft, targets)
        draft = get_draft(draft["id"])
        if draft["kind"] == "poll":
            all_done = draft["tg_done"] or not TG_ENABLED
        else:
            all_done = (not TG_ENABLED or draft["tg_done"]) and (not VK_ENABLED or draft["vk_done"])
        if all_done:
            update_draft(draft["id"], status="published")
            await q.edit_message_reply_markup(reply_markup=None)
        else:
            await q.edit_message_reply_markup(reply_markup=draft_keyboard(draft))
        await q.message.reply_text(f"Черновик #{draft['id']}:\n" + "\n".join(report))

    elif action == "done":
        update_draft(draft["id"], status="published")
        await q.edit_message_reply_markup(reply_markup=None)

    elif action == "rej":
        update_draft(draft["id"], status="rejected")
        await q.edit_message_reply_markup(reply_markup=None)
        await q.message.reply_text(f"❌ Черновик #{draft['id']} отклонён")

    elif action == "re":
        update_draft(draft["id"], status="replaced")
        await q.edit_message_reply_markup(reply_markup=None)
        await context.bot.send_chat_action(ADMIN_ID, ChatAction.TYPING)
        if draft["kind"] == "poll":
            try:
                poll = await rewrite_poll(draft["text"], json.loads(draft["poll_options"]))
                await send_poll_draft(context.bot, poll)
            except Exception as e:
                await q.message.reply_text(f"⚠️ Не получилось переписать опрос: {e}")
        else:
            await send_draft(context.bot, draft["topic"], await rewrite_draft(draft["text"]))


async def on_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Ответ (reply) на черновик = просьба о правках."""
    if not is_admin(update):
        return
    msg = update.message
    if not msg.reply_to_message:
        await msg.reply_text("Чтобы поправить черновик, ответьте (reply) на сообщение с ним.")
        return

    draft = draft_by_admin_msg(msg.reply_to_message.message_id)
    if not draft or draft["status"] != "pending":
        await msg.reply_text("Это не активный черновик.")
        return
    if draft["tg_done"] or draft["vk_done"]:
        await msg.reply_text("Этот черновик уже частично опубликован — попросите новый через /topic или /poll.")
        return

    update_draft(draft["id"], status="replaced")
    await context.bot.edit_message_reply_markup(
        ADMIN_ID, msg.reply_to_message.message_id, reply_markup=None
    )
    await context.bot.send_chat_action(ADMIN_ID, ChatAction.TYPING)

    if draft["kind"] == "poll":
        try:
            poll = await rewrite_poll(draft["text"], json.loads(draft["poll_options"]), msg.text)
            await send_poll_draft(context.bot, poll)
        except Exception as e:
            await msg.reply_text(f"⚠️ Не получилось переписать опрос: {e}")
    else:
        await send_draft(context.bot, draft["topic"], await rewrite_draft(draft["text"], msg.text))


async def on_error(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    log.error("Ошибка при обработке апдейта", exc_info=context.error)
    try:
        await context.bot.send_message(ADMIN_ID, f"⚠️ Ошибка: {context.error}")
    except Exception:
        pass


async def scheduled_job(context: ContextTypes.DEFAULT_TYPE) -> None:
    await run_pipeline(context.bot)


def main() -> None:
    if not (TG_ENABLED or VK_ENABLED):
        raise SystemExit("Укажите TARGET_CHANNEL и/или VK_TOKEN + VK_GROUP_ID в .env")
    if not (TG_SOURCES or VK_SOURCES):
        raise SystemExit("Укажите источники: SOURCE_CHANNELS и/или VK_SOURCES в .env")
    if VK_SOURCES and not VK_READ_TOKEN:
        log.warning("VK_SOURCES заданы, но нет VK_READ_TOKEN/VK_TOKEN — ВК-источники читаться не будут")

    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler(["start", "help"], cmd_start))
    app.add_handler(CommandHandler("status", cmd_status))
    app.add_handler(CommandHandler("run", cmd_run))
    app.add_handler(CommandHandler("topic", cmd_topic))
    app.add_handler(CommandHandler("poll", cmd_poll))
    app.add_handler(CallbackQueryHandler(on_button))
    app.add_handler(
        MessageHandler(filters.TEXT & ~filters.COMMAND & filters.ChatType.PRIVATE, on_text)
    )
    app.add_error_handler(on_error)

    app.job_queue.run_repeating(scheduled_job, interval=RUN_EVERY_HOURS * 3600, first=60)

    log.info(
        "Бот запущен. Площадки: %s. Источники TG: %s; ВК: %s. Микс: %s",
        ", ".join(p for p, on in (("Telegram", TG_ENABLED), ("ВК", VK_ENABLED)) if on),
        ", ".join(TG_SOURCES) or "—",
        ", ".join(VK_SOURCES) or "—",
        CONTENT_MIX,
    )
    app.run_polling()


if __name__ == "__main__":
    main()
