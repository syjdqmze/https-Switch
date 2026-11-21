# 部署到阿里云服务器指南

## 快速部署步骤

### 1. 上传项目到服务器
使用FTP/SFTP工具将 `sftp-file-manager` 整个文件夹上传到服务器，例如：
```
/var/www/sftp-file-manager/
```

### 2. SSH连接到服务器
```bash
ssh root@www.studytech.cloud
```

### 3. 进入项目目录
```bash
cd /var/www/sftp-file-manager
```

### 4. 安装依赖
```bash
npm install
```

### 5. 启动服务
```bash
npm start
```

服务将在 http://www.studytech.cloud:3000 上运行

---

## 使用PM2保持服务运行（推荐）

### 安装PM2
```bash
npm install -g pm2
```

### 使用PM2启动服务
```bash
cd /var/www/sftp-file-manager
pm2 start server.js --name sftp-file-manager
```

### 设置开机自启
```bash
pm2 save
pm2 startup
```

### 查看服务状态
```bash
pm2 status
pm2 logs sftp-file-manager
```

---

## 阿里云安全组配置

在阿里云控制台 → 安全组 → 添加入站规则：
- 端口范围：3000/3000
- 协议：TCP
- 授权对象：0.0.0.0/0

---

## 访问页面

在浏览器中打开：
```
http://www.studytech.cloud:3000
```

页面会自动填充默认服务器地址：www.studytech.cloud

---

## 修改配置

如需修改默认服务器地址，编辑：
```
config.json
```