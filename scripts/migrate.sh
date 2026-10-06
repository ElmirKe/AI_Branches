#!/usr/bin/env bash
set -e

ACTION="${1:-up}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-branching_chat}"
DB_USER="${DB_USER:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgrespassword}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"

execute_sql() {
    local file_path="$1"
    echo ">> [MIGRATE] Применение $file_path"
    if command -v psql &> /dev/null; then
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$file_path"
    elif command -v docker &> /dev/null; then
        docker exec -i branching_chat_postgres psql -U "$DB_USER" -d "$DB_NAME" < "$file_path"
    else
        echo "Ошибка: Ни psql, ни docker не найдены."
        exit 1
    fi
}

case "$ACTION" in
    up)
        echo "=== Накатывание миграций (UP) ==="
        execute_sql "$BASE_DIR/migrations/001_initial_schema.up.sql"
        execute_sql "$BASE_DIR/migrations/002_tree_functions_and_triggers.up.sql"
        echo "Все миграции успешно применены!"
        ;;
    down)
        echo "=== Откат миграций (DOWN) ==="
        execute_sql "$BASE_DIR/migrations/002_tree_functions_and_triggers.down.sql"
        execute_sql "$BASE_DIR/migrations/001_initial_schema.down.sql"
        echo "Откат миграций выполнен!"
        ;;
    seed)
        echo "=== Загрузка сид-данных ==="
        execute_sql "$BASE_DIR/seeds/001_seed_pressure_chat.sql"
        echo "Тестовые данные загружены!"
        ;;
    test)
        echo "=== Тестирование выборки контекста ==="
        execute_sql "$BASE_DIR/queries/01_get_llm_context_path.sql"
        ;;
    *)
        echo "Использование: ./migrate.sh [up|down|seed|test]"
        exit 1
        ;;
esac
