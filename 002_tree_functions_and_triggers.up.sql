-- ============================================================================
-- Migration: 002_tree_functions_and_triggers.up.sql
-- Description: Триггеры автоматического расчёта глубины/веток и функции обхода дерева
-- Dialect: PostgreSQL (13+)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Триггерная функция для автоматического расчёта параметров дерева нод
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_calculate_message_tree_attributes()
RETURNS TRIGGER AS $$
DECLARE
    v_parent_depth INTEGER;
    v_existing_children_count INTEGER;
BEGIN
    -- Если нода корневая (стартовое сообщение чата)
    IF NEW.parent_id IS NULL THEN
        NEW.depth := 0;
        NEW.branch_index := 0;
        NEW.is_fork := FALSE;
        NEW.fork_point_id := NULL;
    ELSE
        -- Защита от циклов: нода не может быть родителем самой себя
        IF NEW.id IS NOT NULL AND NEW.parent_id = NEW.id THEN
            RAISE EXCEPTION 'Нода не может ссылаться на саму себя в качестве родителя (id: %)', NEW.id;
        END IF;

        -- Получаем глубину родительской ноды
        SELECT depth INTO v_parent_depth
        FROM messages
        WHERE id = NEW.parent_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Родительская нода с id % не найдена', NEW.parent_id;
        END IF;

        -- Устанавливаем глубину текущей ноды
        NEW.depth := v_parent_depth + 1;

        -- Считаем количество уже существующих прямых потомков у родителя
        SELECT COUNT(*) INTO v_existing_children_count
        FROM messages
        WHERE parent_id = NEW.parent_id
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

        -- Если это второй или последующий ответ на того же родителя — это новая ветка!
        IF v_existing_children_count > 0 AND NEW.branch_index = 0 THEN
            NEW.branch_index := v_existing_children_count;
            NEW.is_fork := TRUE;
            NEW.fork_point_id := NEW.parent_id;
        ELSIF NEW.branch_index > 0 THEN
            NEW.is_fork := TRUE;
            NEW.fork_point_id := NEW.parent_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер срабатывает при вставке ноды, а также при изменении parent_id
DROP TRIGGER IF EXISTS trg_messages_before_insert ON messages;
DROP TRIGGER IF EXISTS trg_messages_before_insert_or_update ON messages;

CREATE TRIGGER trg_messages_before_insert_or_update
BEFORE INSERT OR UPDATE OF parent_id ON messages
FOR EACH ROW
EXECUTE FUNCTION trg_calculate_message_tree_attributes();

-- ----------------------------------------------------------------------------
-- 2. Триггерная функция обновления updated_at в родительском чате
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_touch_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET updated_at = clock_timestamp()
    WHERE id = COALESCE(NEW.conversation_id, OLD.conversation_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_messages_after_insert ON messages;
DROP TRIGGER IF EXISTS trg_messages_after_change ON messages;

CREATE TRIGGER trg_messages_after_change
AFTER INSERT OR UPDATE OR DELETE ON messages
FOR EACH ROW
EXECUTE FUNCTION trg_touch_conversation_updated_at();

-- ----------------------------------------------------------------------------
-- 3. Функция: fn_get_branch_context
-- Назначение: Выборка чистой линейной цепочки от корня до выбранной ноды
--             Исключает все параллельные ветви и передается в LLM
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_get_branch_context(target_node_id UUID)
RETURNS TABLE (
    step_order INTEGER,
    id UUID,
    conversation_id UUID,
    parent_id UUID,
    role VARCHAR(20),
    content TEXT,
    depth INTEGER,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE branch_path AS (
        -- Начальная точка: целевое сообщение (лист или промежуточная нода)
        SELECT 
            1 AS step,
            m.id,
            m.conversation_id,
            m.parent_id,
            m.role,
            m.content,
            m.depth,
            m.created_at
        FROM messages m
        WHERE m.id = target_node_id

        UNION ALL

        -- Рекурсивный подъем к корню через parent_id
        SELECT 
            bp.step + 1,
            p.id,
            p.conversation_id,
            p.parent_id,
            p.role,
            p.content,
            p.depth,
            p.created_at
        FROM messages p
        JOIN branch_path bp ON p.id = bp.parent_id
    )
    SELECT 
        (ROW_NUMBER() OVER (ORDER BY bp.step DESC))::INTEGER AS step_order,
        bp.id,
        bp.conversation_id,
        bp.parent_id,
        bp.role,
        bp.content,
        bp.depth,
        bp.created_at
    FROM branch_path bp
    ORDER BY bp.step DESC; -- Сортировка от корня (корень первый) к целевой ноде
END;
$$ LANGUAGE plpgsql STABLE;

-- ----------------------------------------------------------------------------
-- 4. Представление: v_conversation_tree_nodes
-- Назначение: Полноценное представление графа для фронтенда с количеством потомков
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_conversation_tree_nodes AS
SELECT 
    m.id,
    m.conversation_id,
    m.parent_id,
    m.role,
    m.content,
    m.depth,
    m.branch_index,
    m.is_fork,
    m.fork_point_id,
    m.created_at,
    m.metadata,
    COALESCE(c.child_count, 0) AS children_count,
    (COALESCE(c.child_count, 0) = 0) AS is_leaf
FROM messages m
LEFT JOIN (
    SELECT parent_id, COUNT(*) AS child_count
    FROM messages
    WHERE parent_id IS NOT NULL
    GROUP BY parent_id
) c ON m.id = c.parent_id;
