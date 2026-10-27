package org.example;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

public class Main {

    public static void main(String[] args) throws Exception {

        // Основной вариант: любой OpenAI-совместимый провайдер (по умолчанию Groq + Qwen3).
        // Для старого деплоя оставлен запасной путь: только GEMINI_API_KEY -> Gemini.
        String llmKey = env("LLM_API_KEY");
        String geminiKey = env("GEMINI_API_KEY");
        if (llmKey == null && geminiKey == null) {
            System.err.println("""
                    Не задан LLM_API_KEY.
                    Windows PowerShell (в том же окне, где запускаете сервер):
                        $env:LLM_API_KEY="ваш_ключ"
                    Mac/Linux:
                        export LLM_API_KEY="ваш_ключ"
                    По умолчанию используется Groq (https://console.groq.com). Другой провайдер:
                    LLM_BASE_URL и LLM_MODELS (см. RUN.md).
                    """);
            System.exit(1);
        }

        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));

        // Какие адреса фронтенда могут обращаться к серверу из браузера (CORS).
        // Для деплоя: ALLOWED_ORIGINS=https://ваш-сайт.vercel.app
        Set<String> origins = Arrays.stream(
                        System.getenv().getOrDefault("ALLOWED_ORIGINS", "http://localhost:5173").split(","))
                .map(String::trim)
                .map(o -> o.endsWith("/") ? o.substring(0, o.length() - 1) : o)
                .filter(o -> !o.isEmpty())
                .collect(Collectors.toCollection(HashSet::new));

        java.util.function.Function<java.util.List<Message>, String> ai;
        String description;
        if (llmKey != null) {
            String baseUrl = env("LLM_BASE_URL") != null ? env("LLM_BASE_URL") : OpenAiClient.DEFAULT_BASE_URL;
            java.util.List<String> models = env("LLM_MODELS") == null
                    ? OpenAiClient.DEFAULT_MODELS
                    : Arrays.stream(env("LLM_MODELS").split(",")).map(String::trim).filter(m -> !m.isEmpty()).toList();
            ai = new OpenAiClient(llmKey, models, baseUrl)::ask;
            description = "OpenAI-совместимый API " + baseUrl + ", модели по очереди: " + models;
        } else {
            // Список моделей по порядку: если первая перегружена, берётся следующая.
            java.util.List<String> models = env("GEMINI_MODELS") == null
                    ? GeminiClient.DEFAULT_MODELS
                    : Arrays.stream(env("GEMINI_MODELS").split(",")).map(String::trim).filter(m -> !m.isEmpty()).toList();
            ai = new GeminiClient(geminiKey, models)::ask;
            description = "Gemini (запасной вариант), модели по очереди: " + models;
        }
        new ApiServer(ai, origins).start(port);

        System.out.println("AI Chat backend запущен: http://localhost:" + port + "/api/health");
        System.out.println("ИИ: " + description);
        System.out.println("Разрешённые адреса фронтенда (CORS): " + origins);
    }

    private static String env(String name) {
        String v = System.getenv(name);
        return v == null || v.isBlank() ? null : v.trim();
    }
}
