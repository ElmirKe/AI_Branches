package org.example;

/** Ошибка обращения к ИИ с текстом, который безопасно показать пользователю (без ключей и деталей запроса). */
public class AiException extends RuntimeException {
    public AiException(String message) {
        super(message);
    }

    /** Модели перегружены или не ответили вовремя: можно попробовать другие модели. */
    public static class Unavailable extends AiException {
        public Unavailable(String message) {
            super(message);
        }
    }
}
