FROM oven/bun:latest AS builder

WORKDIR /app

COPY package.json ./
RUN bun install

COPY . .

RUN bun run build

FROM oven/bun:latest

WORKDIR /app

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["bun", "server.js"]
