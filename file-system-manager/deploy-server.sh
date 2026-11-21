#!/bin/bash
# 文件管理器 - 服务器端一键部署脚本

echo "========================================"
echo "  文件管理器 - 服务器端部署脚本"
echo "========================================"
echo ""

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "工作目录: $SCRIPT_DIR"
echo ""

# 检查 Node.js
echo "检查 Node.js..."
if ! command -v node &> /dev/null; then
    echo "错误: Node.js 未安装"
    echo "安装 Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

NODE_VERSION=$(node -v)
echo "✓ Node.js 版本: $NODE_VERSION"
echo ""

# 创建数据目录
echo "创建数据目录..."
if [ ! -d "data" ]; then
    mkdir -p data
    echo "✓ 数据目录已创建: $SCRIPT_DIR/data"
else
    echo "✓ 数据目录已存在"
fi
echo ""

# 安装依赖
echo "安装依赖..."
if [ -f "package.json" ]; then
    npm install --silent
    if [ $? -eq 0 ]; then
        echo "✓ 依赖安装成功"
    else
        echo "⚠ npm install 失败，尝试使用原生 Node.js（无需依赖）"
    fi
else
    echo "⚠ package.json 不存在，跳过 npm install"
fi
echo ""

# 安装 PM2
echo "安装 PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2 --silent
    if [ $? -eq 0 ]; then
        echo "✓ PM2 安装成功"
    else
        echo "⚠ PM2 安装失败，继续使用 node 命令"
    fi
else
    echo "✓ PM2 已安装"
fi
echo ""

# 停止之前的进程
echo "停止之前的进程..."
pm2 stop file-manager 2>/dev/null
pm2 delete file-manager 2>/dev/null
echo ""

# 启动服务器
echo "启动服务器..."
if command -v pm2 &> /dev/null; then
    pm2 start server.js --name file-manager
    pm2 save
    pm2 startup
    echo ""
    echo "========================================"
    echo "  服务状态"
    echo "========================================"
    pm2 status
    echo ""
else
    # 直接使用 node 启动（后台运行）
    nohup node server.js > server.log 2>&1 &
    sleep 2
    echo "✓ 服务器已在后台启动（PID: $!）"
    echo "  日志文件: server.log"
fi

echo ""
echo "========================================"
echo "  部署完成！"
echo "========================================"
echo ""
echo "✓ 服务器地址: http://$(hostname -I | awk '{print $1}'):8080"
echo ""
echo "登录凭据："
echo "  用户名: admin"
echo "  密码: 见 config.json（请勿使用默认弱口令）"
echo ""
echo "========================================"
echo "  常用命令"
echo "========================================"
echo ""
if command -v pm2 &> /dev/null; then
    echo "  pm2 status              - 查看服务状态"
    echo "  pm2 logs file-manager   - 查看日志"
    echo "  pm2 restart file-manager - 重启服务"
    echo "  pm2 stop file-manager   - 停止服务"
else
    echo "  ps aux | grep server.js  - 查看进程"
    echo "  kill \$(cat server.pid)   - 停止服务"
    echo "  cat server.log           - 查看日志"
fi
echo ""
echo "========================================"
echo ""

# 检查防火墙
echo "检查防火墙配置..."
if command -v ufw &> /dev/null; then
    if sudo ufw status | grep -q "Status: active"; then
        echo "⚠ UFW 防火墙已启用，请确保 8080 端口已开放："
        echo "   sudo ufw allow 8080/tcp"
        echo "   sudo ufw reload"
    fi
fi
echo ""

# 检查端口
echo "检查端口 8080..."
if netstat -tuln 2>/dev/null | grep -q ":8080 "; then
    echo "✓ 端口 8080 已开放"
else
    echo "⚠ 端口 8080 未监听，请检查服务是否启动成功"
fi
echo ""

# 测试登录
echo "测试登录功能..."
sleep 1
LOGIN_USER=$(node -e "console.log(require('./config.json').username)")
LOGIN_PASS=$(node -e "console.log(require('./config.json').password)")
RESPONSE=$(curl -s -X POST http://localhost:8080/login \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$LOGIN_USER\",\"password\":\"$LOGIN_PASS\"}")

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✓ 登录测试成功！"
    echo "  响应: $RESPONSE"
else
    echo "⚠ 登录测试失败"
    echo "  响应: $RESPONSE"
fi
echo ""

echo "========================================"
echo "  访问地址"
echo "========================================"
echo ""
echo "本地访问: http://localhost:8080"
echo "外部访问: http://服务器IP:8080"
echo ""
echo "请确保："
echo "  1. 阿里云安全组已开放 8080 端口"
echo "  2. 服务器防火墙已开放 8080 端口"
echo ""
