# Как запустить сайт с настоящим ИИ

Два процесса, два окна: **backend** (Java, говорит с Gemini) и **frontend** (сайт).
Сайт отправляет на backend только «родословную» ветки (путь от корня до вопроса) —
соседние ветки ИИ не видит.

> Backend пока **ничего не сохраняет** и не использует PostgreSQL: дерево чатов живёт
> в браузере, как и раньше. Подключение БД (схема в `001_*.sql`) — следующий шаг.

## 1. Backend

Нужны: JDK (в `pom.xml` указана версия 22) и ключ Gemini.

**Вариант А — IntelliJ IDEA (проще всего).** Откройте проект, `Run → Edit Configurations`
для `Main`, в поле *Environment variables* впишите `GEMINI_API_KEY=ваш_ключ`, нажмите Run.

**Вариант Б — терминал (PowerShell), из корня репозитория:**

```powershell
$env:GEMINI_API_KEY="ваш_ключ"
mvn compile exec:java "-Dexec.mainClass=org.example.Main" "-Dmaven.compiler.release=17"
```

(`-Dmaven.compiler.release=17` нужен, если у вас JDK ниже 22, а в `pom.xml` указана 22.)

Должно появиться `AI Chat backend запущен: http://localhost:8080/api/health`.
Проверка: откройте http://localhost:8080/api/health — увидите `{"status":"ok"}`.

Настройки (переменные окружения, все необязательные, кроме ключа):

| Переменная        | Что делает                                                     | По умолчанию            |
|-------------------|----------------------------------------------------------------|-------------------------|
| `GEMINI_API_KEY`  | ключ Gemini (**обязателен**, хранится только на сервере)        | —                       |
| `PORT`            | порт сервера                                                   | `8080`                  |
| `GEMINI_MODELS`   | модели Gemini по очереди: если первая перегружена (503), берётся следующая | `gemini-flash-lite-latest,gemini-3.1-flash-lite,gemini-2.5-flash-lite` |
| `ALLOWED_ORIGINS` | адреса сайта, которым разрешено обращаться к серверу (через запятую) | `http://localhost:5173` |

## 2. Frontend (в другом окне терминала)

```powershell
cd Riven_frontend
copy .env.example .env.local
npm install
npm run dev
```

Откройте http://localhost:5173 и напишите сообщение — ответит настоящий ИИ.
Если файла `.env.local` нет, сайт работает на заглушке без сервера.

## Если что-то не работает

- В узле появилось «⚠ Не удалось связаться с сервером» — backend не запущен, или порт другой,
  или адрес сайта не указан в `ALLOWED_ORIGINS`.
- «⚠ ИИ сейчас недоступен или перегружен» — Google отвечает 503/429 на все модели из списка;
  подождите минуту или задайте другие модели в `GEMINI_MODELS`. Подробности — в окне backend (строки `[gemini]`).
- «⚠ Gemini не принял ключ» — неверный/отозванный `GEMINI_API_KEY`.
- После изменения `.env.local` перезапустите `npm run dev`.

## API (для справки)

```
GET  /api/health
POST /api/chat
     {"messages":[{"role":"user","content":"..."},{"role":"assistant","content":"..."}, ...]}
     последнее сообщение — от пользователя
  -> 200 {"answer":"..."}   |   400/413/502 {"error":"..."}
```

## Чтобы выложить по ссылке (для созвона)

1. Backend задеплоить на любой хостинг Java (Render, Railway и т.п.) с переменными
   `GEMINI_API_KEY` и `ALLOWED_ORIGINS=https://адрес-вашего-сайта`.
2. Frontend выложить на Vercel/Netlify, в настройках проекта задать
   `VITE_API_URL=https://адрес-вашего-backend` (папка проекта — `Riven_frontend`)
   и пересобрать — адрес вшивается в сайт при сборке.
3. Ключ Gemini никогда не кладите в frontend и не коммитьте в git.
