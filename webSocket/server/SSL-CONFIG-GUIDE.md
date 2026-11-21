# WebSocket 服务器 SSL/TLS 配置指南

## 问题分析

当前 WebSocket 连接失败的根本原因：
1. **HTTPS 页面强制使用 wss://**：浏览器安全策略禁止 HTTPS 页面使用 ws://（非安全 WebSocket）
2. **服务器未启用 TLS**：服务器默认运行 ws://，未配置 SSL 证书
3. **SSL 证书缺失**：服务器没有有效的 DV SSL 证书

## 解决方案：配置 DV SSL 证书启用 WSS

### 方案一：使用 Let's Encrypt 免费 DV SSL 证书（推荐）

#### 步骤 1：在服务器上安装 Certbot

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install certbot

# CentOS/RHEL
sudo yum install certbot

# 或者使用 snap
sudo snap install certbot --classic
```

#### 步骤 2：获取 DV SSL 证书

```bash
# 确保域名已解析到服务器 IP (39.108.234.32)
# 域名: www.studytech.cloud

# 使用 standalone 模式获取证书（需要临时停止其他服务）
sudo certbot certonly --standalone -d www.studytech.cloud

# 或使用 webroot 模式（如果已有 web 服务）
sudo certbot certonly --webroot -w /var/www/html -d www.studytech.cloud
```

#### 步骤 3：证书文件位置

Let's Encrypt 证书默认存储位置：
```
证书: /etc/ssl/certs/cert.pem
私钥: /etc/ssl/certs/cert.key
```

#### 步骤 4：配置 WebSocket 服务器启用 TLS

修改服务器启动方式：

```bash
# 设置环境变量启用 WSS
export WSS_ENABLED=true
export WSS_CERT_PATH=/etc/ssl/certs/cert.pem
export WSS_KEY_PATH=/etc/ssl/certs/cert.key

# 启动服务器
cd webSocket/server
npm run build
npm start
```

#### 步骤 5：设置证书自动续期

```bash
# Let's Encrypt 证书有效期 90 天，设置自动续期
sudo certbot renew --dry-run  # 测试续期
sudo crontab -e

# 添加以下行（每周检查续期）
0 0 * * 0 certbot renew --quiet --post-hook "systemctl restart websocket-server"
```

### 方案二：使用 Nginx 反向代理（推荐生产环境）

#### 配置 Nginx 处理 SSL

```nginx
# /etc/nginx/conf.d/websocket.conf

upstream websocket_backend {
    server 127.0.0.1:8081;
}

server {
    listen 443 ssl http2;
    server_name www.studytech.cloud;

    # SSL 证书配置
    ssl_certificate /etc/ssl/certs/cert.pem;
    ssl_certificate_key /etc/ssl/certs/cert.key;
    
    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # WebSocket 代理
    location /ws {
        proxy_pass http://www.studytech.cloud;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket 超时设置
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name www.studytech.cloud;
    return 301 https://$server_name$request_uri;
}
```

#### 客户端连接地址修改

使用 Nginx 反向代理后，客户端连接地址改为：
```javascript
const SERVER_URL = 'wss://www.studytech.cloud/ws';
```

### 方案三：自签名证书（仅用于测试）

#### 生成自签名证书

```bash
# 生成私钥和证书（有效期 365 天）
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# 或使用更简单的命令
openssl req -newkey rsa:2048 -new -nodes -x509 -days 365 -keyout key.pem -out cert.pem
```

#### 配置服务器使用自签名证书

```bash
export WSS_ENABLED=true
export WSS_CERT_PATH=/path/to/cert.pem
export WSS_KEY_PATH=/path/to/key.pem
npm start
```

**注意**：自签名证书会导致浏览器显示安全警告，需要手动信任证书。

## 服务器配置验证

### 检查服务器是否启用 TLS

```bash
# 检查端口监听状态
netstat -tlnp | grep 8081

# 测试 SSL 连接
openssl s_client -connect www.studytech.cloud:8081 -showcerts
```

### 检查证书有效性

```bash
# 查看证书信息
openssl x509 -in /etc/ssl/certs/cert.pem -text -noout

# 检查证书过期时间
openssl x509 -in /etc/ssl/certs/cert.pem -noout -dates
```

## 客户端连接测试

### 浏览器控制台测试

```javascript
// 测试 WSS 连接
const ws = new WebSocket('wss://www.studytech.cloud:8081');
ws.onopen = () => console.log('WSS Connected!');
ws.onerror = (e) => console.error('WSS Error:', e);
```

### 使用 wscat 测试

```bash
# 安装 wscat
npm install -g wscat

# 测试连接
wscat -c wss://www.studytech.cloud:8081
```

## 常见问题排查

### 问题 1：连接失败，错误代码 1006

**原因**：SSL 证书无效或服务器未启用 TLS

**解决**：
- 确认服务器启用了 WSS_ENABLED=true
- 检查证书路径是否正确
- 验证证书文件是否存在且可读

### 问题 2：浏览器显示证书警告

**原因**：使用自签名证书或证书链不完整

**解决**：
- 使用 Let's Encrypt 等受信任的 CA 证书
- 确保使用 fullchain.pem（包含完整证书链）

### 问题 3：HTTPS 页面无法连接 ws://

**原因**：浏览器混合内容安全策略

**解决**：
- 必须使用 wss:// 协议
- 配置服务器启用 TLS

## 生产环境推荐配置

1. **使用 Nginx 反向代理**处理 SSL，WebSocket 服务器保持 ws://
2. **使用 Let's Encrypt DV SSL 证书**，免费且受浏览器信任
3. **配置证书自动续期**，避免证书过期
4. **启用 TLS 1.2/1.3**，禁用不安全的旧版本

## 服务器启动脚本示例

创建启动脚本 `start-wss.sh`：

```bash
#!/bin/bash

# WebSocket 服务器 WSS 启动脚本

export WSS_ENABLED=true
export WSS_CERT_PATH=/etc/ssl/certs/cert.pem
export WSS_KEY_PATH=/etc/ssl/certs/cert.key

cd /path/to/webSocket/server
npm run build
npm start
```

## systemd 服务配置

创建服务文件 `/etc/systemd/system/websocket-server.service`：

```ini
[Unit]
Description=WebSocket Server with WSS
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/webSocket/server
Environment="WSS_ENABLED=true"
Environment="WSS_CERT_PATH=/etc/ssl/certs/cert.pem"
Environment="WSS_KEY_PATH=/etc/ssl/certs/cert.key"
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启动服务：
```bash
sudo systemctl daemon-reload
sudo systemctl enable websocket-server
sudo systemctl start websocket-server
sudo systemctl status websocket-server
```