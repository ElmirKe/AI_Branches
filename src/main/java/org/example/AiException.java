package org.example;

/** Ошибка обращения к ИИ с текстом, который безопасно показать пользователю (без ключей и деталей запроса). */
public class AiException extends RuntimeException {
    public AiException(String message) {
        super(message);
    }
}
