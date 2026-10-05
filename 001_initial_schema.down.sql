-- ============================================================================
-- Migration: 001_initial_schema.down.sql
-- Description: Откат начальной схемы (удаление таблиц и индексов)
-- Dialect: PostgreSQL (13+)
-- ============================================================================

DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
