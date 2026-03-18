FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/
RUN npm ci --omit=dev

COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/src ./server/src
COPY --from=builder /app/server/db ./server/db
COPY --from=builder /app/.env.example ./.env.example
COPY --from=builder /app/README.md ./README.md

EXPOSE 4000
CMD ["npm", "run", "start", "--workspace", "server"]
