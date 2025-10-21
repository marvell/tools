# syntax=docker/dockerfile:1

FROM oven/bun:1.3-slim AS base
WORKDIR /app

FROM base AS deps
COPY ./package.json ./bun.lock ./bunfig.toml ./
RUN bun install --frozen-lockfile

FROM base AS production

ENV NODE_ENV=production
ENV PORT=80

USER bun

COPY --from=deps --chown=bun:bun /app/node_modules ./node_modules
COPY --chown=bun:bun . .

EXPOSE 80

CMD ["bun", "run", "start"]
