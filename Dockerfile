# Corporate Mapper — production image.
# Build:  docker build -t corporate-mapper .
# Run:    see docker-compose.yml (app + postgres) or pass DATABASE_URL etc.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund && npx prisma generate

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Dummy URL: prisma client is already generated; next build doesn't connect.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npm run build \
    # Bundle the TS seed to plain JS so the runtime image can seed demo data
    # without tsx/typescript installed.
    && npx esbuild prisma/seed.ts --bundle --platform=node \
       --external:@prisma/client --outfile=prisma/seed.js

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app

# Standalone server + static assets
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Prisma schema + migrations + engine for `migrate deploy` on boot
COPY --from=build /app/prisma ./prisma
COPY --from=deps /app/node_modules/prisma ./node_modules/prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=deps /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY docker-entrypoint.sh ./

RUN mkdir -p /app/storage && chown -R app:app /app
USER app
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0 STORAGE_DIR=/app/storage

ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
