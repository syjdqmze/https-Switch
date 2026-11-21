# SFTP 文件管理器

一个基于 Node.js 和 Express 的网页应用，用于在阿里云轻量应用服务器与本地电脑之间通过 SFTP 协议传输文件。

## 功能特性

- 🔌 SFTP 连接服务器
- 📁 浏览服务器端根目录下所有文件夹和文件
- 💻 选择本地文件进行上传
- ⬇️ 从服务器下载文件到本地
- ⬆️ 上传本地文件到服务器
- 🎨 美观的界面设计

## 部署步骤

### 1. 在阿里云轻量应用服务器上安装 Node.js

```bash
# 安装 Node.js (使用 nvm 或官方包)
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

### 2. 上传项目文件到服务器

将以下文件上传到服务器的某个目录（例如 `/home/sftp-file-manager`）：

- `package.json`
- `server.js`
- `public/` 目录（包含 `index.html`）

### 3. 安装依赖

```bash
cd /home/sftp-file-manager
npm install
```

### 4. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 上运行。

### 5. 配置防火墙和反向代理（可选但推荐）

使用 Nginx 作为反向代理，并配置 SSL：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 6. 使用 PM2 保持服务运行（推荐）

```bash
npm install -g pm2
pm2 start server.js --name sftp-file-manager
pm2 save
pm2 startup
```

## 使用方法

1. 在电脑浏览器中访问部署的网页
2. 填写 SFTP 连接信息：
   - 服务器地址（例如：127.0.0.1 或公网 IP）
   - 端口（默认：22）
   - 用户名
   - 密码
3. 点击"连接"按钮
4. 连接成功后，左侧会显示服务器文件列表
5. 点击服务器文件可以下载
6. 点击"选择文件"选择本地文件，然后点击"上传到服务器"

## 安全建议

⚠️ **重要提示**：
- 此应用在生产环境中使用时，建议添加身份验证
- 考虑使用 HTTPS 加密传输
- 限制访问 IP 地址
- 定期更新依赖包

## 项目结构

```
sftp-file-manager/
├── package.json          # 项目依赖配置
├── server.js             # 后端服务
├── public/
│   └── index.html        # 前端页面
└── uploads/              # 临时上传目录（自动创建）
```

## 技术栈

- **后端**: Node.js, Express
- **SFTP**: ssh2-sftp-client
- **前端**: 原生 HTML, CSS, JavaScript
- **文件上传**: Multer
