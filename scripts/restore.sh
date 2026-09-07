#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Uso: $0 <archivo_backup.dump> [nombre_base_destino]"
  exit 1
fi

BACKUP_FILE="$1"
TARGET_DB="${2:-onlyturn}"
DB_USER="${POSTGRES_USER:-onlyturn}"
CONTAINER_DB="${CONTAINER_DB:-onlyturn-db}"

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "[restore] ERROR: Archivo no encontrado: ${BACKUP_FILE}"
  exit 1
fi

echo "[restore] ADVERTENCIA: Esta operacion restaurara ${BACKUP_FILE} en la base ${TARGET_DB} del contenedor ${CONTAINER_DB}."
read -p "¿Desea continuar? (escriba 'CONFIRMAR'): " CONFIRM
if [[ "${CONFIRM}" != "CONFIRMAR" ]]; then
  echo "[restore] Cancelado por el usuario."
  exit 1
fi

echo "[restore] Restaurando..."
docker exec -i "${CONTAINER_DB}" pg_restore -U "${DB_USER}" -d "${TARGET_DB}" --clean --if-exists < "${BACKUP_FILE}" || true

echo "[restore] Restauracion finalizada. Verifique los datos con una prueba funcional."
