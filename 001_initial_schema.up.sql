-- ============================================================================
-- Migration: 001_initial_schema.up.sql
-- Description: Создание основных таблиц чата и сообщений-нод (дерево диалогов)
-- Dialect: PostgreSQL (13+)
-- ============================================================================

-- Включаем генерацию UUID (если не включено)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Таблица: conversations (Общий чат)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL DEFAULT 'Новый диалог',
    system_prompt TEXT DEFAULT 'Ты полезный ИИ-ассистент. Отвечай точно и по делу.',
    default_model VARCHAR(100) NOT NULL DEFAULT 'gemini-1.5-flash',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE conversations IS 'Общие чаты / корневые диалоги';
COMMENT ON COLUMN conversations.id IS 'Уникальный идентификатор чата';
COMMENT ON COLUMN conversations.title IS 'Название чата (тема)';
COMMENT ON COLUMN conversations.system_prompt IS 'Системная инструкция по умолчанию для этого чата';
COMMENT ON COLUMN conversations.default_model IS 'Идентификатор модели ИИ по умолчанию';
COMMENT ON COLUMN conversations.created_at IS 'Дата и время создания чата';
COMMENT ON COLUMN conversations.updated_at IS 'Дата и время последнего сообщения/обновления';

-- ----------------------------------------------------------------------------
-- 2. Таблица: messages (Сообщения-ноды графа / дерева)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    
    -- Идентификатор родительской ноды. 
    -- Если NULL — это стартовое сообщение (корень дерева диалога)
    parent_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    
    -- Роль участника: 'user' (пользователь), 'assistant' (ИИ), 'system' (системное)
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    
    -- Текст сообщения
    content TEXT NOT NULL,
    
    -- Поля ветвления (Fork / Branching):
    -- is_fork: является ли нода точкой альтернативного ответвления
    is_fork BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- fork_point_id: ссылка на ноду, от которой произошло ветвление
    -- (обычно совпадает с parent_id для первой ноды новой ветки)
    fork_point_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    
    -- Порядковый номер альтернативной ветви у одного родителя (0 - основная, 1, 2... - ответвления)
    branch_index INTEGER NOT NULL DEFAULT 0,
    
    -- Глубина ноды в дереве (0 для корня, 1 для первого ответа, 2 для второго и т.д.)
    depth INTEGER NOT NULL DEFAULT 0,
    
    -- Дополнительные параметры (токены, reasoning, temperature, finish_reason и т.д.)
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE messages IS 'Сообщения чата, представленные в виде узлов (нод) ориентированного дерева';
COMMENT ON COLUMN messages.id IS 'Уникальный идентификатор ноды сообщения';
COMMENT ON COLUMN messages.conversation_id IS 'Ссылка на чат, которому принадлежит нода';
COMMENT ON COLUMN messages.parent_id IS 'Ссылка на родительское сообщение (NULL для корня)';
COMMENT ON COLUMN messages.role IS 'Роль: user / assistant / system';
COMMENT ON COLUMN messages.content IS 'Текстовое содержимое сообщения';
COMMENT ON COLUMN messages.is_fork IS 'Флаг: открывает ли данное сообщение новую альтернативную ветку';
COMMENT ON COLUMN messages.fork_point_id IS 'Ссылка на ноду-источник ответвления';
COMMENT ON COLUMN messages.branch_index IS 'Индекс ветки среди дочерних нод одного родителя (0, 1, 2...)';
COMMENT ON COLUMN messages.depth IS 'Уровень вложенности (глубина) узла в дереве диалога';
COMMENT ON COLUMN messages.metadata IS 'Служебные метаданные (токены, параметры вызова ИИ, флаги)';
COMMENT ON COLUMN messages.created_at IS 'Дата и время создания ноды';

-- ----------------------------------------------------------------------------
-- 3. Индексы для максимальной производительности выборок деревьев
-- ----------------------------------------------------------------------------

-- Быстрый поиск всех нод конкретного чата
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id 
    ON messages (conversation_id);

-- Быстрый переход к детям ноды (построение дерева вниз)
CREATE INDEX IF NOT EXISTS idx_messages_parent_id 
    ON messages (parent_id);

-- Составной индекс для сборки дерева и веток чата
CREATE INDEX IF NOT EXISTS idx_messages_conv_parent 
    ON messages (conversation_id, parent_id);

-- Индекс для рекурсивного CTE (подъем по parent_id)
CREATE INDEX IF NOT EXISTS idx_messages_id_parent 
    ON messages (id, parent_id);

-- Индекс для хронологической сортировки нод в чате
CREATE INDEX IF NOT EXISTS idx_messages_conv_created 
    ON messages (conversation_id, created_at ASC);

-- GIN-индекс для быстрого поиска по JSONB-метаданным
CREATE INDEX IF NOT EXISTS idx_messages_metadata_gin 
    ON messages USING gin (metadata);
