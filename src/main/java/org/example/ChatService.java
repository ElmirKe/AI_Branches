package org.example;

import java.util.List;

public class ChatService {

    private final ChatManager chatManager;
    private final AIService aiService;
    private final TopicAnalyzer topicAnalyzer;

    private int userMessagesSinceLastAnalysis = 0;

    public ChatService() {
        chatManager = new ChatManager();
        aiService = new AIService();
        topicAnalyzer = new TopicAnalyzer();
    }

    public ChatResponse sendMessage(
            int branchId,
            String userMessage
    ) {

        // Сохраняем сообщение пользователя
        chatManager.saveMessage(
                branchId,
                "user",
                userMessage
        );

        userMessagesSinceLastAnalysis++;

        boolean suggestBranch = false;

        // Проверяем тему после каждых 4 сообщений пользователя
        if (userMessagesSinceLastAnalysis >= 4) {

            List<Message> recentMessages =
                    chatManager.getLastMessages(branchId, 8);

            TopicAnalyzer.TopicAnalysis analysis =
                    topicAnalyzer.analyze(recentMessages);

            suggestBranch =
                    analysis.topicChanged()
                            || analysis.multipleTasks();

            userMessagesSinceLastAnalysis = 0;
        }

        // Получаем полную историю ветки
        List<Message> history =
                chatManager.getFullHistory(branchId);

        // Получаем ответ Gemini
        String aiAnswer =
                aiService.ask(history);

        // Сохраняем ответ AI
        chatManager.saveMessage(
                branchId,
                "assistant",
                aiAnswer
        );

        return new ChatResponse(
                aiAnswer,
                suggestBranch
        );
    }

    public record ChatResponse(
            String answer,
            boolean suggestBranch
    ) {
    }
}