/** Распознавание нумерованных списков в ответе ИИ (для кнопки «Разложить»). */

/** Строка-пункт: «1. …», «1) …», «**1. …**», «### 1. …», «**1.** …». Отступ не больше 3 пробелов. */
const ITEM_RE = /^ {0,3}(?:#{1,6}\s+)?(?:\*\*|__)?(\d{1,2})[.)](?:\*\*|__)?\s+(.+)$/;

/** Убирает Markdown-оформление из заголовка пункта. */
function cleanItem(s: string): string {
  return s
    .replace(/\*\*|__/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .replace(/[:：]\s*$/, "")
    .trim();
}

/**
 * Пункты нумерованного списка верхнего уровня (2+ пункта с номерами подряд: 1, 2, 3…).
 * Пояснения, подпункты и пустые строки между пунктами список не обрывают:
 * список заканчивается, только когда нумерация сбилась или началась заново.
 */
export function detectList(text: string): string[] {
  const clean = text.replace(/```[\s\S]*?```/g, ""); // нумерация внутри кода не считается
  const runs: string[][] = [];
  let run: string[] = [];
  let expect = 0;
  for (const line of clean.split("\n")) {
    const m = ITEM_RE.exec(line);
    if (!m) continue;
    const n = Number(m[1]);
    const item = cleanItem(m[2]);
    if (run.length > 0 && n === expect) {
      run.push(item);
      expect = n + 1;
    } else {
      if (run.length > 0) runs.push(run);
      run = [item];
      expect = n + 1;
    }
  }
  if (run.length > 0) runs.push(run);
  const best = runs.reduce<string[]>((a, r) => (r.length > a.length ? r : a), []);
  return best.length >= 2 ? best.filter((x) => x !== "") : [];
}
