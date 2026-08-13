#!/bin/bash
# Apply all migrations to a self-hosted Supabase database.
# Usage: ./scripts/migrate.sh [db-container] [db-user] [db-name]
# Defaults: supabase-db / supabase_admin / postgres
# (supabase_admin is the superuser on self-hosted Supabase — needed for storage policies)

set -e

DB_CONTAINER="${1:-supabase-db}"
DB_USER="${2:-supabase_admin}"
DB_NAME="${3:-postgres}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/../supabase/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "ERROR: migrations directory not found: $MIGRATIONS_DIR"
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  echo "ERROR: container '$DB_CONTAINER' not running. Start Supabase first."
  exit 1
fi

echo "Applying migrations to $DB_CONTAINER ($DB_USER/$DB_NAME)..."

for f in "$MIGRATIONS_DIR"/*.sql; do
  name="$(basename "$f")"
  # Capture all output; only real ERROR lines are shown (NOTICEs are ignored)
  output="$(docker exec -i "$DB_CONTAINER" psql -q -U "$DB_USER" -d "$DB_NAME" < "$f" 2>&1)"
  code=$?
  errors="$(echo "$output" | grep -E '^ERROR' || true)"
  if [ $code -ne 0 ] || [ -n "$errors" ]; then
    echo "  ✗ $name — FAILED"
    echo "$errors"
    exit 1
  fi
  echo "  ✓ $name — applied"
done

echo "All migrations applied."
