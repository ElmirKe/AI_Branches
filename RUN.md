# Запуск и публикация Riven

Для сайта больше не нужны Render, Java-backend или отдельный хостинг. Frontend публикуется
на GitHub Pages, а streaming-ответ идёт из браузера напрямую в Gemini.

## Публикация

После слияния изменений в `main` workflow `.github/workflows/pages.yml` автоматически:

1. собирает `Riven_frontend`;
2. публикует сборку на GitHub Pages;
3. обновляет сайт по адресу `https://elmirke.github.io/AI_Branches/`.

Если Pages запускается впервые, в репозитории откройте **Settings → Pages** и в поле
**Source** выберите **GitHub Actions**. Другие сервисы развёртывания не нужны.

## Подключение Gemini

Откройте сайт и вставьте свой Gemini API key в поле слева. Ключ:

- хранится только в `sessionStorage` текущей вкладки;
- не попадает в репозиторий или GitHub Actions;
- отправляется напрямую в Gemini через заголовок `x-goog-api-key`;
- удаляется кнопкой **Удалить** или при закрытии вкладки.

Без внешнего AI-провайдера настоящий ответ ИИ невозможен, поэтому ключ Gemini всё ещё
необходим. Сервер и Render при этом не используются.

## Локальный запуск

```bash
cd Riven_frontend
npm install
npm run dev
```

Откройте `http://localhost:5173/AI_Branches/`. Production-проверка: `npm run build`.

Java-код в `src/main/java` оставлен как архив прежнего серверного варианта и для работы
GitHub Pages не требуется.
