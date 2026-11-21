#!/bin/bash
# 文件管理器 - 阿里云部署脚本（本地执行）

echo "========================================"
echo "  文件管理器 - 阿里云部署脚本"
echo "========================================"
echo ""

# 检查本地文件
echo "检查本地文件..."
if [ ! -f "server.js" ]; then
    echo "错误: server.js 文件不存在"
    exit 1
fi

if [ ! -f "package.json" ]; then
    echo "错误: package.json 文件不存在"
    exit 1
fi

if [ ! -f "index.html" ]; then
    echo "错误: index.html 文件不存在"
    exit 1
fi

echo "✓ 所有必要文件存在"
echo ""

# 创建部署包
echo "创建部署包..."
tar -czvf file-manager-deploy.tar.gz \
    server.js \
    index.html \
    package.json \
    config.json \
    --exclude='*.log' \
    --exclude='node_modules' \
    --exclude='.git'

if [ $? -eq 0 ]; then
    echo "✓ 部署包已创建: file-manager-deploy.tar.gz"
else
    echo "✗ 部署包创建失败"
    exit 1
fi

echo ""
echo "========================================"
echo "  下一步操作"
echo "========================================"
echo ""
echo "1. 上传部署包到阿里云服务器："
echo "   scp file-manager-deploy.tar.gz root@www.studytech.cloud:/tmp/"
echo ""
echo "2. SSH 连接到服务器："
echo "   ssh root@www.studytech.cloud"
echo ""
echo "3. 在服务器上解压并部署："
echo "   cd /tmp"
echo "   tar -xzvf file-manager-deploy.tar.gz"
echo "   mkdir -p /www/wwwroot/file-system-manager"
echo "   mv * /www/wwwroot/file-system-manager/"
echo "   cd /www/wwwroot/file-system-manager"
echo ""
echo "4. 创建数据目录："
echo "   mkdir -p /www/wwwroot/file-system-manager/data"
echo ""
echo "5. 安装并启动服务："
echo "   npm install"
echo "   npm install -g pm2"
echo "   pm2 start server.js --name file-manager"
echo "   pm2 save"
echo "   pm2 startup"
echo ""
echo "6. 配置 Nginx（可选，用于域名访问）："
echo "   请参考 DEPLOY.md 文件中的 Nginx 配置"
echo ""
echo "========================================"
echo ""
echo "或者，使用 start.sh 脚本一键部署："
echo "   将所有文件上传到服务器后，运行："
echo "   chmod +x start.sh && ./start.sh"
echo ""
