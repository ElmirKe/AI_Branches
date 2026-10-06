package org.example;

import com.google.genai.Client;
import com.google.genai.gaos.models.interactions.CreateModelInteraction;
import com.google.genai.gaos.models.interactions.InteractionsInput;
import com.google.genai.gaos.models.interactions.Model;
import com.google.genai.gaos.models.interactions.ModelOutputStep;
import com.google.genai.gaos.models.interactions.TextContent;
import com.google.genai.gaos.models.operations.CreateInteractionRequestBody;
import com.google.genai.types.HttpOptions;

import java.util.List;

public class TopicAnalyzer {

    private final Client client;

    public TopicAnalyzer() {

        client = Client.builder()
                .apiKey(System.getenv("GEMINI_API_KEY"))
                .httpOptions(
                        HttpOptions.builder()
                                .apiVersion("v1")
                                .build()
                )
                .build();
    }

    public TopicAnalysis analyze(
            List<Message> messages
    ) {

        StringBuilder text =
                new StringBuilder();

        for (Message message : messages) {

            text.append(message.getRole())
                    .append(": ")
                    .append(message.getContent())
                    .append("\n");
        }

        String prompt = """
                Ты анализатор темы AI-чата.

                Проанализируй последние сообщения разговора.

                Определи:

                1. multipleTasks —
                есть ли несколько разных крупных задач.

                2. topicChanged —
                изменилась ли основная тема разговора.

                Не считай обычное уточнение,
                продолжение или вопрос по предыдущей теме
                сменой темы.

                Ответь строго в формате:

                multipleTasks=true/false
                topicChanged=true/false

                Сообщения:

                """ + text;

        CreateModelInteraction params =
                CreateModelInteraction.builder()
                        .model(Model.of("gemini-3.7-flash"))
                        .input(InteractionsInput.of(prompt))
                        .build();

        var interaction =
                client.interactions
                        .create(
                                CreateInteractionRequestBody
                                        .of(params)
                        )
                        .interaction()
                        .get();

        String result =
                extractText(interaction);

        return parseResult(result);
    }

    private String extractText(
            com.google.genai.gaos.models.interactions.Interaction interaction
    ) {

        if (interaction.steps().isPresent()) {

            for (var step :
                    interaction.steps().get()) {

                if (step instanceof ModelOutputStep outputStep) {

                    if (outputStep.content().isPresent()) {

                        for (var content :
                                outputStep.content().get()) {

                            if (content
                                    instanceof TextContent textContent) {

                                if (textContent.text().isPresent()) {

                                    return textContent
                                            .text()
                                            .get();
                                }
                            }
                        }
                    }
                }
            }
        }

        return "";
    }

    private TopicAnalysis parseResult(
            String result
    ) {

        boolean multipleTasks =
                result.contains("multipleTasks=true");

        boolean topicChanged =
                result.contains("topicChanged=true");

        return new TopicAnalysis(
                multipleTasks,
                topicChanged
        );
    }

    public record TopicAnalysis(
            boolean multipleTasks,
            boolean topicChanged
    ) {
    }
}