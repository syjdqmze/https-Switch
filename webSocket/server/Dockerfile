# 使用 Node.js LTS 版本
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装依赖（生产模式）
RUN npm ci --only=production

# 复制源代码
COPY . .

# 编译 TypeScript
RUN npm run build

# 创建日志目录
RUN mkdir -p logs

# 暴露端口
EXPOSE 8081

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=8081
ENV HOST=0.0.0.0

# 启动服务
CMD ["node", "dist/index.js"]