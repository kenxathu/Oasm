# Stage 1: Build
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install git for go mod download
RUN apk add --no-cache git ca-certificates curl

ENV GOTOOLCHAIN=auto

# Copy go mod files first (for better layer caching)
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build static binary with optimizations from the new APP entrypoint
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags='-w -s -extldflags "-static"' \
    -o oasm-worker ./cmd/app

# Stage 2: Runtime
FROM debian:bookworm-slim

WORKDIR /app

# Install ca-certificates for TLS, bash, chromium for browser tasks, libpcap for naabu, and security scanning tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    bash \
    chromium \
    libpcap0.8 \
    nmap \
    git \
    perl \
    libjson-perl \
    libnet-ssleay-perl \
    libxml-writer-perl \
    libwww-perl \
    && rm -rf /var/lib/apt/lists/*

# Install Nikto from source (some Debian images do not include a nikto package)
RUN git clone https://github.com/sullo/nikto.git /opt/nikto && \
    bash -lc 'if [ -f /opt/nikto/program/nikto.pl ]; then ln -s /opt/nikto/program/nikto.pl /usr/local/bin/nikto; elif [ -f /opt/nikto/nikto.pl ]; then ln -s /opt/nikto/nikto.pl /usr/local/bin/nikto; fi' && \
    chmod +x /usr/local/bin/nikto || true

# Create tool directory
RUN mkdir -p /app/oasm-tools

# Copy binary from builder
COPY --from=builder /app/oasm-worker .

# Create non-root user for security
RUN groupadd -g 1000 worker && \
    useradd -u 1000 -g worker -s /bin/bash -m worker

# Change ownership of app directory
RUN chown -R worker:worker /app

USER worker

# Default environment variables (override at runtime with -e)
# Required:
#   WORKER_API_KEY - Your worker authentication key
# Optional:
#   WORKER_MAX_CONCURRENCY - Max concurrent tasks (default: 10)
#   WORKER_INSTANCES - Worker instances to run in this process, 1-10 (default: 1)
#   WORKER_GRPC_HOST - gRPC server host (default: localhost)
#   WORKER_GRPC_PORT - gRPC server port (default: 16276)
#   WORKER_TOOL_PATH - Tool path (default: oasm-tools)
ENV WORKER_MAX_CONCURRENCY=10
ENV WORKER_INSTANCES=1
ENV WORKER_GRPC_HOST=localhost
ENV WORKER_GRPC_PORT=16276
ENV WORKER_TOOL_PATH=oasm-tools

# Metadata
LABEL org.opencontainers.image.title="OASM Worker"
LABEL org.opencontainers.image.description="Attack Surface Management worker agent"
LABEL org.opencontainers.image.vendor="OASM Platform"

# Entrypoint
ENTRYPOINT ["/app/oasm-worker"]
