FROM node:24-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/schemas/package.json packages/schemas/package.json

RUN pnpm install --frozen-lockfile

FROM dependencies AS dev

COPY tsconfig.base.json ./
COPY apps/web apps/web
COPY packages/schemas packages/schemas

WORKDIR /app/apps/web

EXPOSE 5173

CMD ["pnpm", "dev", "--host", "0.0.0.0"]

FROM dependencies AS builder

COPY tsconfig.base.json ./
COPY apps/web apps/web
COPY packages/schemas packages/schemas

RUN pnpm --filter web build

FROM nginx:alpine AS runner

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
