#!/bin/bash

# WebSocket 服务器诊断脚本
# 用于检查 WSS 连接问题

echo "========================================"
echo "WebSocket 服务器诊断工具"
echo "========================================"
echo ""

# 1. 检查证书文件
echo "1. 检查 SSL 证书文件..."
CERT_PATH="${WSS_CERT_PATH:-/etc/ssl/certs/cert.pem}"
KEY_PATH="${WSS_KEY_PATH:-/etc/ssl/certs/cert.key}"

if [ -f "$CERT_PATH" ]; then
    echo "✅ 证书文件存在: $CERT_PATH"
    ls -lh "$CERT_PATH"
else
    echo "❌ 证书文件不存在: $CERT_PATH"
    echo "   请确保证书文件已正确放置"
fi

if [ -f "$KEY_PATH" ]; then
    echo "✅ 私钥文件存在: $KEY_PATH"
    ls -lh "$KEY_PATH"
else
    echo "❌ 私钥文件不存在: $KEY_PATH"
    echo "   请确保私钥文件已正确放置"
fi

echo ""

# 2. 检查证书有效性
echo "2. 检查证书有效性..."
if [ -f "$CERT_PATH" ]; then
    openssl x509 -in "$CERT_PATH" -noout -subject -issuer -dates 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✅ 证书格式正确"
    else
        echo "❌ 证书格式错误或已损坏"
    fi
else
    echo "⚠️  跳过证书验证（文件不存在）"
fi

echo ""

# 3. 检查端口监听
echo "3. 检查端口监听状态..."
if netstat -tlnp 2>/dev/null | grep -q ":8081"; then
    echo "✅ 端口 8081 正在监听"
    netstat -tlnp 2>/dev/null | grep ":8081"
else
    echo "❌ 端口 8081 未监听"
    echo "   服务器可能未启动"
fi

echo ""

# 4. 检查进程
echo "4. 检查 Node.js 进程..."
if pgrep -f "node.*dist/index.js" > /dev/null; then
    echo "✅ 找到 WebSocket 服务器进程"
    ps aux | grep -E "node.*dist/index.js" | grep -v grep
else
    echo "❌ 未找到 WebSocket 服务器进程"
    echo "   请检查服务器是否正在运行"
fi

echo ""

# 5. 检查环境变量
echo "5. 检查环境变量..."
if [ "$WSS_ENABLED" = "true" ]; then
    echo "✅ WSS_ENABLED=true (WSS 已启用)"
else
    echo "❌ WSS_ENABLED 未设置或为 false"
    echo "   当前值: ${WSS_ENABLED:-未设置}"
    echo "   请设置: export WSS_ENABLED=true"
fi

echo ""

# 6. 测试连接
echo "6. 测试连接..."
if command -v openssl >/dev/null 2>&1; then
    echo "测试 WSS 连接..."
    timeout 5 openssl s_client -connect www.studytech.cloud:8081 </dev/null 2>&1 | head -20
    if [ $? -eq 0 ]; then
        echo "✅ WSS 连接测试成功"
    else
        echo "❌ WSS 连接测试失败"
        echo "   可能原因："
        echo "   - 服务器未启用 TLS"
        echo "   - 证书配置错误"
        echo "   - 防火墙阻止连接"
    fi
else
    echo "⚠️  openssl 未安装，跳过连接测试"
fi

echo ""
echo "========================================"
echo "诊断完成"
echo "========================================"
echo ""
echo "常见问题解决方案："
echo ""
echo "问题 1: 证书文件不存在"
echo "  解决: 将证书文件放置到 /etc/ssl/certs/"
echo "  - cert.pem (证书文件)"
echo "  - cert.key (私钥文件)"
echo ""
echo "问题 2: WSS_ENABLED 未设置"
echo "  解决: export WSS_ENABLED=true"
echo "         export WSS_CERT_PATH=/etc/ssl/certs/cert.pem"
echo "         export WSS_KEY_PATH=/etc/ssl/certs/cert.key"
echo "         npm run build && npm start"
echo ""
echo "问题 3: 端口未监听"
echo "  解决: 启动服务器"
echo "         cd /path/to/webSocket/server"
echo "         ./start-wss.sh"
echo ""
echo "问题 4: 防火墙阻止"
echo "  解决: 开放 8081 端口"
echo "         sudo ufw allow 8081"
echo "         或在阿里云控制台配置安全组"
echo ""