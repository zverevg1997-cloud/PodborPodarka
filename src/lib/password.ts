import bcrypt from "bcryptjs";

/** Стоимость bcrypt. 12 — примерно четверть секунды на наших мощностях. */
const COST = 12;

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Пароли, которые встречаются в утечках чаще всего, и их русские аналоги,
 * набранные в латинской раскладке. Список намеренно короткий: он ловит не
 * «слабые» пароли вообще, а те несколько десятков, которые проверяются
 * перебором в первую же минуту.
 *
 * Раньше эту проверку делал Supabase, сверяясь с базой утечек. Своего
 * обращения к внешнему сервису мы не делаем: список локальный, работает
 * всегда и ничего наружу не отправляет.
 */
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "passw0rd", "p@ssword", "p@ssw0rd",
  "qwerty", "qwerty123", "qwertyui", "qwerty12345", "asdfgh", "asdfghjk",
  "zxcvbn", "zxcvbnm", "1q2w3e4r", "1q2w3e4r5t", "q1w2e3r4", "qazwsx",
  "123456", "1234567", "12345678", "123456789", "1234567890", "12345678910",
  "111111", "1111111111", "000000", "0000000000", "123123", "123321",
  "654321", "112233", "121212", "789456", "159753", "147258369",
  "iloveyou", "sunshine", "princess", "football", "baseball", "superman",
  "batman", "welcome", "monkey", "dragon", "master", "shadow", "letmein",
  "trustno1", "starwars", "whatever", "freedom", "hello123", "abc123",
  "admin", "admin123", "administrator", "root", "toor", "guest", "test",
  "test123", "user", "user123", "login", "secret", "changeme", "default",
  // Русские слова в латинской раскладке — здесь они встречаются постоянно.
  "ghbdtn", "gfhjkm", "ljvfiybq", "rjirf", "yfnfif", "fylhtq", "cthutq",
  "vfrcbv", "lvbnhbq", "tktyf", "fktrctq", "rhfcjnf", "ke,k.", "vfvf",
  "solnyshko", "privet", "parol", "parol123", "lubov", "natasha", "sergey",
  "andrey", "dmitriy", "alexey", "maksim", "marina", "nastya", "katya",
  "liverpool", "arsenal", "spartak", "zenit", "dinamo", "cska",
  "daribot", "podarok", "podarki", "gift", "gifts",
]);

/**
 * Проверяет пароль на очевидную слабость. Возвращает текст ошибки или null.
 *
 * Email передаём отдельно: пароль, совпадающий с именем почтового ящика,
 * подбирается первым же запросом, а формально он «сложный».
 */
export function validatePassword(
  password: string,
  email?: string,
): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Пароль слишком короткий — нужно минимум ${MIN_PASSWORD_LENGTH} символов`;
  }

  if (password.length > 72) {
    // bcrypt обрезает всё после 72 байт: длинный пароль тихо перестал бы
    // защищать дальше этой границы, а человек об этом бы не узнал.
    return "Пароль слишком длинный — не больше 72 символов";
  }

  const lower = password.toLowerCase();

  if (COMMON_PASSWORDS.has(lower)) {
    return "Этот пароль слишком часто встречается в утечках. Придумайте другой.";
  }

  if (/^(.)\1+$/.test(password)) {
    return "Пароль из одного повторяющегося символа не подойдёт";
  }

  if (/^\d+$/.test(password)) {
    return "Пароль из одних цифр подбирается за секунды. Добавьте буквы.";
  }

  const localPart = email?.split("@")[0]?.toLowerCase();
  if (localPart && localPart.length >= 3 && lower.includes(localPart)) {
    return "Пароль не должен повторять адрес почты";
  }

  return null;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

/**
 * Сверяет пароль с хэшем. Понимает и хэши, перенесённые из Supabase:
 * там формат $2a$, у нас новые пишутся как $2b$, отличие в них
 * несущественное и библиотека читает оба.
 */
export function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
