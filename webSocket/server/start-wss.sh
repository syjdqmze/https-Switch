#!/bin/bash

# WebSocket 服务器 WSS 启动脚本
# 使用 DV SSL 证书启用安全 WebSocket 连接

echo "=== WebSocket 服务器 WSS 启动 ==="

# 默认证书路径
CERT_PATH="${WSS_CERT_PATH:-/etc/ssl/certs/cert.pem}"
KEY_PATH="${WSS_KEY_PATH:-/etc/ssl/certs/cert.key}"

if [ ! -f "$CERT_PATH" ]; then
    echo "错误: SSL 证书文件不存在: $CERT_PATH"
    echo "请先获取 SSL 证书并放置到:"
    echo "  /etc/ssl/certs/cert.pem"
    echo "  /etc/ssl/certs/cert.key"
    exit 1
fi

if [ ! -f "$KEY_PATH" ]; then
    echo "错误: SSL 私钥文件不存在: $KEY_PATH"
    echo "请先获取 SSL 证书并放置到:"
    echo "  /etc/ssl/certs/cert.pem"
    echo "  /etc/ssl/certs/cert.key"
    exit 1
fi

# 设置环境变量
export WSS_ENABLED=true
export WSS_CERT_PATH="$CERT_PATH"
export WSS_KEY_PATH="$KEY_PATH"

echo "SSL 证书路径: $CERT_PATH"
echo "SSL 私钥路径: $KEY_PATH"
echo "启用 WSS: $WSS_ENABLED"

# 检查证书有效期
echo "检查证书有效期..."
openssl x509 -in "$CERT_PATH" -noout -dates

# 编译 TypeScript
echo "编译 TypeScript..."
npm run build

# 启动服务器
echo "启动 WebSocket 服务器..."
echo "服务器将运行在: wss://www.studytech.cloud:8081"
npm start