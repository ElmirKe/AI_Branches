-- ============================================================================
-- Seed: 001_seed_pressure_chat.sql
-- Description: Заполнение базы тестовыми данными в точности по присланной схеме
--              «ЧАТ №1 Значение давления» («Coconut tree. A scheme.»)
-- ============================================================================

DO $$
DECLARE
    v_conv_id UUID := '11111111-1111-1111-1111-111111111111';
    v_node_u1 UUID := 'a0000000-0000-0000-0000-000000000001';
    v_node_a1 UUID := 'b0000000-0000-0000-0000-000000000001';
    v_node_u2 UUID := 'a0000000-0000-0000-0000-000000000002';
    v_node_a2 UUID := 'b0000000-0000-0000-0000-000000000002';
    v_node_u3 UUID := 'a0000000-0000-0000-0000-000000000003';
    v_node_u4 UUID := 'a0000000-0000-0000-0000-000000000004';
    v_node_a4 UUID := 'b0000000-0000-0000-0000-000000000004';
    v_node_u5 UUID := 'a0000000-0000-0000-0000-000000000005';
    v_node_a5 UUID := 'b0000000-0000-0000-0000-000000000005';
BEGIN
    -- 0. Очистка старых тестовых данных (если уже запускалось)
    DELETE FROM conversations WHERE id = v_conv_id;

    -- 1. Создание чата №1
    INSERT INTO conversations (id, title, system_prompt, default_model, created_at)
    VALUES (
        v_conv_id,
        'Значение давления',
        'Ты преподаватель физики. Объясняй понятия доходчиво и структурированно.',
        'gemini-1.5-flash',
        '2026-09-22 10:00:00+00'
    );

    -- ------------------------------------------------------------------------
    -- 2. Ствол дерева диалога («Coconut tree trunk»): №1 -> #1 -> №2 -> #2 -> №3
    -- ------------------------------------------------------------------------

    -- [Корень] №1. Вопрос пользователя: Что такое давление?
    INSERT INTO messages (id, conversation_id, parent_id, role, content, created_at)
    VALUES (
        v_node_u1,
        v_conv_id,
        NULL, -- Корень (depth = 0, branch_index = 0)
        'user',
        '№1. Что такое давление?',
        '2026-09-22 10:00:01+00'
    );

    -- [#1] Ответ ИИ: Давление - это сила действующая на площадь...
    INSERT INTO messages (id, conversation_id, parent_id, role, content, created_at)
    VALUES (
        v_node_a1,
        v_conv_id,
        v_node_u1,
        'assistant',
        '#1. Давление - это сила действующая на площадь...',
        '2026-09-22 10:00:05+00'
    );

    -- [№2] Вопрос пользователя: А что такое гидростатическое давление? (Основное продолжение от #1)
    INSERT INTO messages (id, conversation_id, parent_id, role, content, created_at)
    VALUES (
        v_node_u2,
        v_conv_id,
        v_node_a1,
        'user',
        '№2. А что такое гидростатическое давление?',
        '2026-09-22 10:01:00+00'
    );

    -- [#2] Ответ ИИ: Гидростатическое давление - это....
    INSERT INTO messages (id, conversation_id, parent_id, role, content, created_at)
    VALUES (
        v_node_a2,
        v_conv_id,
        v_node_u2,
        'assistant',
        '#2. Гидростатическое давление - это....',
        '2026-09-22 10:01:05+00'
    );

    -- [№3] Вопрос пользователя: Объясни подробнее формулу про.... (Основное продолжение от #2)
    INSERT INTO messages (id, conversation_id, parent_id, role, content, created_at)
    VALUES (
        v_node_u3,
        v_conv_id,
        v_node_a2,
        'user',
        '№3 Объясни подробнее формулу про....',
        '2026-09-22 10:02:00+00'
    );

    -- ------------------------------------------------------------------------
    -- 3. Ответвление А (ветка применения): №4 -> #4 (ответвляется от ответа #1)
    --    Так как у #1 уже есть ребенок (№2), триггер автоматически сделает:
    --    branch_index = 1, is_fork = TRUE, fork_point_id = #1
    -- ------------------------------------------------------------------------
    INSERT INTO messages (id, conversation_id, parent_id, role, content, created_at)
    VALUES (
        v_node_u4,
        v_conv_id,
        v_node_a1,
        'user',
        '№4 Как она применяется в жизни?',
        '2026-09-22 10:03:00+00'
    );

    INSERT INTO messages (id, conversation_id, parent_id, role, content, created_at)
    VALUES (
        v_node_a4,
        v_conv_id,
        v_node_u4,
        'assistant',
        '#4. Оно применяется в .....',
        '2026-09-22 10:03:05+00'
    );

    -- ------------------------------------------------------------------------
    -- 4. Ответвление Б (ветка атмосферного давления): №5 -> #5 (ответвляется от ответа #2)
    --    Так как у #2 уже есть ребенок (№3), триггер автоматически сделает:
    --    branch_index = 1, is_fork = TRUE, fork_point_id = #2
    -- ------------------------------------------------------------------------
    INSERT INTO messages (id, conversation_id, parent_id, role, content, created_at)
    VALUES (
        v_node_u5,
        v_conv_id,
        v_node_a2,
        'user',
        '№5. Расскажи про атмосферное давление',
        '2026-09-22 10:04:00+00'
    );

    INSERT INTO messages (id, conversation_id, parent_id, role, content, created_at)
    VALUES (
        v_node_a5,
        v_conv_id,
        v_node_u5,
        'assistant',
        '#5 Атмосферное давление это.....',
        '2026-09-22 10:04:05+00'
    );

    RAISE NOTICE 'Тестовый чат "Значение давления" успешно загружен! Нод создано: 10.';
END $$;
