package org.example;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.regex.Pattern;

/**
 * Прямой вызов Gemini REST API (generateContent) без SDK.
 *
 * Зачем: у новых моделей Google часто отвечает 503 «перегружено». SDK в таком случае
 * долго повторяет запрос и «зависает». Здесь у каждой попытки свой таймаут, а при
 * временной ошибке выполняется одна повторная попытка той же быстрой модели.
 *
 * Ключ уходит только в заголовке x-goog-api-key и никогда не попадает в логи и тексты ошибок.
 */
public final class GeminiClient {

    public static final String DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
    public static final List<String> DEFAULT_MODELS = List.of("gemini-3.5-flash-lite");

    private static final Pattern SAFE_MODEL = Pattern.compile("[A-Za-z0-9._-]{1,80}");

    private final String apiKey;
    private final List<String> models;
    private final String baseUrl;
    private final Duration attemptTimeout;
    private final Duration totalTimeout;
    private final HttpClient http;

    public GeminiClient(String apiKey, List<String> models) {
        this(apiKey, models, DEFAULT_BASE_URL, Duration.ofSeconds(25), Duration.ofSeconds(50));
    }

    public GeminiClient(String apiKey, List<String> models, String baseUrl,
                        Duration attemptTimeout, Duration totalTimeout) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalArgumentException("Пустой ключ Gemini");
        }
        if (models == null || models.isEmpty()) {
            throw new IllegalArgumentException("Пустой список моделей");
        }
        for (String m : models) {
            if (!SAFE_MODEL.matcher(m).matches()) {
                throw new IllegalArgumentException("Недопустимое имя модели: " + m);
            }
        }
        this.apiKey = apiKey.trim();
        this.models = List.copyOf(models);
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        this.attemptTimeout = attemptTimeout;
        this.totalTimeout = totalTimeout;
        this.http = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(8))
                .build();
    }

    /** История (последнее — от пользователя) -> ответ модели. */
    public String ask(List<Message> history) {
        String body = buildRequest(history);
        long deadline = System.nanoTime() + totalTimeout.toNanos();
        String lastProblem = "нет ответа";

        for (int round = 0; round < 2; round++) {
            for (String model : models) {
                long left = deadline - System.nanoTime();
                if (left < Duration.ofSeconds(2).toNanos()) {
                    throw new AiException("ИИ сейчас перегружен и не успел ответить. Попробуйте ещё раз через минуту.");
                }
                Duration timeout = Duration.ofNanos(Math.min(left, attemptTimeout.toNanos()));
                try {
                    HttpRequest req = HttpRequest.newBuilder(
                                    URI.create(baseUrl + "/v1beta/models/" + model + ":generateContent"))
                            .timeout(timeout)
                            .header("Content-Type", "application/json")
                            .header("x-goog-api-key", apiKey)
                            .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                            .build();
                    HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
                    int code = resp.statusCode();
                    if (code == 200) {
                        String text = extractAnswer(resp.body());
                        if (text != null) {
                            return text;
                        }
                        lastProblem = "модель " + model + " вернула пустой ответ";
                        System.err.println("[gemini] " + lastProblem);
                        continue;
                    }
                    String detail = errorMessage(resp.body());
                    System.err.println("[gemini] " + model + " -> HTTP " + code + ": " + detail);
                    if (code == 400 || code == 401 || code == 403) {
                        throw new AiException(explainFatal(code, detail));
                    }
                    lastProblem = "модель " + model + " ответила " + code;
                } catch (AiException e) {
                    throw e;
                } catch (java.net.http.HttpTimeoutException e) {
                    lastProblem = "модель " + model + " не ответила вовремя";
                    System.err.println("[gemini] " + lastProblem);
                } catch (IOException e) {
                    lastProblem = "нет связи с Google (" + e.getClass().getSimpleName() + ")";
                    System.err.println("[gemini] " + model + ": " + e);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new AiException("Запрос прерван.");
                }
            }
        }
        System.err.println("[gemini] модель недоступна, последняя причина: " + lastProblem);
        throw new AiException("ИИ сейчас недоступен или перегружен (" + lastProblem + "). Попробуйте ещё раз через минуту.");
    }

    /** История -> поток фрагментов ответа. Возвращает полный собранный текст. */
    public String askStreaming(List<Message> history, Consumer<String> onChunk) {
        String model = models.get(0);
        String body = buildRequest(history);
        long startedAt = System.nanoTime();
        long firstChunkAt = 0;

        HttpRequest req = HttpRequest.newBuilder(
                        URI.create(baseUrl + "/v1beta/models/" + model + ":streamGenerateContent?alt=sse"))
                .timeout(totalTimeout)
                .header("Content-Type", "application/json")
                .header("Accept", "text/event-stream")
                .header("x-goog-api-key", apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();

        try {
            HttpResponse<java.io.InputStream> resp =
                    http.send(req, HttpResponse.BodyHandlers.ofInputStream());
            if (resp.statusCode() != 200) {
                String detail = errorMessage(new String(resp.body().readAllBytes(), StandardCharsets.UTF_8));
                System.err.println("[gemini] stream " + model + " -> HTTP " + resp.statusCode() + ": " + detail);
                if (resp.statusCode() == 400 || resp.statusCode() == 401 || resp.statusCode() == 403) {
                    throw new AiException(explainFatal(resp.statusCode(), detail));
                }
                throw new AiException("ИИ сейчас недоступен или перегружен. Попробуйте ещё раз через минуту.");
            }

            StringBuilder full = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(resp.body(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (!line.startsWith("data:")) {
                        continue;
                    }
                    String payload = line.substring(5).stripLeading();
                    if (payload.isEmpty() || "[DONE]".equals(payload)) {
                        continue;
                    }
                    String chunk = extractChunk(payload);
                    if (chunk != null && !chunk.isEmpty()) {
                        if (firstChunkAt == 0) {
                            firstChunkAt = System.nanoTime();
                        }
                        full.append(chunk);
                        onChunk.accept(chunk);
                    }
                }
            }

            if (full.isEmpty()) {
                throw new AiException("ИИ вернул пустой ответ.");
            }
            long finishedAt = System.nanoTime();
            long firstMs = firstChunkAt == 0 ? -1 : Duration.ofNanos(firstChunkAt - startedAt).toMillis();
            long totalMs = Duration.ofNanos(finishedAt - startedAt).toMillis();
            System.out.println("[gemini] stream " + model + ": первый фрагмент " + firstMs
                    + " мс, всего " + totalMs + " мс");
            return full.toString();
        } catch (AiException e) {
            throw e;
        } catch (java.net.http.HttpTimeoutException e) {
            throw new AiException("ИИ не ответил вовремя. Попробуйте ещё раз.");
        } catch (IOException e) {
            System.err.println("[gemini] stream " + model + ": " + e);
            throw new AiException("Нет связи с Google. Попробуйте ещё раз.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AiException("Запрос прерван.");
        }
    }

    // ------------------------------------------------------------ request/response

    static String buildRequest(List<Message> history) {
        // Gemini требует чередование ролей и начало с user: склеиваем подряд идущие реплики одной роли.
        List<String[]> turns = new ArrayList<>();
        for (Message m : history) {
            String role = "assistant".equals(m.getRole()) ? "model" : "user";
            if (turns.isEmpty() && role.equals("model")) {
                continue;
            }
            if (!turns.isEmpty() && turns.get(turns.size() - 1)[0].equals(role)) {
                turns.get(turns.size() - 1)[1] += "\n\n" + m.getContent();
            } else {
                turns.add(new String[]{role, m.getContent()});
            }
        }
        StringBuilder sb = new StringBuilder("{\"contents\":[");
        for (int i = 0; i < turns.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append("{\"role\":\"").append(turns.get(i)[0]).append("\",\"parts\":[{\"text\":")
                    .append(Json.quote(turns.get(i)[1])).append("}]}");
        }
        return sb.append("],\"generationConfig\":{\"thinkingConfig\":{\"thinkingLevel\":\"minimal\"}}}")
                .toString();
    }

    /** Текст ответа или null, если его нет. Бросает AiException, если запрос заблокирован. */
    static String extractAnswer(String json) {
        String raw = extractChunk(json);
        if (raw == null) {
            return null;
        }
        String text = raw.strip();
        return text.isEmpty() ? null : text;
    }

    /** Фрагмент потокового ответа без trim: пробелы между SSE-частями значимы. */
    static String extractChunk(String json) {
        Object root;
        try {
            root = Json.parse(json);
        } catch (Json.ParseException e) {
            return null;
        }
        if (!(root instanceof Map<?, ?> obj)) {
            return null;
        }
        if (obj.get("promptFeedback") instanceof Map<?, ?> pf && pf.get("blockReason") != null) {
            throw new AiException("Google отклонил запрос по правилам безопасности (" + pf.get("blockReason") + ").");
        }
        if (!(obj.get("candidates") instanceof List<?> cands) || cands.isEmpty()
                || !(cands.get(0) instanceof Map<?, ?> cand)) {
            return null;
        }
        StringBuilder out = new StringBuilder();
        if (cand.get("content") instanceof Map<?, ?> content && content.get("parts") instanceof List<?> parts) {
            for (Object p : parts) {
                if (p instanceof Map<?, ?> part && part.get("text") instanceof String t
                        && !Boolean.TRUE.equals(part.get("thought"))) {
                    out.append(t);
                }
            }
        }
        if (out.isEmpty()) {
            if ("SAFETY".equals(cand.get("finishReason")) || "PROHIBITED_CONTENT".equals(cand.get("finishReason"))) {
                throw new AiException("Google не стал отвечать на этот запрос по правилам безопасности.");
            }
            return null;
        }
        return out.toString();
    }

    private static String errorMessage(String json) {
        try {
            if (Json.parse(json) instanceof Map<?, ?> o && o.get("error") instanceof Map<?, ?> e
                    && e.get("message") instanceof String s) {
                return s.length() > 300 ? s.substring(0, 300) : s;
            }
        } catch (RuntimeException ignored) {
            // не JSON
        }
        return "(без описания)";
    }

    private static String explainFatal(int code, String detail) {
        if (code == 401 || code == 403 || detail.toLowerCase().contains("api key")) {
            return "Gemini не принял ключ (проверьте GEMINI_API_KEY: он верный, не отозван, и для него включён Gemini API).";
        }
        return "Gemini отклонил запрос: " + detail;
    }
}
