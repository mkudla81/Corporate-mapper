#!/bin/sh
set -e

echo "Applying database migrations…"
node node_modules/prisma/build/index.js migrate deploy

if [ "$SEED_DEMO" = "true" ]; then
  echo "SEED_DEMO=true — seeding demo data (no-op if data exists)…"
  node prisma/seed.js || true
fi

echo "Starting Corporate Mapper on :$PORT"
exec node server.js
