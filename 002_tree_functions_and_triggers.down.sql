-- ============================================================================
-- Migration: 002_tree_functions_and_triggers.down.sql
-- Description: Откат триггеров, функций и представлений
-- Dialect: PostgreSQL (13+)
-- ============================================================================

DROP VIEW IF EXISTS v_conversation_tree_nodes;
DROP FUNCTION IF EXISTS fn_get_branch_context(UUID);
DROP TRIGGER IF EXISTS trg_messages_after_change ON messages;
DROP TRIGGER IF EXISTS trg_messages_after_insert ON messages;
DROP FUNCTION IF EXISTS trg_touch_conversation_updated_at();
DROP TRIGGER IF EXISTS trg_messages_before_insert_or_update ON messages;
DROP TRIGGER IF EXISTS trg_messages_before_insert ON messages;
DROP FUNCTION IF EXISTS trg_calculate_message_tree_attributes();
