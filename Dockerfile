# --- build ---------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app
# Compilers for better-sqlite3 in case no prebuilt binary matches (build stage only).
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- run -----------------------------------------------------------------
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    SQLITE_PATH=/app/data/app.db

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# seed script (they use packages already in the standalone node_modules)
COPY --from=build --chown=node:node /app/scripts ./scripts
RUN mkdir -p /app/data && chown node:node /app/data

USER node
EXPOSE 3000
CMD ["node", "server.js"]
