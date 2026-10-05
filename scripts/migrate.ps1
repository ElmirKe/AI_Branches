param (
    [Parameter(Position=0)]
    [ValidateSet("up", "down", "seed", "test")]
    [string]$Action = "up",

    [string]$HostName = "localhost",
    [int]$Port = 5432,
    [string]$DbName = "branching_chat",
    [string]$User = "postgres",
    [string]$Password = "postgrespassword"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BaseDir = Split-Path -Parent $ScriptDir

$env:PGPASSWORD = $Password

function Execute-SqlFile ($filePath) {
    Write-Host "[MIGRATE] Применение: $filePath" -ForegroundColor Cyan
    if (Get-Command psql -ErrorAction SilentlyContinue) {
        psql -h $HostName -p $Port -U $User -d $DbName -f $filePath
    } elseif (Get-Command docker -ErrorAction SilentlyContinue) {
        Get-Content $filePath -Raw -Encoding UTF8 | docker exec -i branching_chat_postgres psql -U $User -d $DbName
    } else {
        Write-Warning "Ни 'psql', ни 'docker' не найдены в PATH. Убедитесь, что база доступна, или используйте любой SQL-клиент (DBeaver, DataGrip, VS Code Database Client)."
    }
}

switch ($Action) {
    "up" {
        Write-Host "=== Накатывание миграций (UP) ===" -ForegroundColor Green
        Execute-SqlFile "$BaseDir\migrations\001_initial_schema.up.sql"
        Execute-SqlFile "$BaseDir\migrations\002_tree_functions_and_triggers.up.sql"
        Write-Host "Все миграции успешно применены!" -ForegroundColor Green
    }
    "down" {
        Write-Host "=== Откат миграций (DOWN) ===" -ForegroundColor Yellow
        Execute-SqlFile "$BaseDir\migrations\002_tree_functions_and_triggers.down.sql"
        Execute-SqlFile "$BaseDir\migrations\001_initial_schema.down.sql"
        Write-Host "Откат миграций выполнен!" -ForegroundColor Yellow
    }
    "seed" {
        Write-Host "=== Загрузка сид-данных (Тестовый чат 'Значение давления') ===" -ForegroundColor Green
        Execute-SqlFile "$BaseDir\seeds\001_seed_pressure_chat.sql"
        Write-Host "Тестовые данные загружены!" -ForegroundColor Green
    }
    "test" {
        Write-Host "=== Проверка выборки контекста для ИИ ===" -ForegroundColor Cyan
        Execute-SqlFile "$BaseDir\queries\01_get_llm_context_path.sql"
    }
}
