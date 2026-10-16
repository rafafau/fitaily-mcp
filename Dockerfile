# Multi-stage: TS build inside docker (native arch, locked deps via pnpm).
FROM node:24-alpine AS builder
WORKDIR /build
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

FROM node:24-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=builder /build/dist ./dist
ENV NODE_ENV=production PORT=3091
EXPOSE 3091
CMD ["node", "dist/index.js"]
