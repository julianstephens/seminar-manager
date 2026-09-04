FROM node:24-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

ARG VITE_PROXY_TARGET
ENV VITE_PROXY_TARGET=$VITE_PROXY_TARGET

RUN corepack enable

WORKDIR /app

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/schemas/package.json packages/schemas/package.json

RUN pnpm install --frozen-lockfile

FROM dependencies AS builder

COPY tsconfig.json tsconfig.base.json tsconfig.build.json turbo.json ./
COPY apps/api apps/api
COPY packages/db packages/db
COPY packages/schemas packages/schemas

RUN pnpm --filter api build
RUN pnpm --filter api deploy --prod --legacy /prod/api

FROM node:24-alpine AS runner

ENV NODE_ENV=production

WORKDIR /app

COPY --from=builder --chown=node:node /prod/api ./

USER node

EXPOSE 3000

CMD ["node", "dist/index.mjs"]
