#!/usr/bin/env bash
# ============================================================
# 一键部署脚本：沪深股市实时行情与分析页面
# 用法: sudo ./deploy.sh [站点根目录]
#   - 无参数时自动探测站点根目录（宝塔 / Nginx / Apache）
#   - 页面将部署为现有站点下的子目录: <站点根>/stock/index.html
#   - 幂等可重复执行，重复部署自动备份旧版
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_FILE="$SCRIPT_DIR/index.html"
SUBDIR="stock"

[ -f "$SRC_FILE" ] || { echo "[错误] 未找到 $SRC_FILE，请将本脚本与 index.html 放在同一目录"; exit 1; }

if [ "$(id -u)" -ne 0 ]; then
  echo "[提示] 当前非 root 用户，若随后写入失败请使用: sudo ./deploy.sh"
fi

# ---------- 站点根目录自动探测 ----------
detect_root() {
  # 1) 宝塔面板
  if [ -d "/www/server/panel" ] && [ -d "/www/wwwroot" ]; then
    local cand
    cand=$(find /www/wwwroot -maxdepth 2 -name index.html 2>/dev/null | head -5 || true)
    if [ -n "$cand" ]; then
      echo "[信息] 检测到宝塔面板，候选站点目录：" >&2
      echo "$cand" | while read -r f; do echo "  - $(dirname "$f")" >&2; done
      dirname "$(echo "$cand" | head -1)"
      return 0
    fi
  fi
  # 2) Nginx（从生效配置中提取 root）
  if command -v nginx >/dev/null 2>&1; then
    local root
    root=$(nginx -T 2>/dev/null | grep -E '^[[:space:]]*root[[:space:]]+' | awk '{print $2}' | tr -d ';' | grep -v '^/usr/share' | head -1 || true)
    if [ -n "$root" ] && [ -d "$root" ]; then echo "$root"; return 0; fi
  fi
  # 3) Apache
  if command -v apachectl >/dev/null 2>&1 || command -v httpd >/dev/null 2>&1; then
    local d
    for d in /var/www/html /var/www; do
      [ -d "$d" ] && { echo "$d"; return 0; }
    done
  fi
  # 4) 兜底常见目录
  local d
  for d in /var/www/html /var/www /srv/www; do
    [ -d "$d" ] && { echo "$d"; return 0; }
  done
  return 1
}

DEST_ROOT="${1:-}"
if [ -z "$DEST_ROOT" ]; then
  DEST_ROOT=$(detect_root)
  if [ -z "$DEST_ROOT" ]; then
    echo "[错误] 无法自动探测站点根目录。请手动指定后重试:"
    echo "       sudo ./deploy.sh /你的站点根目录"
    exit 1
  fi
  echo "[信息] 自动探测站点根目录: $DEST_ROOT"
  echo "       （如探测有误，请改用: sudo ./deploy.sh /你的站点根目录）"
fi

[ -d "$DEST_ROOT" ] || { echo "[错误] 目录不存在: $DEST_ROOT"; exit 1; }

# ---------- 部署 ----------
DEST_DIR="$DEST_ROOT/$SUBDIR"
mkdir -p "$DEST_DIR" || { echo "[错误] 无权限创建 $DEST_DIR，请使用 sudo"; exit 1; }

TS=$(date +%Y%m%d-%H%M%S)
if [ -f "$DEST_DIR/index.html" ]; then
  cp -f "$DEST_DIR/index.html" "$DEST_DIR/index.html.bak-$TS"
  echo "[信息] 已备份旧版: $DEST_DIR/index.html.bak-$TS"
fi

cp -f "$SRC_FILE" "$DEST_DIR/index.html" || { echo "[错误] 文件拷贝失败"; exit 1; }
chmod 644 "$DEST_DIR/index.html"

# ---------- 输出访问地址 ----------
DOMAIN=""
if command -v nginx >/dev/null 2>&1; then
  DOMAIN=$(nginx -T 2>/dev/null | grep -E '^[[:space:]]*server_name[[:space:]]+' | awk '{print $2}' | tr -d ';' | grep -v '^_' | head -1 || true)
fi

echo "=========================================="
echo "[成功] 部署完成: $DEST_DIR/index.html"
if [ -n "$DOMAIN" ]; then
  echo "访问地址: http://$DOMAIN/$SUBDIR/"
  echo "         （站点已配置 HTTPS 证书时请使用 https://$DOMAIN/$SUBDIR/）"
else
  echo "访问地址: http://你的域名或IP/$SUBDIR/"
fi
echo "回滚方法: cp $DEST_DIR/index.html.bak-$TS $DEST_DIR/index.html"
echo "=========================================="
