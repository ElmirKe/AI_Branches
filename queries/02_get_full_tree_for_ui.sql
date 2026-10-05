-- ============================================================================
-- Query: 02_get_full_tree_for_ui.sql
-- Назначение: Выборка всех нод чата для построения древовидного интерфейса
--             (графа нод «Coconut tree») на фронтенде
-- ============================================================================

-- Выборка через представление со счетчиком детей и флагом листа (is_leaf)
SELECT 
    id,
    conversation_id,
    parent_id,
    role,
    content,
    depth,
    branch_index,
    is_fork,
    fork_point_id,
    children_count,
    is_leaf,
    created_at,
    metadata
FROM v_conversation_tree_nodes
WHERE conversation_id = '11111111-1111-1111-1111-111111111111'::uuid
ORDER BY depth ASC, branch_index ASC, created_at ASC;

-- Альтернатива: сборка графа с массивом идентификаторов детей для быстрого рендеринга
SELECT 
    m.id,
    m.parent_id,
    m.role,
    m.content,
    m.depth,
    m.branch_index,
    m.is_fork,
    COALESCE(
        json_agg(json_build_object('child_id', c.id, 'branch_index', c.branch_index)) 
        FILTER (WHERE c.id IS NOT NULL), 
        '[]'::json
    ) AS children
FROM messages m
LEFT JOIN messages c ON c.parent_id = m.id
WHERE m.conversation_id = '11111111-1111-1111-1111-111111111111'::uuid
GROUP BY m.id, m.parent_id, m.role, m.content, m.depth, m.branch_index, m.is_fork, m.created_at
ORDER BY m.depth ASC, m.branch_index ASC, m.created_at ASC;
