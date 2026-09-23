/**
 * Supabase отдаёт сообщения об ошибках только на английском, и они попадали
 * прямо на форму. Здесь переводим то, с чем человек реально сталкивается.
 *
 * Сопоставляем по подстроке, а не по полному совпадению: формулировки в
 * Supabase меняются от версии к версии, а ключевые слова остаются.
 */
const TRANSLATIONS: Array<[RegExp, string]> = [
  [
    /invalid login credentials/i,
    "Неверная почта или пароль",
  ],
  [
    /email not confirmed/i,
    "Почта не подтверждена. Откройте ссылку из письма, которое мы отправили при регистрации.",
  ],
  [
    /user already registered|already been registered/i,
    "Аккаунт с такой почтой уже существует. Войдите или восстановите пароль.",
  ],
  [
    // Минимальная длина задана в настройках Supabase (сейчас 8). Если будете
    // её менять — поправьте и это сообщение, и minLength на форме.
    /password should be at least (\d+)/i,
    "Пароль слишком короткий — нужно минимум 8 символов",
  ],
  [
    /unable to validate email address|invalid format/i,
    "Проверьте адрес почты: похоже, в нём опечатка",
  ],
  [
    /signup requires a valid password|password.*required/i,
    "Укажите пароль",
  ],
  [
    /error sending confirmation email|error sending/i,
    "Не удалось отправить письмо на этот адрес. Попробуйте другой или напишите нам.",
  ],
  [
    /email rate limit exceeded|over_email_send_rate_limit/i,
    "Слишком много писем за короткое время. Подождите немного и попробуйте снова.",
  ],
  [
    /for security purposes.*(\d+) seconds/i,
    "Слишком частые попытки. Подождите минуту и попробуйте снова.",
  ],
  [
    /email logins are disabled|signups not allowed|email signups are disabled/i,
    "Регистрация по почте временно отключена",
  ],
  [
    /weak password/i,
    "Слишком простой пароль — добавьте цифры или буквы другого регистра",
  ],
];

/**
 * Переводит сообщение Supabase на русский. Незнакомое сообщение не показываем
 * человеку вовсе: английский текст про «credentials» ему ничем не поможет,
 * а в логах оригинал остаётся.
 */
export function translateAuthError(
  message: string | undefined,
  fallback: string,
): string {
  if (!message) return fallback;

  for (const [pattern, translation] of TRANSLATIONS) {
    if (pattern.test(message)) return translation;
  }

  console.error("Непереведённая ошибка Supabase:", message);
  return fallback;
}
