-- ============================================================================
-- Query: 01_get_llm_context_path.sql
-- Назначение: Сборка линейного контекста для передачи в API языковой модели.
--             Решает ключевую проблему: изолирует контекст от параллельных веток.
-- ============================================================================

-- Пример: Пользователь находится в ноде №3 («Объясни подробнее формулу про....»)
-- и нажимает «Отправить». Мы передаем в ИИ ТОЛЬКО историю этой ветки:
-- [Корень №1] -> [#1] -> [№2] -> [#2] -> [№3]
-- Ветки №4 (применение) и №5 (атмосферное давление) сюда НЕ попадают!

-- Вариант А: Использование встроенной хранимой функции (рекомендуется для бэкенда)
SELECT 
    step_order,
    role,
    content,
    depth,
    created_at
FROM fn_get_branch_context('a0000000-0000-0000-0000-000000000003'::uuid);


-- Вариант Б: Прямой рекурсивный запрос (Recursive CTE)
WITH RECURSIVE branch_history AS (
    -- Базовая часть: целевая нода
    SELECT 
        1 AS step_from_leaf,
        m.id,
        m.conversation_id,
        m.parent_id,
        m.role,
        m.content,
        m.depth,
        m.created_at
    FROM messages m
    WHERE m.id = 'a0000000-0000-0000-0000-000000000003'::uuid

    UNION ALL

    -- Рекурсивная часть: поднимаемся к родителю
    SELECT 
        bh.step_from_leaf + 1,
        p.id,
        p.conversation_id,
        p.parent_id,
        p.role,
        p.content,
        p.depth,
        p.created_at
    FROM messages p
    JOIN branch_history bh ON p.id = bh.parent_id
)
SELECT 
    (ROW_NUMBER() OVER (ORDER BY step_from_leaf DESC)) AS position,
    role,
    content,
    depth,
    created_at
FROM branch_history
ORDER BY step_from_leaf DESC; -- Сортировка от корня к текущей ноде


-- Вариант В: Сборка полного payload для LLM (включая системный промпт чата на 0-й позиции)
WITH RECURSIVE branch_history AS (
    SELECT 1 AS step, m.id, m.conversation_id, m.parent_id, m.role, m.content
    FROM messages m
    WHERE m.id = 'a0000000-0000-0000-0000-000000000003'::uuid
    UNION ALL
    SELECT bh.step + 1, p.id, p.conversation_id, p.parent_id, p.role, p.content
    FROM messages p
    JOIN branch_history bh ON p.id = bh.parent_id
),
conversation_ctx AS (
    SELECT 
        0 AS sort_order, 
        'system'::varchar(20) AS role, 
        c.system_prompt AS content
    FROM conversations c
    WHERE c.id = (SELECT conversation_id FROM messages WHERE id = 'a0000000-0000-0000-0000-000000000003'::uuid)
      AND c.system_prompt IS NOT NULL AND c.system_prompt != ''
),
ordered_history AS (
    SELECT 
        (ROW_NUMBER() OVER (ORDER BY step DESC)) AS sort_order,
        role,
        content
    FROM branch_history
)
SELECT role, content FROM conversation_ctx
UNION ALL
SELECT role, content FROM ordered_history
ORDER BY sort_order ASC;

