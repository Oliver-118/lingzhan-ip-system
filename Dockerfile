FROM node:22-alpine

WORKDIR /app

# 复制依赖定义文件
COPY package.json ./

# 安装生产依赖（含 native addon better-sqlite3 需要 build tools）
RUN apk add --no-cache python3 make g++ && \
    npm install --production && \
    apk del python3 make g++

# 复制项目代码
COPY . .

# 创建数据持久化目录
RUN mkdir -p /app/data /app/public/uploads

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# 启动命令
CMD ["node", "server.js"]
