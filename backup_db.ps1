
# Configurations
$DB_USER = "postgres"
$DB_PASS = "1234" # Change this if your password changes
$DB_NAME = "impresiones_db"
$DB_HOST = "localhost"
$DB_PORT = "5432"
$BACKUP_DIR = "$PSScriptRoot\backups"

# --- Automatic pg_dump Discovery ---
Function Get-PgDumpPath {
    $searchPaths = @(
        "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\14\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\13\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\12\bin\pg_dump.exe"
    )

    # Check PATH first
    if (Get-Command pg_dump.exe -ErrorAction SilentlyContinue) {
        return "pg_dump.exe"
    }

    foreach ($path in $searchPaths) {
        if (Test-Path $path) {
            Write-Host "Found PostgreSQL at: $path" -ForegroundColor Cyan
            return $path
        }
    }

    return $null
}

$PG_DUMP = Get-PgDumpPath

if (-not $PG_DUMP) {
    Write-Error "Could not find pg_dump.exe. Please install PostgreSQL or add it to your PATH."
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# --- Backup Execution ---

# Ensure backup directory exists
if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Force -Path $BACKUP_DIR | Out-Null
    Write-Host "Created backup directory: $BACKUP_DIR" -ForegroundColor Green
}

$TIMESTAMP = Get-Date -Format "yyyy-MM-dd_HHmm"
$BACKUP_FILE = "$BACKUP_DIR\${DB_NAME}_${TIMESTAMP}.sql"

Write-Host "Starting backup of $DB_NAME..." -ForegroundColor Yellow

# Set PGPASSWORD environment variable for the session/process
$env:PGPASSWORD = $DB_PASS

# Run pg_dump
& $PG_DUMP -h $DB_HOST -p $DB_PORT -U $DB_USER -F p -f "$BACKUP_FILE" $DB_NAME

if ($LASTEXITCODE -eq 0) {
    Write-Host "Backup completed successfully!" -ForegroundColor Green
    Write-Host "File saved to: $BACKUP_FILE" -ForegroundColor Cyan
    
    # Optional: Delete backups older than 30 days
    Get-ChildItem -Path $BACKUP_DIR -Filter "${DB_NAME}_*.sql" | 
    Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-30) } | 
    Remove-Item -Force -Verbose
}
else {
    Write-Error "Backup failed with exit code $LASTEXITCODE"
}

# Cleanup env var
$env:PGPASSWORD = $null

# Pause if running interactively (double click)
if ($Host.Name -eq "ConsoleHost") {
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
