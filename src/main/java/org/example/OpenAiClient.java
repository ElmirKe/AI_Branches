package org.example;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Клиент для любого провайдера с OpenAI-совместимым API (POST {base}/chat/completions):
 * Groq (Qwen, GPT-OSS), Moonshot (Kimi), NVIDIA NIM (Kimi K2), DeepSeek, OpenRouter и т. д.
 * Провайдер меняется тремя переменными окружения, код трогать не нужно.
 *
 * У каждой попытки свой таймаут. При перегрузке (429/5xx), 404 или сетевой ошибке берётся
 * следующая модель из списка. Ключ уходит только в заголовке Authorization и не попадает в логи.
 */
public final class OpenAiClient {

    public static final String DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
    public static final List<String> DEFAULT_MODELS = List.of("qwen/qwen3-32b", "openai/gpt-oss-120b");

    private static final Pattern SAFE_MODEL = Pattern.compile("[A-Za-z0-9._:/-]{1,100}");
    private static final Pattern THINK = Pattern.compile("(?s)<think>.*?</think>");

    private final String apiKey;
    private final List<String> models;
    private final String baseUrl;
    private final Duration attemptTimeout;
    private final Duration totalTimeout;
    private final HttpClient http;

    public OpenAiClient(String apiKey, List<String> models, String baseUrl) {
        this(apiKey, models, baseUrl, Duration.ofSeconds(20), Duration.ofSeconds(40));
    }

    public OpenAiClient(String apiKey, List<String> models, String baseUrl,
                        Duration attemptTimeout, Duration totalTimeout) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalArgumentException("Пустой ключ ИИ");
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
        long deadline = System.nanoTime() + totalTimeout.toNanos();
        String lastProblem = "нет ответа";

        for (int round = 0; round < 2; round++) {
            for (String model : models) {
                long left = deadline - System.nanoTime();
                if (left < Duration.ofSeconds(2).toNanos()) {
                    throw new AiException("ИИ сейчас перегружен и не успел ответить. Попробуйте ещё раз через минуту.");
                }
                Duration timeout = Duration.ofNanos(Math.min(left, attemptTimeout.toNanos()));
                boolean withReasoning = true;
                for (int attempt = 0; attempt < 2; attempt++) {
                    try {
                        String body = buildRequest(model, history, withReasoning);
                        HttpRequest req = HttpRequest.newBuilder(URI.create(baseUrl + "/chat/completions"))
                                .timeout(timeout)
                                .header("Content-Type", "application/json")
                                .header("Authorization", "Bearer " + apiKey)
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
                            System.err.println("[ai] " + lastProblem);
                            break;
                        }
                        String detail = errorMessage(resp.body());
                        System.err.println("[ai] " + model + " -> HTTP " + code + ": " + detail);
                        // модель не знает параметр рассуждений: повторяем без него
                        if (code == 400 && withReasoning && detail.toLowerCase().contains("reasoning")) {
                            withReasoning = false;
                            continue;
                        }
                        if (code == 400 || code == 401 || code == 403) {
                            throw new AiException(explainFatal(code, detail));
                        }
                        lastProblem = "модель " + model + " ответила " + code;
                    } catch (AiException e) {
                        throw e;
                    } catch (java.net.http.HttpTimeoutException e) {
                        lastProblem = "модель " + model + " не ответила вовремя";
                        System.err.println("[ai] " + lastProblem);
                    } catch (IOException e) {
                        lastProblem = "нет связи с провайдером ИИ (" + e.getClass().getSimpleName() + ")";
                        System.err.println("[ai] " + model + ": " + e);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        throw new AiException("Запрос прерван.");
                    }
                    break;
                }
            }
        }
        System.err.println("[ai] все модели недоступны, последняя причина: " + lastProblem);
        throw new AiException("ИИ сейчас недоступен или перегружен (" + lastProblem + "). Попробуйте ещё раз через минуту.");
    }

    // ------------------------------------------------------------ request/response

    /** Для Qwen3 «думать» отключаем (иначе ответ в разы дольше), для GPT-OSS ставим минимум. */
    static String reasoningEffort(String model) {
        String m = model.toLowerCase();
        if (m.contains("qwen3")) {
            return "none";
        }
        if (m.contains("gpt-oss")) {
            return "low";
        }
        return null;
    }

    static String buildRequest(String model, List<Message> history, boolean withReasoning) {
        // Склеиваем подряд идущие реплики одной роли и начинаем с user: так принимают все провайдеры.
        List<String[]> turns = new ArrayList<>();
        for (Message m : history) {
            String role = "assistant".equals(m.getRole()) ? "assistant" : "user";
            if (turns.isEmpty() && role.equals("assistant")) {
                continue;
            }
            if (!turns.isEmpty() && turns.get(turns.size() - 1)[0].equals(role)) {
                turns.get(turns.size() - 1)[1] += "\n\n" + m.getContent();
            } else {
                turns.add(new String[]{role, m.getContent()});
            }
        }
        StringBuilder sb = new StringBuilder("{\"model\":").append(Json.quote(model)).append(",\"messages\":[");
        for (int i = 0; i < turns.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append("{\"role\":\"").append(turns.get(i)[0]).append("\",\"content\":")
                    .append(Json.quote(turns.get(i)[1])).append('}');
        }
        sb.append("],\"temperature\":0.7");
        String effort = withReasoning ? reasoningEffort(model) : null;
        if (effort != null) {
            sb.append(",\"reasoning_effort\":").append(Json.quote(effort));
        }
        return sb.append('}').toString();
    }

    /** Текст ответа или null, если его нет. */
    static String extractAnswer(String json) {
        Object root;
        try {
            root = Json.parse(json);
        } catch (Json.ParseException e) {
            return null;
        }
        if (!(root instanceof Map<?, ?> obj) || !(obj.get("choices") instanceof List<?> choices)
                || choices.isEmpty() || !(choices.get(0) instanceof Map<?, ?> choice)) {
            return null;
        }
        if (!(choice.get("message") instanceof Map<?, ?> msg) || !(msg.get("content") instanceof String content)) {
            return null;
        }
        String text = THINK.matcher(content).replaceAll("").strip();
        return text.isEmpty() ? null : text;
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
        if (code == 401 || code == 403) {
            return "Провайдер ИИ не принял ключ (проверьте LLM_API_KEY и LLM_BASE_URL: ключ верный, не отозван и выдан именно этим провайдером).";
        }
        return "ИИ отклонил запрос: " + detail;
    }
}
