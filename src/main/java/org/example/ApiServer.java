package org.example;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.function.Consumer;
import java.util.function.Function;

/**
 * HTTP-слой для фронтенда (встроенный сервер JDK, без Spring).
 *
 * <pre>
 * GET  /api/health  -> {"status":"ok"}
 * POST /api/chat    тело: {"messages":[{"role":"user|assistant","content":"..."}, ...]}
 *                   ответ: {"answer":"..."}  или  {"error":"..."}
 * POST /api/chat/stream — тот же запрос, ответ частями через SSE
 * POST /api/title   тело: {"kind":"chat|family","texts":["...", ...]}
 *                   ответ: {"title":"..."}  — короткое название по смыслу (до 5 слов)
 * </pre>
 *
 * Фронтенд присылает ТОЛЬКО родословную ветки (путь от корня до вопроса),
 * поэтому сервер ничего не хранит и не знает про соседние ветки.
 * Последнее сообщение в списке обязано быть от пользователя.
 */
public final class ApiServer {

    static final int MAX_BODY_BYTES = 1_000_000;
    static final int MAX_MESSAGES = 200;
    static final int MAX_CONTENT_CHARS = 20_000;

    private final Function<List<Message>, String> ai;
    private final StreamingAi streamingAi;
    private final Set<String> allowedOrigins;

    @FunctionalInterface
    public interface StreamingAi {
        String apply(List<Message> history, Consumer<String> onChunk);
    }

    /**
     * @param ai             функция «история -> ответ ИИ» (в проде это AIService::ask)
     * @param allowedOrigins адреса фронтенда, которым разрешён доступ из браузера (CORS);
     *                       "*" разрешает всем
     */
    public ApiServer(Function<List<Message>, String> ai, Set<String> allowedOrigins) {
        this(ai, null, allowedOrigins);
    }

    public ApiServer(Function<List<Message>, String> ai, StreamingAi streamingAi, Set<String> allowedOrigins) {
        this.ai = ai;
        this.streamingAi = streamingAi;
        this.allowedOrigins = allowedOrigins;
    }

    public HttpServer start(int port) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/api/health", this::handleHealth);
        server.createContext("/api/chat", this::handleChat);
        server.createContext("/api/chat/stream", this::handleChatStream);
        server.createContext("/api/title", this::handleTitle);
        server.setExecutor(Executors.newFixedThreadPool(8));
        server.start();
        return server;
    }

    // ---------------------------------------------------------------- handlers

    private void handleHealth(HttpExchange ex) throws IOException {
        try {
            if (handlePreflight(ex)) {
                return;
            }
            if (!"GET".equals(ex.getRequestMethod())) {
                sendJson(ex, 405, "{\"error\":\"Только GET\"}", "GET, OPTIONS");
                return;
            }
            sendJson(ex, 200, "{\"status\":\"ok\"}", null);
        } finally {
            ex.close();
        }
    }

    private void handleChat(HttpExchange ex) throws IOException {
        try {
            if (handlePreflight(ex)) {
                return;
            }
            if (!"POST".equals(ex.getRequestMethod())) {
                sendJson(ex, 405, error("Только POST"), "POST, OPTIONS");
                return;
            }

            // Читаем не больше лимита: считаем реальные байты, а не доверяем Content-Length
            // (иначе chunked-запрос без Content-Length обошёл бы ограничение).
            byte[] raw = ex.getRequestBody().readNBytes(MAX_BODY_BYTES + 1);
            if (raw.length > MAX_BODY_BYTES) {
                sendJson(ex, 413, error("Запрос слишком большой"), null);
                return;
            }

            List<Message> history;
            try {
                history = parseHistory(new String(raw, StandardCharsets.UTF_8));
            } catch (BadRequest | Json.ParseException e) {
                sendJson(ex, 400, error(e.getMessage()), null);
                return;
            }

            long t0 = System.currentTimeMillis();
            String answer;
            try {
                answer = ai.apply(history);
            } catch (AiException e) {
                // Текст такой ошибки уже безопасен и понятен пользователю.
                System.err.println("[api] ИИ: " + e.getMessage());
                sendJson(ex, 502, error(e.getMessage()), null);
                return;
            } catch (RuntimeException e) {
                // Подробности — только в лог сервера: в тексте ошибки SDK могут быть детали запроса.
                System.err.println("[api] ИИ вернул ошибку: " + e);
                sendJson(ex, 502, error("ИИ-сервис не ответил. Подробности в логе сервера."), null);
                return;
            }
            if (answer == null || answer.isBlank()) {
                sendJson(ex, 502, error("ИИ вернул пустой ответ"), null);
                return;
            }
            System.out.println("[api] /api/chat: " + history.size() + " сообщ., "
                    + (System.currentTimeMillis() - t0) + " мс");
            sendJson(ex, 200, "{\"answer\":" + Json.quote(answer) + "}", null);
        } finally {
            ex.close();
        }
    }

    private void handleChatStream(HttpExchange ex) throws IOException {
        try {
            if (handlePreflight(ex)) {
                return;
            }
            if (!"POST".equals(ex.getRequestMethod())) {
                sendJson(ex, 405, error("Только POST"), "POST, OPTIONS");
                return;
            }
            if (streamingAi == null) {
                sendJson(ex, 501, error("Потоковые ответы не настроены"), null);
                return;
            }

            byte[] raw = ex.getRequestBody().readNBytes(MAX_BODY_BYTES + 1);
            if (raw.length > MAX_BODY_BYTES) {
                sendJson(ex, 413, error("Запрос слишком большой"), null);
                return;
            }

            List<Message> history;
            try {
                history = parseHistory(new String(raw, StandardCharsets.UTF_8));
            } catch (BadRequest | Json.ParseException e) {
                sendJson(ex, 400, error(e.getMessage()), null);
                return;
            }

            addCors(ex);
            ex.getResponseHeaders().set("Content-Type", "text/event-stream; charset=utf-8");
            ex.getResponseHeaders().set("Cache-Control", "no-cache, no-transform");
            ex.getResponseHeaders().set("X-Accel-Buffering", "no");
            ex.sendResponseHeaders(200, 0);

            long t0 = System.currentTimeMillis();
            try (OutputStream os = ex.getResponseBody()) {
                try {
                    String answer = streamingAi.apply(history, chunk -> {
                        try {
                            sendSse(os, "{\"text\":" + Json.quote(chunk) + "}");
                        } catch (IOException e) {
                            throw new StreamWriteException(e);
                        }
                    });
                    if (answer == null || answer.isBlank()) {
                        sendSse(os, error("ИИ вернул пустой ответ"));
                        return;
                    }
                    sendSse(os, "{\"done\":true}");
                    System.out.println("[api] /api/chat/stream: " + history.size() + " сообщ., "
                            + (System.currentTimeMillis() - t0) + " мс");
                } catch (AiException e) {
                    System.err.println("[api] stream ИИ: " + e.getMessage());
                    sendSse(os, error(e.getMessage()));
                } catch (StreamWriteException e) {
                    System.err.println("[api] клиент закрыл stream: " + e.getCause());
                } catch (RuntimeException e) {
                    System.err.println("[api] stream ИИ вернул ошибку: " + e);
                    sendSse(os, error("ИИ-сервис не ответил. Подробности в логе сервера."));
                }
            }
        } finally {
            ex.close();
        }
    }

    // -------------------------------------------------------------------- title

    static final int MAX_TITLE_TEXTS = 8;
    static final int MAX_TITLE_TEXT_CHARS = 1500;

    private void handleTitle(HttpExchange ex) throws IOException {
        try {
            if (handlePreflight(ex)) {
                return;
            }
            if (!"POST".equals(ex.getRequestMethod())) {
                sendJson(ex, 405, error("Только POST"), "POST, OPTIONS");
                return;
            }
            byte[] raw = ex.getRequestBody().readNBytes(MAX_BODY_BYTES + 1);
            if (raw.length > MAX_BODY_BYTES) {
                sendJson(ex, 413, error("Запрос слишком большой"), null);
                return;
            }

            String prompt;
            try {
                prompt = buildTitlePrompt(new String(raw, StandardCharsets.UTF_8));
            } catch (BadRequest | Json.ParseException e) {
                sendJson(ex, 400, error(e.getMessage()), null);
                return;
            }

            String answer;
            try {
                answer = ai.apply(List.of(new Message(1, 0, "user", prompt)));
            } catch (AiException e) {
                System.err.println("[api] title: " + e.getMessage());
                sendJson(ex, 502, error(e.getMessage()), null);
                return;
            } catch (RuntimeException e) {
                System.err.println("[api] title: ИИ вернул ошибку: " + e);
                sendJson(ex, 502, error("ИИ-сервис не ответил. Подробности в логе сервера."), null);
                return;
            }
            String title = cleanTitle(answer);
            if (title.isEmpty()) {
                sendJson(ex, 502, error("ИИ не придумал название"), null);
                return;
            }
            sendJson(ex, 200, "{\"title\":" + Json.quote(title) + "}", null);
        } finally {
            ex.close();
        }
    }

    static String buildTitlePrompt(String body) {
        Object root = Json.parse(body);
        if (!(root instanceof Map<?, ?> obj)) {
            throw new BadRequest("Ожидался JSON-объект с полями kind и texts");
        }
        Object kind = obj.get("kind");
        if (!"chat".equals(kind) && !"family".equals(kind)) {
            throw new BadRequest("kind должен быть \"chat\" или \"family\"");
        }
        if (!(obj.get("texts") instanceof List<?> list) || list.isEmpty() || list.size() > MAX_TITLE_TEXTS) {
            throw new BadRequest("texts должен быть массивом из 1.." + MAX_TITLE_TEXTS + " строк");
        }
        List<String> texts = new ArrayList<>();
        for (Object o : list) {
            if (!(o instanceof String t) || t.isBlank()) {
                throw new BadRequest("Каждый элемент texts должен быть непустой строкой");
            }
            texts.add(t.length() > MAX_TITLE_TEXT_CHARS ? t.substring(0, MAX_TITLE_TEXT_CHARS) : t);
        }
        StringBuilder sb = new StringBuilder();
        if ("chat".equals(kind)) {
            sb.append("""
                    Придумай название чата по первому сообщению пользователя.
                    Требования:
                    - передай СМЫСЛ запроса (о чём он или чего хочет), а не копируй текст;
                    - максимум 4 слова, лучше 2-3;
                    - на том же языке, что и сообщение;
                    - без кавычек, точки, эмодзи и пояснений.
                    Верни только само название.

                    Сообщение пользователя:
                    <<<
                    """);
            sb.append(texts.get(0)).append("\n>>>");
        } else {
            sb.append("""
                    Ниже сообщение ассистента и части, которые разошлись в отдельные ветки диалога.
                    Придумай общее название этой группы веток по смыслу.
                    Требования:
                    - максимум 3 слова;
                    - на том же языке, что и сообщение;
                    - без кавычек, точки, эмодзи и пояснений.
                    Верни только само название.

                    Сообщение:
                    <<<
                    """);
            sb.append(texts.get(0)).append("\n>>>");
            if (texts.size() > 1) {
                sb.append("\n\nВетки:");
                for (int i = 1; i < texts.size(); i++) {
                    sb.append("\n- ").append(texts.get(i).replace('\n', ' '));
                }
            }
        }
        return sb.toString();
    }

    /** Из ответа модели делает аккуратное короткое название: одна строка, без кавычек и точки, до 5 слов. */
    static String cleanTitle(String raw) {
        if (raw == null) {
            return "";
        }
        String line = "";
        for (String l : raw.split("\\R")) {
            if (!l.isBlank()) {
                line = l.strip();
                break;
            }
        }
        line = line.replaceAll("^[#*>\\-\\s\"'«»“”„`]+", "")
                .replaceAll("[\\s\"'«»“”„`*.!,;:]+$", "")
                .replaceAll("(?iu)^(название|title)\\s*[:\\-—]\\s*", "")
                .replaceAll("\\s+", " ")
                .strip();
        String[] words = line.split(" ");
        if (words.length > 5) {
            line = String.join(" ", java.util.Arrays.copyOf(words, 5));
        }
        if (line.length() > 40) {
            line = line.substring(0, 40).strip();
        }
        return line;
    }

    // ----------------------------------------------------------------- parsing

    static final class BadRequest extends RuntimeException {
        BadRequest(String message) {
            super(message);
        }
    }

    static List<Message> parseHistory(String body) {
        Object root = Json.parse(body);
        if (!(root instanceof Map<?, ?> obj)) {
            throw new BadRequest("Ожидался JSON-объект с полем messages");
        }
        if (!(obj.get("messages") instanceof List<?> list) || list.isEmpty()) {
            throw new BadRequest("Поле messages должно быть непустым массивом");
        }
        if (list.size() > MAX_MESSAGES) {
            throw new BadRequest("Слишком длинная история (максимум " + MAX_MESSAGES + ")");
        }
        List<Message> out = new ArrayList<>();
        int id = 1;
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> m)) {
                throw new BadRequest("Каждое сообщение должно быть объектом");
            }
            if (!(m.get("role") instanceof String role)
                    || !(role.equals("user") || role.equals("assistant"))) {
                throw new BadRequest("role должен быть \"user\" или \"assistant\"");
            }
            if (!(m.get("content") instanceof String content) || content.isBlank()) {
                throw new BadRequest("content должен быть непустой строкой");
            }
            if (content.length() > MAX_CONTENT_CHARS) {
                throw new BadRequest("Сообщение длиннее " + MAX_CONTENT_CHARS + " символов");
            }
            out.add(new Message(id++, 0, role, content));
        }
        if (!"user".equals(out.get(out.size() - 1).getRole())) {
            throw new BadRequest("Последнее сообщение должно быть от пользователя");
        }
        return out;
    }

    // -------------------------------------------------------------------- CORS

    /** Отвечает на предзапрос браузера (OPTIONS). Возвращает true, если запрос обработан. */
    private boolean handlePreflight(HttpExchange ex) throws IOException {
        if (!"OPTIONS".equals(ex.getRequestMethod())) {
            return false;
        }
        addCors(ex);
        ex.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        ex.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
        ex.getResponseHeaders().set("Access-Control-Max-Age", "600");
        ex.sendResponseHeaders(204, -1);
        return true;
    }

    private void addCors(HttpExchange ex) {
        String origin = ex.getRequestHeaders().getFirst("Origin");
        ex.getResponseHeaders().add("Vary", "Origin");
        if (origin == null) {
            return;
        }
        if (allowedOrigins.contains("*")) {
            ex.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        } else if (allowedOrigins.contains(origin)) {
            ex.getResponseHeaders().set("Access-Control-Allow-Origin", origin);
        }
    }

    // ----------------------------------------------------------------- helpers

    private static String error(String message) {
        return "{\"error\":" + Json.quote(message) + "}";
    }

    private static void sendSse(OutputStream os, String json) throws IOException {
        os.write(("data: " + json + "\n\n").getBytes(StandardCharsets.UTF_8));
        os.flush();
    }

    private static final class StreamWriteException extends RuntimeException {
        StreamWriteException(IOException cause) {
            super(cause);
        }
    }

    private void sendJson(HttpExchange ex, int status, String json, String allow) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        addCors(ex);
        ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        if (allow != null) {
            ex.getResponseHeaders().set("Allow", allow);
        }
        ex.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(bytes);
        }
    }
}
