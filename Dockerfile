# Stage 1: Build frontend
FROM node:22-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
# npm ci, not npm install: installs exactly what package-lock.json pins and
# fails if the lockfile is out of sync. With npm install the same commit could
# resolve a different dependency tree on different days, so two builds of one
# tag were not guaranteed to contain the same frontend.
RUN npm ci --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM rust:1-slim-bookworm AS backend-builder
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
# Cache dependency builds
COPY backend/Cargo.toml backend/Cargo.lock ./
RUN mkdir src && echo 'fn main() {}' > src/main.rs && cargo build --release && rm -rf src target/release/deps/dashboard*
# Build the real binary
COPY backend/src/ src/
COPY backend/migrations/ migrations/
RUN cargo build --release

# Stage 3: Runtime
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=backend-builder /app/backend/target/release/dashboard-backend .
COPY --from=frontend-builder /app/frontend/dist/ static/
COPY backend/manifest.json ./manifest.json

ENV PORT=3042
ENV DATABASE_URL=sqlite:/data/dashboard.db?mode=rwc
EXPOSE 3042

VOLUME /data

CMD ["./dashboard-backend"]
