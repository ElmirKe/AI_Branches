/**
 * Локальная «короткая выжимка» — запасной вариант, пока настоящее название
 * (по смыслу) не пришло от ИИ, или если сервер недоступен.
 */

const FILLER = new Set([
  "вот", "это", "эти", "как", "что", "ну", "привет", "здравствуйте", "пожалуйста", "мне", "нужно", "надо",
  "можешь", "можете", "можно", "хочу", "помоги", "помогите", "расскажи", "скажи", "и", "а", "но", "я",
  "please", "hi", "hello", "the", "a", "an", "how", "what", "can", "you", "i", "me", "to",
]);

export function shortTitle(text: string, maxWords = 4): string {
  const firstLine = text.split("\n").find((l) => l.trim() !== "") ?? "";
  const cleaned = firstLine
    .replace(/^[\s#>*\-–—•\d.)]+/, "") // маркеры списков и заголовков
    .replace(/[«»"'“”„`*_?!.:;,()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter(Boolean);
  let start = 0;
  while (start < words.length - 1 && FILLER.has(words[start].toLowerCase())) start++;
  const picked = words.slice(start, start + maxWords).join(" ");
  if (!picked) return "Новый чат";
  return picked.charAt(0).toUpperCase() + picked.slice(1);
}
