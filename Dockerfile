FROM node:18-alpine

WORKDIR /app

# 复制后端依赖
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install --production

# 复制所有代码
WORKDIR /app
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# 创建上传目录
RUN mkdir -p /app/backend/uploads

# 设置工作目录为 backend
WORKDIR /app/backend

EXPOSE 8080

CMD ["node", "server.js"]