#!/bin/bash
set -e

echo "=========================================="
echo "  阿里云服务器部署脚本 (CentOS/RHEL版)"
echo "=========================================="

APP_DIR="/usr/share/nginx/html/Student_Management"
DB_DIR="/usr/share/nginx/database"
DOMAIN="studytech.cloud"

echo ""
echo "1. 检测操作系统..."
if command -v dnf &> /dev/null; then
    PKG_MANAGER="dnf"
    echo "   ✓ 检测到 Fedora/CentOS 8+，使用 dnf"
elif command -v yum &> /dev/null; then
    PKG_MANAGER="yum"
    echo "   ✓ 检测到 CentOS/RHEL 7，使用 yum"
else
    echo "   ✗ 无法检测到包管理器 (dnf/yum)"
    exit 1
fi

echo ""
echo "2. 获取 nginx 用户..."
NGINX_USER=$(grep '^user' /etc/nginx/nginx.conf | awk '{print $2}' | sed 's/;//')
if [ -z "$NGINX_USER" ]; then
    NGINX_USER="nginx"
fi
echo "   ✓ nginx 用户: ${NGINX_USER}"

echo ""
echo "3. 创建数据库目录并设置权限..."
sudo mkdir -p $DB_DIR
sudo chown -R ${NGINX_USER}:${NGINX_USER} $DB_DIR
sudo chmod -R 755 $DB_DIR
echo "   ✓ 数据库目录创建完成: $DB_DIR"

echo ""
echo "4. 安装 PHP 和 SQLite3 扩展..."
sudo ${PKG_MANAGER} install -y php-fpm php-pdo php-sqlite3
echo "   ✓ PHP 和 SQLite3 安装完成"

echo ""
echo "5. 检测 PHP-FPM 服务和 Socket..."
PHP_FPM_SERVICE=$(systemctl list-units | grep -o 'php-fpm[^ ]*' | head -1)
if [ -z "$PHP_FPM_SERVICE" ]; then
    PHP_FPM_SERVICE="php-fpm"
fi

PHP_FPM_SOCKET=$(find /run -name '*.sock' 2>/dev/null | grep -i php | head -1)
if [ -z "$PHP_FPM_SOCKET" ]; then
    PHP_FPM_SOCKET="/run/php-fpm/www.sock"
fi

echo "   ✓ PHP-FPM 服务: ${PHP_FPM_SERVICE}"
echo "   ✓ PHP-FPM Socket: ${PHP_FPM_SOCKET}"

echo ""
echo "6. 配置 nginx 支持 PHP..."
sudo mkdir -p /etc/nginx/conf.d
sudo rm -f /etc/nginx/conf.d/default.conf

sudo cat > /etc/nginx/conf.d/student_management.conf << EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN} _;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name ${DOMAIN} www.${DOMAIN} _;

    ssl_certificate /etc/nginx/ssl/${DOMAIN}.crt;
    ssl_certificate_key /etc/nginx/ssl/${DOMAIN}.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    root /usr/share/nginx/html;
    index index.html index.php;

    location /Student_Management/ {
        location ~ \\.php\$ {
            fastcgi_pass unix:${PHP_FPM_SOCKET};
            fastcgi_index index.php;
            fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
            fastcgi_param QUERY_STRING \$query_string;
            fastcgi_param REQUEST_METHOD \$request_method;
            fastcgi_param CONTENT_TYPE \$content_type;
            fastcgi_param CONTENT_LENGTH \$content_length;
            fastcgi_param SCRIPT_NAME \$fastcgi_script_name;
            fastcgi_param REQUEST_URI \$request_uri;
            fastcgi_param DOCUMENT_URI \$document_uri;
            fastcgi_param DOCUMENT_ROOT \$document_root;
            fastcgi_param SERVER_PROTOCOL \$server_protocol;
            fastcgi_param GATEWAY_INTERFACE CGI/1.1;
            fastcgi_param SERVER_SOFTWARE nginx/\$nginx_version;
            fastcgi_param REMOTE_ADDR \$remote_addr;
            fastcgi_param REMOTE_PORT \$remote_port;
            fastcgi_param SERVER_ADDR \$server_addr;
            fastcgi_param SERVER_PORT \$server_port;
            fastcgi_param SERVER_NAME \$server_name;
            fastcgi_param REDIRECT_STATUS 200;
        }
        try_files \$uri \$uri/ =404;
    }

    location ~ \\.php\$ {
        fastcgi_pass unix:${PHP_FPM_SOCKET};
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        fastcgi_param QUERY_STRING \$query_string;
        fastcgi_param REQUEST_METHOD \$request_method;
        fastcgi_param CONTENT_TYPE \$content_type;
        fastcgi_param CONTENT_LENGTH \$content_length;
        fastcgi_param SCRIPT_NAME \$fastcgi_script_name;
        fastcgi_param REQUEST_URI \$request_uri;
        fastcgi_param DOCUMENT_URI \$document_uri;
        fastcgi_param DOCUMENT_ROOT \$document_root;
        fastcgi_param SERVER_PROTOCOL \$server_protocol;
        fastcgi_param GATEWAY_INTERFACE CGI/1.1;
        fastcgi_param SERVER_SOFTWARE nginx/\$nginx_version;
        fastcgi_param REMOTE_ADDR \$remote_addr;
        fastcgi_param REMOTE_PORT \$remote_port;
        fastcgi_param SERVER_ADDR \$server_addr;
        fastcgi_param SERVER_PORT \$server_port;
        fastcgi_param SERVER_NAME \$server_name;
        fastcgi_param REDIRECT_STATUS 200;
    }

    location / {
        try_files \$uri \$uri/ =404;
    }
}
EOF

echo "   ✓ nginx 配置完成"

echo ""
echo "7. 创建 SSL 证书..."
sudo mkdir -p /etc/nginx/ssl

if [ -f "/etc/nginx/ssl/${DOMAIN}.crt" ] && [ -f "/etc/nginx/ssl/${DOMAIN}.key" ]; then
    echo "   ✓ SSL 证书已存在"
else
    echo "   ✗ SSL 证书不存在，使用自签名证书..."
    sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "/etc/nginx/ssl/${DOMAIN}.key" \
        -out "/etc/nginx/ssl/${DOMAIN}.crt" \
        -subj "/CN=${DOMAIN}"
    echo "   ✓ 自签名 SSL 证书创建完成"
fi

echo ""
echo "8. 验证并重启服务..."
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable ${PHP_FPM_SERVICE}
sudo systemctl restart ${PHP_FPM_SERVICE}
echo "   ✓ nginx 和 ${PHP_FPM_SERVICE} 已重启"

echo ""
echo "9. 验证 PHP 安装..."
php -m | grep sqlite3 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ SQLite3 扩展已启用"
else
    echo "   ✗ SQLite3 扩展未启用"
    sudo ${PKG_MANAGER} install -y php-sqlite3
    sudo systemctl restart ${PHP_FPM_SERVICE}
    echo "   ✓ SQLite3 扩展安装完成"
fi

echo ""
echo "=========================================="
echo "  部署完成!"
echo "=========================================="
echo ""
echo "访问地址:"
echo "  学生管理系统: https://${DOMAIN}/Student_Management/index.html"
echo "  数据库管理: https://${DOMAIN}/Student_Management/database_management.html"
echo ""
echo "数据库文件存储位置: $DB_DIR"
echo ""
echo "验证命令:"
echo "  检查 PHP-FPM: sudo systemctl status ${PHP_FPM_SERVICE}"
echo "  检查 API: curl https://${DOMAIN}/Student_Management/api.php?action=health"
echo ""
echo "注意:"
echo "  当前使用自签名证书，浏览器会提示安全警告。"
echo "  如需正式证书，请使用 Let's Encrypt:"
echo "    sudo ${PKG_MANAGER} install -y certbot python3-certbot-nginx"
echo "    sudo certbot --nginx -d ${DOMAIN}"
echo ""