# Как запустить сайт с настоящим ИИ

Два процесса, два окна: **backend** (Java, говорит с ИИ-провайдером) и **frontend** (сайт).
Сайт отправляет на backend только «родословную» ветки (путь от корня до вопроса) —
соседние ветки ИИ не видит.

> Backend **ничего не хранит**. Чаты хранит Supabase (см. раздел «Supabase» ниже): если он
> настроен, на сайте появляется вход по почте, и чаты сохраняются. Без настройки сайт работает
> как раньше, чаты живут только в памяти страницы.

## 1. Backend

Нужны: JDK (в `pom.xml` указана версия 22) и ключ ИИ-провайдера. По умолчанию это **Groq**
(бесплатно, без карты, очень быстро): ключ на https://console.groq.com/keys

**Вариант А — IntelliJ IDEA (проще всего).** Откройте проект, `Run → Edit Configurations`
для `Main`, в поле *Environment variables* впишите `LLM_API_KEY=ваш_ключ`, нажмите Run.

**Вариант Б — терминал (PowerShell), из корня репозитория:**

```powershell
$env:LLM_API_KEY="ваш_ключ"
mvn compile exec:java "-Dexec.mainClass=org.example.Main" "-Dmaven.compiler.release=17"
```

(`-Dmaven.compiler.release=17` нужен, если у вас JDK ниже 22, а в `pom.xml` указана 22.)

Должно появиться `AI Chat backend запущен: http://localhost:8080/api/health`.
Проверка: откройте http://localhost:8080/api/health — увидите `{"status":"ok"}`.

Настройки (переменные окружения, все необязательные, кроме ключа):

| Переменная        | Что делает                                                     | По умолчанию            |
|-------------------|----------------------------------------------------------------|-------------------------|
| `LLM_API_KEY`     | ключ провайдера ИИ (**обязателен**, хранится только на сервере) | —                       |
| `LLM_BASE_URL`    | адрес OpenAI-совместимого API провайдера                        | `https://api.groq.com/openai/v1` |
| `LLM_MODELS`      | модели по очереди: если первая перегружена, берётся следующая   | `qwen/qwen3-32b,openai/gpt-oss-120b` |
| `PORT`            | порт сервера                                                   | `8080`                  |
| `ALLOWED_ORIGINS` | адреса сайта, которым разрешено обращаться к серверу (через запятую) | `http://localhost:5173` |

### Как сменить модель или провайдера (код менять не нужно)

| Провайдер | `LLM_BASE_URL` | `LLM_MODELS` (пример) | Ключ |
|---|---|---|---|
| Groq (по умолчанию, бесплатно) | `https://api.groq.com/openai/v1` | `qwen/qwen3-32b,openai/gpt-oss-120b` | console.groq.com |
| Kimi напрямую (платно, от $1) | `https://api.moonshot.ai/v1` | `kimi-k2.6` | platform.kimi.ai |
| Kimi K2 на NVIDIA NIM (бесплатно, медленнее) | `https://integrate.api.nvidia.com/v1` | `moonshotai/kimi-k2-instruct-0905` | build.nvidia.com |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` | platform.deepseek.com |

Названия моделей у провайдеров меняются: актуальный список смотрите в их кабинете.
Для Qwen3 «размышления» выключаются автоматически (иначе ответ приходит заметно дольше).

> Старый вариант тоже работает: если задан только `GEMINI_API_KEY` (и нет `LLM_API_KEY`),
> backend использует Gemini, как раньше.

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
- «⚠ ИИ сейчас недоступен или перегружен» — провайдер отвечает 503/429 на все модели из списка;
  подождите минуту или задайте другие модели в `LLM_MODELS`. Подробности — в окне backend (строки `[ai]`).
- «⚠ Провайдер ИИ не принял ключ» — неверный/отозванный `LLM_API_KEY`, либо ключ от другого провайдера, чем `LLM_BASE_URL`.
- После изменения `.env.local` перезапустите `npm run dev`.

## API (для справки)

```
GET  /api/health
POST /api/chat
     {"messages":[{"role":"user","content":"..."},{"role":"assistant","content":"..."}, ...]}
     последнее сообщение — от пользователя
  -> 200 {"answer":"..."}   |   400/413/502 {"error":"..."}

POST /api/title
     {"kind":"chat","texts":["первое сообщение"]}            — название чата (до 4 слов, по смыслу)
     {"kind":"family","texts":["сообщение","ветка 1",...]}   — название «семьи» веток (до 3 слов)
  -> 200 {"title":"..."}   |   400/502 {"error":"..."}
```

## Supabase: вход и сохранение чатов

1. Создайте проект на https://supabase.com (Region — ближайший, например Frankfurt).
2. Откройте **SQL Editor → New query**, вставьте весь файл `Riven_frontend/supabase/schema.sql`, нажмите **Run**.
   Появятся таблицы `chats` и `messages`; правила (RLS) не дают одному пользователю видеть чужие чаты.
3. **Authentication → Sign In / Providers → Email**: выключите **Confirm email** (иначе при регистрации
   нужно подтверждать почту, а встроенная почта Supabase шлёт лишь несколько писем в час).
4. **Project Settings → API** (или **API Keys**): скопируйте **Project URL** и ключ **anon / publishable**.
   Это публичный ключ, он безопасен в коде сайта: данные защищены правилами RLS.
   Секретный ключ `service_role` в сайт класть **нельзя**.
5. Впишите их в `Riven_frontend/.env.production` (для сайта на Vercel) и/или в `.env.local` (для локального запуска):

```
VITE_SUPABASE_URL=https://ваш-проект.supabase.co
VITE_SUPABASE_ANON_KEY=ваш_публичный_ключ
```

6. Закоммитьте, запушьте, дождитесь пересборки на Vercel. На сайте появится экран входа.

Без этих двух строк сайт работает без входа и без сохранения.

## Чтобы выложить по ссылке (для созвона)

1. Backend задеплоить на любой хостинг Java (Render, Railway и т.п.) с переменными
   `LLM_API_KEY` и `ALLOWED_ORIGINS=https://адрес-вашего-сайта` (и при желании `LLM_BASE_URL`, `LLM_MODELS`).
2. Frontend выложить на Vercel/Netlify (папка проекта — `Riven_frontend`). Адреса вшиваются в сайт
   при сборке: `VITE_API_URL` и `VITE_SUPABASE_*` лежат в `Riven_frontend/.env.production`.
3. Секретные ключи (ИИ, `service_role`) никогда не кладите в frontend и не коммитьте в git.
