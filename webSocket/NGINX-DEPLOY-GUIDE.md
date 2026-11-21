# Nginx 反向代理配置部署指南

## 架构说明

```
客户端 (wss://www.studytech.cloud/ws)
    ↓
Nginx (443端口, SSL终止)
    ↓
WebSocket服务器 (localhost:8081, ws://)
```

## 服务器端部署步骤

### 步骤 1: 安装 Nginx

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx

# CentOS/RHEL
sudo yum install nginx
```

### 步骤 2: 上传配置文件

将 `nginx-websocket.conf` 上传到服务器：

```bash
# 方法1: 直接复制内容
sudo nano /etc/nginx/sites-available/websocket
# 粘贴配置内容，保存退出

# 方法2: 上传文件后移动
sudo cp nginx-websocket.conf /etc/nginx/sites-available/websocket
```

### 步骤 3: 启用配置

```bash
# 创建符号链接启用配置
sudo ln -s /etc/nginx/sites-available/websocket /etc/nginx/sites-enabled/

# 删除默认配置（可选）
sudo rm /etc/nginx/sites-enabled/default

# 测试配置是否正确
sudo nginx -t
```

预期输出：
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 步骤 4: 重启 Nginx

```bash
sudo systemctl restart nginx
sudo systemctl enable nginx  # 设置开机自启
sudo systemctl status nginx  # 检查状态
```

### 步骤 5: 配置防火墙

```bash
# Ubuntu (使用 ufw)
sudo ufw allow 'Nginx Full'
sudo ufw status

# CentOS (使用 firewalld)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 步骤 6: 配置 WebSocket 服务器（禁用 TLS）

```bash
# 停止当前服务器（如果正在运行）
pkill -f "node.*dist/index.js"

# 禁用 TLS，改为普通 ws:// 模式
cd /path/to/webSocket/server
export WSS_ENABLED=false

# 重新编译并启动
npm run build
npm start
```

服务器启动后应显示：
```
WebSocket server started on ws://0.0.0.0:8081
```

### 步骤 7: 验证配置

```bash
# 测试 HTTPS 连接
curl -I https://www.studytech.cloud

# 测试 WebSocket 连接（需要 wscat）
npm install -g wscat
wscat -c wss://www.studytech.cloud/ws

# 检查 Nginx 日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 阿里云安全组配置

在阿里云控制台配置安全组规则：

| 端口范围 | 协议 | 授权对象 | 说明 |
|----------|------|----------|------|
| 80 | TCP | 0.0.0.0/0 | HTTP（重定向到 HTTPS） |
| 443 | TCP | 0.0.0.0/0 | HTTPS + WebSocket |
| 8081 | TCP | 127.0.0.1 | 仅本地访问（可选） |

## 客户端连接地址

客户端连接地址：
```
wss://www.studytech.cloud/ws
```

## 常见问题排查

### 问题 1: Nginx 配置测试失败

```bash
# 查看详细错误信息
sudo nginx -t

# 检查配置文件语法
sudo cat /etc/nginx/sites-available/websocket
```

### 问题 2: WebSocket 连接失败

检查 Nginx 错误日志：
```bash
sudo tail -f /var/log/nginx/error.log
```

常见错误：
- `upgrade` 头部未正确设置
- WebSocket 服务器未运行
- 端口配置错误

### 问题 3: SSL 证书错误

```bash
# 检查证书文件
ls -lh /etc/ssl/certs/cert.pem
ls -lh /etc/ssl/certs/cert.key

# 测试证书
openssl x509 -in /etc/ssl/certs/cert.pem -noout -text
```

### 问题 4: 502 Bad Gateway

原因：WebSocket 服务器未运行或端口错误

解决：
```bash
# 检查服务器是否运行
ps aux | grep node
netstat -tlnp | grep 8081

# 启动服务器
cd /path/to/webSocket/server
npm start
```

## 性能优化配置（可选）

编辑 Nginx 配置添加以下内容：

```nginx
# 在 server 块内添加

# 启用 gzip 压缩
gzip on;
gzip_types text/plain application/json;

# 连接限制
limit_conn_zone $binary_remote_addr zone=websocket:10m;
limit_conn websocket 10;  # 每个 IP 最多 10 个连接

# 负载均衡（多实例）
upstream websocket_backend {
    server localhost:8081;
    server localhost:8082;
}
```

## 监控和日志

```bash
# 实时监控 Nginx 访问日志
sudo tail -f /var/log/nginx/access.log | grep ws

# 监控 WebSocket 连接数
sudo ss -tunlp | grep :443 | wc -l
```

## 配置文件位置

| 文件 | 位置 |
|------|------|
| Nginx 配置 | `/etc/nginx/sites-available/websocket` |
| SSL 证书 | `/etc/ssl/certs/cert.pem` |
| SSL 私钥 | `/etc/ssl/certs/cert.key` |
| Nginx 访问日志 | `/var/log/nginx/access.log` |
| Nginx 错误日志 | `/var/log/nginx/error.log` |