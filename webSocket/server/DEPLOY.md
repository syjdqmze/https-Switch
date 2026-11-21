# WebSocket Server 后台部署指南

本文档提供四种后台部署方案，适用于不同场景。

---

## 方案对比

| 方案 | 适用场景 | 优点 | 缺点 |
|------|---------|------|------|
| **PM2** | Node.js项目 | 易用、日志管理、自动重启 | 仅限Node.js |
| **Systemd** | Linux服务器 | 系统级服务、开机自启 | 仅限Linux |
| **Docker** | 云环境、集群 | 可移植、标准化部署 | 需要Docker环境 |
| **Nginx反向代理** | 公网访问 | SSL、负载均衡 | 需配合其他方案 |

---

## 方案一：PM2（推荐）

### 优点
- ✅ Node.js专用，配置简单
- ✅ 自动重启、内存监控
- ✅ 日志管理、集群支持
- ✅ 开机自启

### 步骤

```bash
# 1. 安装 PM2
npm install -g pm2

# 2. 编译项目
cd webSocket/server
npm install
npm run build

# 3. 启动服务
pm2 start ecosystem.config.js --env production

# 4. 查看状态
pm2 status
pm2 logs websocket-server

# 5. 开机自启
pm2 save
pm2 startup
```

### 常用命令

| 命令 | 说明 |
|------|------|
| `pm2 start` | 启动服务 |
| `pm2 stop` | 停止服务 |
| `pm2 restart` | 重启服务 |
| `pm2 logs` | 查看日志 |
| `pm2 monit` | 监控界面 |
| `pm2 save` | 保存进程列表 |
| `pm2 startup` | 配置开机自启 |

---

## 方案二：Systemd（Linux系统服务）

### 优点
- ✅ 系统级服务管理
- ✅ 开机自启、崩溃重启
- ✅ 日志集成到系统日志

### 步骤

```bash
# 1. 复制项目到服务器
scp -r webSocket/server/ /opt/websocket-server/

# 2. 编译
cd /opt/websocket-server
npm install
npm run build

# 3. 创建日志目录
mkdir -p logs

# 4. 安装 systemd 服务
sudo cp websocket-server.service /etc/systemd/system/
sudo systemctl daemon-reload

# 5. 启动并启用开机自启
sudo systemctl start websocket-server
sudo systemctl enable websocket-server

# 6. 查看状态
sudo systemctl status websocket-server
sudo journalctl -u websocket-server -f
```

---

## 方案三：Docker（容器化部署）

### 优点
- ✅ 可移植、标准化
- ✅ 环境隔离
- ✅ 易于扩展

### 步骤

```bash
# 1. 构建镜像
docker build -t websocket-server:latest .

# 2. 使用 docker-compose 启动
docker-compose up -d

# 3. 查看日志
docker logs -f websocket-server

# 4. 停止服务
docker-compose down
```

---

## 方案四：Nginx反向代理（公网访问）

### 配置SSL（HTTPS）

```bash
# 1. 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 2. 获取证书
sudo certbot --nginx -d www.studytech.cloud

# 3. 复制 nginx 配置
sudo cp nginx.conf.example /etc/nginx/sites-available/websocket
sudo ln -s /etc/nginx/sites-available/websocket /etc/nginx/sites-enabled/

# 4. 测试并重启
sudo nginx -t
sudo systemctl restart nginx
```

---

## 环境变量配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 8081 | 服务端口 |
| `HOST` | 0.0.0.0 | 绑定地址 |
| `MAX_CONNECTIONS` | 1000 | 最大连接数 |
| `WSS_ENABLED` | false | 启用SSL |
| `WSS_CERT_PATH` | ./certs/cert.pem | SSL证书路径 |
| `WSS_KEY_PATH` | ./certs/cert.key | SSL密钥路径 |

---

## 监控与日志

### PM2 监控
```bash
pm2 monit           # 实时监控
pm2 logs            # 查看日志
pm2 describe websocket-server  # 详细信息
```

### Systemd 日志
```bash
sudo journalctl -u websocket-server -f    # 实时日志
sudo journalctl -u websocket-server --since today  # 今日日志
```

### Docker 日志
```bash
docker logs -f websocket-server
```

---

## 故障排查

### 检查端口占用
```bash
lsof -i:8081
netstat -tlnp | grep 8081
```

### 检查进程
```bash
ps aux | grep node
pm2 list
systemctl status websocket-server
```

### 检查日志
```bash
tail -f logs/error.log
tail -f logs/out.log
```

---

## 推荐配置

**生产环境推荐组合：**

```
PM2（进程管理） + Nginx（反向代理SSL） + Certbot（证书管理）
```

**云环境推荐：**

```
Docker + Docker Compose + Nginx反向代理
```