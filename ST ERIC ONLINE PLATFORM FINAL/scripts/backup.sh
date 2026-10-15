#!/usr/bin/env bash
# Daily backup: dump PostgreSQL + tar uploads. Keep 14 days.
set -euo pipefail
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DATE=$(date +%Y-%m-%d_%H%M)
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup..."

# PostgreSQL dump
docker compose exec -T db pg_dump -U steric steric | gzip > "$BACKUP_DIR/db-$DATE.sql.gz"

# Uploads
docker compose exec -T backend tar czf - /data/uploads > "$BACKUP_DIR/uploads-$DATE.tar.gz" 2>/dev/null || true

# Clean up old backups (keep 14 days)
find "$BACKUP_DIR" -name "*.gz" -mtime +14 -delete

echo "[$(date)] Backup complete: $BACKUP_DIR/db-$DATE.sql.gz"
