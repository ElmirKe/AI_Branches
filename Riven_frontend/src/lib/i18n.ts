import { useSyncExternalStore } from "react";

/**
 * Языки интерфейса. Выбранный язык хранится в браузере (localStorage) и
 * отправляется на сервер: ИИ отвечает на нём, пока пользователь сам не попросит другой.
 */
export type Lang = "ru" | "en";
export const LANGS: { id: Lang; label: string }[] = [
  { id: "ru", label: "Русский" },
  { id: "en", label: "English" },
];

const KEY = "riven.lang";

function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "ru" || saved === "en") return saved;
  } catch {
    /* хранилище недоступно */
  }
  return "ru";
}

let current: Lang = initial();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang) {
  if (lang === current) return;
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* не страшно: язык просто не запомнится */
  }
  document.documentElement.lang = lang;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Текущий язык; компонент перерисуется при смене языка. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}

/** Склонение: русские три формы или английские две. */
export function countWord(n: number, lang: Lang, ru: [string, string, string], en: [string, string]): string {
  if (lang === "en") return `${n} ${n === 1 ? en[0] : en[1]}`;
  const m10 = n % 10;
  const m100 = n % 100;
  const w = m10 === 1 && m100 !== 11 ? ru[0] : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? ru[1] : ru[2];
  return `${n} ${w}`;
}

const ru = {
  newChat: "Новый чат",
  newChatBtn: "+ Новый чат",
  empty: "пусто",
  messages: (n: number) => countWord(n, "ru", ["сообщение", "сообщения", "сообщений"], ["", ""]),
  saving: "Сохраняем…",
  saveError: "Не удалось сохранить, повторяем…",
  saved: "Сохранено",
  signOut: "Выйти",
  settings: "Настройки",
  close: "Закрыть",
  account: "Аккаунт",
  loggedInAs: "Вы вошли как",
  localMode: "Вход не настроен: чаты хранятся только в этой вкладке.",
  appearance: "Тема",
  light: "Светлая",
  dark: "Тёмная",
  layout: "Расположение веток",
  horizontal: "Горизонтально",
  vertical: "Вертикально",
  horizontalHint: "Дерево растёт слева направо",
  verticalHint: "Дерево растёт сверху вниз",
  language: "Язык",
  languageHint: "Интерфейс и ответы ИИ. ИИ отвечает на этом языке, пока вы сами не попросите другой.",
  you: "Вы",
  assistant: "Ассистент",
  merge: "Слияние",
  typing: "Печатает…",
  expandList: (n: number) => `Разложить (${n})`,
  collapse: "Свернуть",
  mergedCount: (n: number) => `Слитые (${n})`,
  mainBranch: "Основная",
  family: "Семья",
  merged: "Слитые",
  modelSees: (n: number) =>
    `Модель видит только эту линию: ${countWord(n, "ru", ["сообщение", "сообщения", "сообщений"], ["", ""])} от начала.`,
  forcedTitle: "Точка уже продолжена. Введите сообщение, оно откроет новую ветку",
  forcedNote: "Точка уже продолжена, сообщение откроет новую ветку",
  newBranchNote: "Новая ветка от этого узла",
  branch: "Ответвить",
  combine: "Свести",
  send: "Отправить",
  branchPlaceholder: "Сообщение новой ветки…",
  continuePlaceholder: "Продолжить ветку… (Enter отправляет, Shift+Enter переносит строку)",
  mergeHint: (b: string, avail: number, chosen: number) =>
    `Отметьте сестёр ветки «${b}» на холсте: доступно ${avail}, выбрано ${chosen}`,
  mergeBtn: (n: number) => (n > 0 ? `Свести ${countWord(n + 1, "ru", ["ветку", "ветки", "веток"], ["", ""])}` : "Свести"),
  cancel: "Отмена",
  startTitle: "Начните разговор",
  startText: "Любой ответ можно продолжить или ответвить. Так вы исследуете несколько направлений одного вопроса и не теряете нить.",
  startPlaceholder: "Например: как спланировать запуск нового продукта?",
  start: "Начать",
  canvasHint: "Кликните карточку, чтобы открыть ветку. Модель видит только путь от корня до неё.",
  treeDirection: "Направление дерева",
  loadingChats: "Загружаем ваши чаты…",
  loading: "Загрузка…",
  // вход
  authSub: "Чаты-деревья с ветками. Войдите, чтобы ваши чаты сохранялись.",
  email: "Почта",
  password: "Пароль",
  wait: "Подождите…",
  signIn: "Войти",
  signUp: "Зарегистрироваться",
  toSignUp: "Нет аккаунта? Зарегистрироваться",
  toSignIn: "Уже есть аккаунт? Войти",
  checkMail: "Мы отправили письмо со ссылкой. Подтвердите почту и затем войдите.",
  errBadLogin: "Неверная почта или пароль.",
  errExists: "Эта почта уже зарегистрирована. Войдите.",
  errShort: "Пароль слишком короткий: нужно минимум 6 символов.",
  errNotConfirmed: "Почта не подтверждена: откройте письмо от Supabase и перейдите по ссылке.",
  errRate: "Слишком много попыток. Подождите минуту и повторите.",
  errEmail: "Проверьте адрес почты.",
  errNetwork: "Нет связи с сервером. Проверьте интернет.",
  errSignIn: "Не удалось выполнить вход.",
  // ответы
  errTimeout: "Сервер не ответил за 60 секунд.",
  errConnect: (url: string) => `Не удалось связаться с сервером (${url}). Он запущен? Адрес сайта указан в ALLOWED_ORIGINS?`,
  errStatus: (code: number) => `Сервер ответил ошибкой ${code}.`,
  errEmpty: "Сервер вернул пустой ответ.",
  errReply: "Не удалось получить ответ.",
  mergeText: (names: string) => `Свод веток: ${names}.`,
  mergeBranch: "Свод",
};

type Dict = typeof ru;

const en: Dict = {
  newChat: "New chat",
  newChatBtn: "+ New chat",
  empty: "empty",
  messages: (n) => countWord(n, "en", ["", "", ""], ["message", "messages"]),
  saving: "Saving…",
  saveError: "Couldn't save, retrying…",
  saved: "Saved",
  signOut: "Sign out",
  settings: "Settings",
  close: "Close",
  account: "Account",
  loggedInAs: "Signed in as",
  localMode: "Sign-in is not set up: chats live only in this tab.",
  appearance: "Theme",
  light: "Light",
  dark: "Dark",
  layout: "Branch layout",
  horizontal: "Horizontal",
  vertical: "Vertical",
  horizontalHint: "The tree grows left to right",
  verticalHint: "The tree grows top to bottom",
  language: "Language",
  languageHint: "Interface and AI replies. The AI answers in this language until you ask it for another one.",
  you: "You",
  assistant: "Assistant",
  merge: "Merge",
  typing: "Typing…",
  expandList: (n) => `Split (${n})`,
  collapse: "Collapse",
  mergedCount: (n) => `Merged (${n})`,
  mainBranch: "Main",
  family: "Family",
  merged: "Merged",
  modelSees: (n) => `The model sees only this line: ${countWord(n, "en", ["", "", ""], ["message", "messages"])} from the start.`,
  forcedTitle: "This point already continues. Type a message and it will open a new branch",
  forcedNote: "This point already continues, your message will open a new branch",
  newBranchNote: "New branch from this node",
  branch: "Branch",
  combine: "Merge",
  send: "Send",
  branchPlaceholder: "Message for the new branch…",
  continuePlaceholder: "Continue the branch… (Enter sends, Shift+Enter adds a line)",
  mergeHint: (b, avail, chosen) => `Select sisters of the "${b}" branch on the canvas: ${avail} available, ${chosen} selected`,
  mergeBtn: (n) => (n > 0 ? `Merge ${n + 1} branches` : "Merge"),
  cancel: "Cancel",
  startTitle: "Start a conversation",
  startText: "Any answer can be continued or branched, so you can explore several directions of one question without losing the thread.",
  startPlaceholder: "For example: how do I plan a new product launch?",
  start: "Start",
  canvasHint: "Click a card to open its branch. The model sees only the path from the root to it.",
  treeDirection: "Tree direction",
  loadingChats: "Loading your chats…",
  loading: "Loading…",
  authSub: "Tree-shaped chats with branches. Sign in to keep your chats.",
  email: "Email",
  password: "Password",
  wait: "Please wait…",
  signIn: "Sign in",
  signUp: "Sign up",
  toSignUp: "No account? Sign up",
  toSignIn: "Already have an account? Sign in",
  checkMail: "We sent you a link. Confirm your email, then sign in.",
  errBadLogin: "Wrong email or password.",
  errExists: "This email is already registered. Please sign in.",
  errShort: "The password is too short: at least 6 characters.",
  errNotConfirmed: "Email not confirmed: open the email from Supabase and follow the link.",
  errRate: "Too many attempts. Wait a minute and try again.",
  errEmail: "Check the email address.",
  errNetwork: "No connection to the server. Check your internet.",
  errSignIn: "Couldn't sign in.",
  errTimeout: "The server didn't answer within 60 seconds.",
  errConnect: (url) => `Couldn't reach the server (${url}). Is it running? Is the site address listed in ALLOWED_ORIGINS?`,
  errStatus: (code) => `The server returned error ${code}.`,
  errEmpty: "The server returned an empty answer.",
  errReply: "Couldn't get an answer.",
  mergeText: (names) => `Merged branches: ${names}.`,
  mergeBranch: "Merge",
};

const DICTS: Record<Lang, Dict> = { ru, en };

/** Словарь для текущего языка вне React (запросы, сообщения об ошибках). */
export function tr(lang: Lang = current): Dict {
  return DICTS[lang];
}

/** Словарь в компоненте; перерисовывается при смене языка. */
export function useT(): Dict {
  return DICTS[useLang()];
}

/** Названия, которые сайт создаёт сам (а не ИИ), показываем на текущем языке. */
export function displayTitle(title: string, lang: Lang): string {
  return title === ru.newChat || title === en.newChat ? DICTS[lang].newChat : title;
}

export function displayBranch(branch: string, lang: Lang): string {
  return branch === ru.mainBranch ? DICTS[lang].mainBranch : branch;
}
