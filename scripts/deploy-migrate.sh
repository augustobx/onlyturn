#!/bin/sh
set -e

echo "[deploy-migrate] Running Prisma migrations..."
npx prisma migrate deploy

echo "[deploy-migrate] Running platform bootstrap..."
node scripts/bootstrap-platform.mjs

echo "[deploy-migrate] Done!"
