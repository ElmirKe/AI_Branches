package org.example;

import com.google.genai.Client;
import com.google.genai.gaos.models.interactions.CreateModelInteraction;
import com.google.genai.gaos.models.interactions.InteractionsInput;
import com.google.genai.gaos.models.interactions.Model;
import com.google.genai.gaos.models.interactions.ModelOutputStep;
import com.google.genai.gaos.models.interactions.TextContent;
import com.google.genai.gaos.models.operations.CreateInteractionRequestBody;

import java.util.List;

public class AIService {

    private final Client client;

    public AIService() {

        client = Client.builder()
                .apiKey(System.getenv("GEMINI_API_KEY"))
                .build();
    }

    public String ask(List<Message> history) {

        String prompt = buildPrompt(history);

        CreateModelInteraction params =
                CreateModelInteraction.builder()
                        .model(Model.of("gemini-3.7-flash"))
                        .input(InteractionsInput.of(prompt))
                        .build();

        var interaction =
                client.interactions
                        .create(
                                CreateInteractionRequestBody.of(params)
                        )
                        .interaction()
                        .get();

        if (interaction.steps().isPresent()) {

            for (var step : interaction.steps().get()) {

                if (step instanceof ModelOutputStep outputStep) {

                    if (outputStep.content().isPresent()) {

                        for (var content : outputStep.content().get()) {

                            if (content instanceof TextContent textContent) {

                                if (textContent.text().isPresent()) {
                                    return textContent.text().get();
                                }
                            }
                        }
                    }
                }
            }
        }

        return "Gemini не вернул текстовый ответ.";
    }

    private String buildPrompt(List<Message> history) {

        StringBuilder prompt = new StringBuilder();

        prompt.append("""
                Ты AI-помощник в чате.

                Ниже находится история разговора.
                Используй её, чтобы понимать контекст.

                История разговора:

                """);

        for (Message message : history) {

            prompt.append(message.getRole())
                    .append(": ")
                    .append(message.getContent())
                    .append("\n\n");
        }

        prompt.append(
                "Ответь на последнее сообщение пользователя."
        );

        return prompt.toString();
    }
}