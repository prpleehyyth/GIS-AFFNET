FROM golang:alpine

WORKDIR /app

# Install Air (Tools untuk Auto-Reload Golang)
RUN go install github.com/air-verse/air@latest

# Copy file dependency
COPY go.mod go.sum ./
RUN go mod download

# Copy sisa kode
COPY . .

EXPOSE 8080

# Jalankan Air, bukan file main yang statis
CMD ["air"]