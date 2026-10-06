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
import java.util.function.Function;

/**
 * HTTP-слой для фронтенда (встроенный сервер JDK, без Spring).
 *
 * <pre>
 * GET  /api/health  -> {"status":"ok"}
 * POST /api/chat    тело: {"messages":[{"role":"user|assistant","content":"..."}, ...]}
 *                   ответ: {"answer":"..."}  или  {"error":"..."}
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
    private final Set<String> allowedOrigins;

    /**
     * @param ai             функция «история -> ответ ИИ» (в проде это AIService::ask)
     * @param allowedOrigins адреса фронтенда, которым разрешён доступ из браузера (CORS);
     *                       "*" разрешает всем
     */
    public ApiServer(Function<List<Message>, String> ai, Set<String> allowedOrigins) {
        this.ai = ai;
        this.allowedOrigins = allowedOrigins;
    }

    public HttpServer start(int port) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/api/health", this::handleHealth);
        server.createContext("/api/chat", this::handleChat);
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
