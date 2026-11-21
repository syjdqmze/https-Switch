# 文件管理器部署指南

## 问题诊断

您遇到的 404 错误表示：`http://www.studytech.cloud/login` 返回 404，这意味着：
- ✅ 前端页面可以访问（HTML 正常加载）
- ❌ 后端服务器没有运行或没有正确配置

## 解决方案

### 方案一：直接启动 Node.js 服务器

1. **SSH 连接到阿里云服务器**
   ```bash
   ssh root@您的服务器IP
   cd /www/wwwroot/file-system-manager
   ```

2. **安装依赖**（如果还没有）
   ```bash
   npm install
   ```

3. **启动服务器**
   ```bash
   # 使用 PM2（推荐）
   pm2 start server.js --name file-manager
   
   # 或者直接运行
   node server.js
   ```

4. **验证服务器运行状态**
   ```bash
   pm2 status
   curl http://localhost:8080/login -X POST -H "Content-Type: application/json" -d '{"username":"admin","password":"<your-password>"}'
   ```

### 方案二：配置 Nginx 反向代理

如果您希望使用域名直接访问（不需要端口号），配置 Nginx：

```nginx
server {
    listen 80;
    server_name www.studytech.cloud;
    
    # 前端静态文件
    location / {
        root /www/wwwroot/file-system-manager;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    # API 反向代理到 Node.js
    location /api/ {
        proxy_pass http://127.0.0.1:8080/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 或者使用正则表达式匹配所有 API 路由
    location ~ ^/(login|logout|files|download)$ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

修改 Nginx 配置后重启：
```bash
nginx -t
nginx -s reload
```

### 方案三：使用端口 80

修改 `config.json`：
```json
{
    "port": 80,
    "rootDirectory": "./data",
    "username": "admin",
    "password": "<your-password>"
}
```

然后重启服务器：
```bash
pm2 restart file-manager
```

**注意**：使用端口 80 需要 root 权限，或者使用 `sudo`。

## 快速检查清单

1. ✅ 服务器正在运行：`pm2 status`
2. ✅ 端口可访问：`curl http://localhost:8080`
3. ✅ 登录端点工作：`curl -X POST http://localhost:8080/login -H "Content-Type: application/json" -d '{"username":"admin","password":"<your-password>"}'`
4. ✅ 防火墙开放端口：8080（阿里云安全组）

## 默认配置

- **端口**: 8080
- **用户名**: admin
- **密码**: `<your-password>`（在配置文件中设置，切勿使用弱口令）
- **管理目录**: ./data

## 常用 PM2 命令

```bash
# 启动
pm2 start server.js --name file-manager

# 查看状态
pm2 status

# 查看日志
pm2 logs file-manager

# 重启
pm2 restart file-manager

# 停止
pm2 stop file-manager

# 开机自启
pm2 save
pm2 startup
```

## 故障排除

### 404 Not Found 错误
- 后端服务器没有运行 → 启动服务器
- 端口配置错误 → 检查 config.json
- 防火墙阻止 → 开放端口

### 连接被拒绝
- 服务器未启动 → 使用 `pm2 start`
- 端口被占用 → 更换端口或停止占用进程

### 权限错误
- 使用 sudo 或配置 Nginx 反向代理
- 检查文件权限：`chmod -R 755 .`
