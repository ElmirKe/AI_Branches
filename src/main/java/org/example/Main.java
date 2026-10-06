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

        AIService ai = new AIService();
        new ApiServer(ai::ask, origins).start(port);

        System.out.println("AI Chat backend запущен: http://localhost:" + port + "/api/health");
        System.out.println("Разрешённые адреса фронтенда (CORS): " + origins);
    }
}
