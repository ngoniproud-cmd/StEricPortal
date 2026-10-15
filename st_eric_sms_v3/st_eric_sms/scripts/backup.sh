#!/usr/bin/env bash
# Nightly backup: database + uploaded files. Cron: 0 2 * * * /path/to/st_eric_sms/scripts/backup.sh /mnt/backup_drive
set -euo pipefail
DEST="${1:?Usage: backup.sh <destination-folder>}"; STAMP=$(date +%Y%m%d-%H%M); cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
mkdir -p "$DEST"
docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$DEST/db-$STAMP.sql.gz"
tar czf "$DEST/uploads-$STAMP.tar.gz" uploads
find "$DEST" -name 'db-*.sql.gz' -mtime +30 -delete; find "$DEST" -name 'uploads-*.tar.gz' -mtime +30 -delete
echo "Backup written to $DEST ($STAMP)"
# Restore: gunzip -c db-STAMP.sql.gz | docker compose exec -T db psql -U $POSTGRES_USER $POSTGRES_DB
