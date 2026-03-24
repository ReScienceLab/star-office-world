FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY frontend/ ./frontend/

EXPOSE 19000
VOLUME ["/data"]

ENV STAR_OFFICE_DATA_DIR=/data \
    STAR_OFFICE_MEMORY_DIR=/data/memos \
    STAR_OFFICE_PORT=19000 \
    GATEWAY_URL=https://gateway.agentworlds.ai

CMD ["node", "dist/index.js"]
