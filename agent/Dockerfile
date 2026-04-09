FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install Protoc
RUN apk add --no-cache protobuf-dev

# Copy Go mod first
COPY go.mod ./
# Download dependencies (including grpc)
RUN go mod tidy

# Install Protoc Plugins
RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.31.0
RUN go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.3.0

# Copy source
COPY . .

# Generate Proto Code
# We need to ensure the output directory exists if paths=source_relative uses it, but files are in proto/
RUN protoc --go_out=. --go_opt=paths=source_relative \
    --go-grpc_out=. --go-grpc_opt=paths=source_relative \
    proto/agent.proto

# Build Static Binary
RUN CGO_ENABLED=0 GOOS=linux go build -o agent_bin main.go

# --- Final Stage ---
FROM alpine:latest

# Install Nginx for syntax validation
RUN apk add --no-cache nginx

WORKDIR /app

# Create socket directory
RUN mkdir -p /var/run/agent
# Create nginx directories if missing (for validation context)
RUN mkdir -p /etc/nginx/sites-enabled /etc/nginx/modsecurity/rules.d

COPY --from=builder /app/agent_bin /app/agent

# Run
CMD ["/app/agent"]
