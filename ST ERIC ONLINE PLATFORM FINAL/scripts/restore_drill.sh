#!/usr/bin/env bash
# PostgreSQL backup, restore drill, and verification test
set -euo pipefail

CONTAINER="${PG_CONTAINER:-steric-db-1}"
DB_USER="${POSTGRES_USER:-steric}"
DB_NAME="${POSTGRES_DB:-steric}"
DRILL_DIR="$(mktemp -d)"

echo "=== Starting St Eric PostgreSQL Restore Drill ==="
echo "Testing against container: $CONTAINER, Database: $DB_NAME"

# Step 1: Record pre-backup record counts
echo "1. Querying pre-backup counts..."
PRE_USERS=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM users;" | xargs)
PRE_STUDENTS=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM students;" | xargs)
echo "   Users: $PRE_USERS, Students: $PRE_STUDENTS"

# Step 2: Dump database
echo "2. Dumping database..."
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -F c > "$DRILL_DIR/drill_dump.pgdump"

# Step 3: Simulate disaster - drop and recreate database
echo "3. Simulating disaster: dropping and recreating database..."
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME}_drill;"
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE ${DB_NAME}_drill;"

# Step 4: Restore dump to drill database
echo "4. Restoring dump to drill database..."
docker exec -i "$CONTAINER" pg_restore -U "$DB_USER" -d "${DB_NAME}_drill" < "$DRILL_DIR/drill_dump.pgdump"

# Step 5: Verify counts
echo "5. Verifying restored counts..."
POST_USERS=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "${DB_NAME}_drill" -t -c "SELECT COUNT(*) FROM users;" | xargs)
POST_STUDENTS=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "${DB_NAME}_drill" -t -c "SELECT COUNT(*) FROM students;" | xargs)
echo "   Restored Users: $POST_USERS, Restored Students: $POST_STUDENTS"

if [ "$PRE_USERS" -ne "$POST_USERS" ] || [ "$PRE_STUDENTS" -ne "$POST_STUDENTS" ]; then
    echo "ERROR: Data count mismatch between original and restored database!"
    docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE ${DB_NAME}_drill;"
    rm -rf "$DRILL_DIR"
    exit 1
fi

echo "6. Cleaning up drill database..."
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE ${DB_NAME}_drill;"
rm -rf "$DRILL_DIR"

echo "=== Restore Drill PASSED: All table counts verified successfully! ==="
