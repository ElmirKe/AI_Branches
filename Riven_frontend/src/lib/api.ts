const DEFAULT_REPLY =
  "Начните с трёх вещей: кто ваш первый пользователь, какую единственную проблему вы решаете, и как вы поймёте, что решение сработало.";

const PLAN_REPLY = [
  "Вот план из четырёх шагов:",
  "1. Определить проблему и аудиторию",
  "2. Собрать минимальную версию продукта",
  "3. Найти первых пользователей",
  "4. Собрать обратную связь и решить, что дальше",
].join("\n");

const PLAN_WORDS = ["план", "шаги", "этапы", "варианты", "разбей"];

/** Заглушка ИИ: один и тот же ответ, кроме просьб о плане/шагах. */
export function generateReply(userText: string): string {
  const t = userText.toLowerCase();
  return PLAN_WORDS.some((w) => t.includes(w)) ? PLAN_REPLY : DEFAULT_REPLY;
}

/** Имитация сетевой задержки 500–1000 мс. */
export function replyDelay(): number {
  return 500 + Math.random() * 500;
}

const ITEM_RE = /^\s*(\d+[.)]|[-–—•*]\s)/;
const STRIP_RE = /^\s*(\d+[.)]\s*|[-–—•*]\s+)/;

/**
 * Возвращает пункты списка, если в тексте есть 2+ строки-пункта подряд
 * (пустые строки между ними допустимы). Иначе — пустой массив.
 */
export function detectList(text: string): string[] {
  let best: string[] = [];
  let run: string[] = [];
  for (const line of text.split("\n")) {
    if (ITEM_RE.test(line)) {
      run.push(line.replace(STRIP_RE, "").trim());
    } else if (line.trim() !== "") {
      if (run.length > best.length) best = run;
      run = [];
    }
  }
  if (run.length > best.length) best = run;
  return best.length >= 2 ? best : [];
}
