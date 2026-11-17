FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium ca-certificates fonts-noto-core && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN corepack pnpm install --frozen-lockfile
COPY . ./
RUN corepack pnpm build
ENV NODE_ENV=production PORT=3000 CHROMIUM_PATH=/usr/bin/chromium
EXPOSE 3000
CMD ["node", "dist/index.js"]
