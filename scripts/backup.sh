#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/backups/onlyturn}"
PROJECT_NAME="${PROJECT_NAME:-onlyturn}"
CONTAINER_DB="${CONTAINER_DB:-onlyturn-db}"
DB_USER="${POSTGRES_USER:-onlyturn}"
DB_NAME="${POSTGRES_DB:-onlyturn}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/onlyturn_${TIMESTAMP}.dump"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "${BACKUP_DIR}"

echo "[backup] Starting PostgreSQL dump for ${PROJECT_NAME}..."
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_DB}$"; then
  docker exec -t "${CONTAINER_DB}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" -Fc > "${BACKUP_FILE}"
else
  docker compose -p "${PROJECT_NAME}" exec -T db pg_dump -U "${DB_USER}" -d "${DB_NAME}" -Fc > "${BACKUP_FILE}"
fi

if [[ ! -s "${BACKUP_FILE}" ]]; then
  echo "[backup] ERROR: Backup file is empty or missing: ${BACKUP_FILE}"
  rm -f "${BACKUP_FILE}"
  exit 1
fi

SIZE="$(du -h "${BACKUP_FILE}" | cut -f1)"
echo "[backup] Success: ${BACKUP_FILE} (${SIZE})"

echo "[backup] Cleaning up dumps older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name "onlyturn_*.dump" -mtime +"${RETENTION_DAYS}" -delete

echo "[backup] Completed successfully."
