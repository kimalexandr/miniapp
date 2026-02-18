#!/bin/sh
set -e
if [ -n "$DATABASE_URL" ]; then
  echo "Running Prisma DB push to ensure schema is synced..."
  npx prisma db push --skip-generate --accept-data-loss
fi
exec node dist/main.js
