# 阿里云部署指南

## 快速部署（推荐）

### 方式一：自动化脚本部署

#### 步骤 1：在本地打包文件

```bash
# 在 Windows 上使用 Git Bash 或 WSL
cd file-system-manager
chmod +x deploy-local.sh
./deploy-local.sh
```

#### 步骤 2：上传到阿里云

```bash
scp file-manager-deploy.tar.gz root@www.studytech.cloud:/tmp/
```

#### 步骤 3：在服务器上解压并部署

```bash
# SSH 连接到服务器
ssh root@www.studytech.cloud

# 解压文件
cd /tmp
tar -xzvf file-manager-deploy.tar.gz
mkdir -p /www/wwwroot/file-system-manager
mv * /www/wwwroot/file-system-manager/

# 进入目录
cd /www/wwwroot/file-system-manager

# 一键部署
chmod +x deploy-server.sh
./deploy-server.sh
```

### 方式二：手动部署

#### 步骤 1：在本地准备文件

确保以下文件存在：
- ✅ `server.js`
- ✅ `index.html`
- ✅ `package.json`
- ✅ `config.json`

#### 步骤 2：上传文件到服务器

使用以下命令上传（使用 WinSCP 或 FileZilla 更方便）：
```bash
# 创建目录
ssh root@www.studytech.cloud "mkdir -p /www/wwwroot/file-system-manager"

# 上传文件
scp server.js root@www.studytech.cloud:/www/wwwroot/file-system-manager/
scp index.html root@www.studytech.cloud:/www/wwwroot/file-system-manager/
scp package.json root@www.studytech.cloud:/www/wwwroot/file-system-manager/
scp config.json root@www.studytech.cloud:/www/wwwroot/file-system-manager/
```

#### 步骤 3：在服务器上安装并启动

```bash
# SSH 连接到服务器
ssh root@www.studytech.cloud

# 进入项目目录
cd /www/wwwroot/file-system-manager

# 创建数据目录
mkdir -p data

# 安装依赖
npm install

# 安装 PM2（用于进程管理）
npm install -g pm2

# 启动服务器
pm2 start server.js --name file-manager

# 保存进程列表
pm2 save

# 设置开机自启
pm2 startup
```

#### 步骤 4：验证部署

```bash
# 测试登录
curl -X POST http://localhost:8080/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<your-password>"}'

# 应该返回：{"success":true,"token":"..."}
```

## 防火墙和安全组配置

### 阿里云安全组

1. 登录阿里云控制台
2. 进入轻量应用服务器
3. 点击"安全"选项卡
4. 添加规则：
   - 协议：TCP
   - 端口范围：8080/8080
   - 授权对象：0.0.0.0/0

### 服务器防火墙

```bash
# 检查防火墙状态
sudo ufw status

# 如果防火墙已启用，开放端口
sudo ufw allow 8080/tcp
sudo ufw reload
```

## Nginx 反向代理配置（可选）

如果您希望使用域名直接访问（不需要端口号），配置 Nginx：

```bash
# 安装 Nginx
apt-get update
apt-get install nginx

# 编辑配置
vi /etc/nginx/conf.d/file-manager.conf
```

添加以下内容：

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

    # API 反向代理
    location ~ ^/(login|logout|files|download)$ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 错误页面
    error_page 404 /index.html;
}
```

测试并重启 Nginx：

```bash
nginx -t
systemctl restart nginx
```

## 常用命令

### PM2 命令

```bash
pm2 start server.js --name file-manager    # 启动
pm2 stop file-manager                      # 停止
pm2 restart file-manager                   # 重启
pm2 delete file-manager                    # 删除
pm2 status                                 # 查看状态
pm2 logs file-manager                      # 查看日志
pm2 monit                                  # 监控
pm2 save                                   # 保存进程列表
pm2 startup                                # 设置开机自启
```

### 直接使用 Node

```bash
node server.js                              # 前台运行
nohup node server.js > server.log &        # 后台运行
ps aux | grep server.js                     # 查看进程
kill $(cat server.pid)                      # 停止服务
```

### 日志查看

```bash
# PM2 日志
pm2 logs file-manager

# Node 日志
tail -f server.log

# 系统日志
journalctl -u nginx -f
```

## 常见问题

### 1. npm install 失败

**问题**：npm 无法找到 package.json
**解决**：
```bash
# 确保在正确的目录
cd /www/wwwroot/file-system-manager
ls -la  # 检查文件是否存在

# 如果文件不存在，重新上传
```

### 2. 端口已被占用

**问题**：Error: listen EADDRINUSE :::8080
**解决**：
```bash
# 查找占用端口的进程
lsof -i :8080
# 或
netstat -tulpn | grep 8080

# 停止占用进程
kill -9 <PID>

# 或更换端口（修改 config.json）
```

### 3. 防火墙阻止访问

**问题**：无法从外部访问
**解决**：
```bash
# 检查防火墙规则
sudo iptables -L -n | grep 8080

# 开放端口
sudo iptables -A INPUT -p tcp --dport 8080 -j ACCEPT

# 或使用 ufw
sudo ufw allow 8080/tcp
```

### 4. 权限不足

**问题**：Permission denied
**解决**：
```bash
# 修改文件权限
chmod -R 755 /www/wwwroot/file-system-manager
chmod 644 /www/wwwroot/file-system-manager/*.json

# 修改数据目录权限
chown -R www-data:www-data /www/wwwroot/file-system-manager/data
```

## 部署检查清单

- [ ] 项目文件已上传到服务器
- [ ] 数据目录已创建
- [ ] Node.js 已安装
- [ ] PM2 已安装（推荐）
- [ ] 服务器已启动
- [ ] 端口 8080 已开放
- [ ] 安全组已配置
- [ ] 登录测试成功

## 默认配置

| 配置项 | 值 |
|--------|-----|
| 端口 | 8080 |
| 用户名 | admin |
| 密码 | &lt;your-password&gt; |
| 数据目录 | ./data |
| 部署路径 | /www/wwwroot/file-system-manager |

## 访问地址

- 本地访问：http://localhost:8080
- 外部访问：http://服务器公网IP:8080
- 域名访问：http://www.studytech.cloud（需要配置 Nginx）
