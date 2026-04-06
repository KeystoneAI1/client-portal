FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy all source files needed for both server and web build
COPY server/ ./server/
COPY shared/ ./shared/
COPY client/ ./client/
COPY assets/ ./assets/
COPY app.json tsconfig.json babel.config.js ./

# Build server
RUN npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=server_dist

# Build Expo web
ENV EXPO_PUBLIC_API_URL=""
RUN npx expo export --platform web --output-dir web-dist

FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/server_dist ./server_dist/
COPY --from=builder /app/web-dist ./web-dist/

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server_dist/index.js"]
