# Go编译基础镜像
FROM golang:1.21-alpine AS builder
WORKDIR /app
# 拉取依赖
COPY go.mod go.sum ./
RUN go mod download
# 复制全部源码
COPY . .
# 编译程序，输出名为 app 的可执行文件
RUN CGO_ENABLED=0 go build -tags netgo -ldflags '-s -w' -o app

# 轻量化运行镜像
FROM alpine:latest
WORKDIR /app
# 复制编译好的程序
COPY --from=builder /app/app .

EXPOSE 8080
# 启动命令
CMD ["./app"]git add Dockerfile .dockerignore