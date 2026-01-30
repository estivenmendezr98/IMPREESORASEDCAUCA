
# Configurations
$DB_USER = "postgres"
$DB_PASS = "1234" # Change this if your password changes
$DB_NAME = "impresiones_db"
$DB_HOST = "localhost"
$DB_PORT = "5432"

# --- Automatic psql Discovery ---
Function Get-PsqlPath {
    $searchPaths = @(
        "C:\Program Files\PostgreSQL\18\bin\psql.exe",
        "C:\Program Files\PostgreSQL\17\bin\psql.exe",
        "C:\Program Files\PostgreSQL\16\bin\psql.exe",
        "C:\Program Files\PostgreSQL\15\bin\psql.exe",
        "C:\Program Files\PostgreSQL\14\bin\psql.exe",
        "C:\Program Files\PostgreSQL\13\bin\psql.exe",
        "C:\Program Files\PostgreSQL\12\bin\psql.exe"
    )

    if (Get-Command psql.exe -ErrorAction SilentlyContinue) {
        return "psql.exe"
    }

    foreach ($path in $searchPaths) {
        if (Test-Path $path) {
            return $path
        }
    }
    return $null
}

$PSQL = Get-PsqlPath

if (-not $PSQL) {
    Write-Error "Could not find psql.exe."
    exit 1
}

# --- Restore Execution ---
$backupFile = $args[0]

if (-not $backupFile) {
    Write-Host "Please provide the backup file path to restore." -ForegroundColor Yellow
    Write-Host "Usage: .\restore_db.ps1 .\backups\impresiones_db_YYYY-MM-DD_HHmm.sql"
    exit 1
}

if (-not (Test-Path $backupFile)) {
    Write-Error "Backup file not found: $backupFile"
    exit 1
}

Write-Host "WARNING: This will overwrite the database '$DB_NAME' with data from '$backupFile'." -ForegroundColor Red
Write-Host "Do you want to continue? (Y/N)" -NoNewline
$confirm = Read-Host

if ($confirm -ne "Y" -and $confirm -ne "y") {
    Write-Host "Restore cancelled."
    exit 0
}

Write-Host "Restoring database..." -ForegroundColor Yellow

$env:PGPASSWORD = $DB_PASS

& $PSQL -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$backupFile"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Restore completed successfully!" -ForegroundColor Green
}
else {
    Write-Error "Restore failed with exit code $LASTEXITCODE"
}

$env:PGPASSWORD = $null
