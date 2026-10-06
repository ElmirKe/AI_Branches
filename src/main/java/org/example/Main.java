package org.example;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

public class Main {

    public static void main(String[] args) throws Exception {

        String apiKey = System.getenv("GEMINI_API_KEY");
        if (apiKey == null || apiKey.isBlank()) {
            System.err.println("""
                    Не задан GEMINI_API_KEY.
                    Windows PowerShell (в том же окне, где запускаете сервер):
                        $env:GEMINI_API_KEY="ваш_ключ"
                    Mac/Linux:
                        export GEMINI_API_KEY="ваш_ключ"
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

        // Список моделей по порядку: если первая перегружена, берётся следующая.
        // Свой список: GEMINI_MODELS=gemini-flash-lite-latest,gemini-2.5-flash-lite
        java.util.List<String> models = System.getenv("GEMINI_MODELS") == null
                || System.getenv("GEMINI_MODELS").isBlank()
                ? GeminiClient.DEFAULT_MODELS
                : Arrays.stream(System.getenv("GEMINI_MODELS").split(","))
                        .map(String::trim).filter(m -> !m.isEmpty()).toList();

        GeminiClient ai = new GeminiClient(apiKey, models);
        new ApiServer(ai::ask, origins).start(port);

        System.out.println("AI Chat backend запущен: http://localhost:" + port + "/api/health");
        System.out.println("Модели Gemini (по очереди): " + models);
        System.out.println("Разрешённые адреса фронтенда (CORS): " + origins);
    }
}
