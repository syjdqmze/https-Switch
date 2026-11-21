#!/bin/bash
# VoiceClone 服务管理脚本
# 用法: ./server.sh start|stop|status|restart
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
PID_FILE="$DIR/server.pid"
LOG_FILE="$DIR/vc.log"

get_pid() {
  if [ -f "$PID_FILE" ]; then
    local p
    p=$(cat "$PID_FILE" 2>/dev/null)
    if [ -n "$p" ] && kill -0 "$p" 2>/dev/null; then
      echo "$p"
      return 0
    fi
  fi
  return 1
}

# 清理同目录下残留的 server.js 进程（按进程工作目录精确匹配）
cleanup_stale() {
  local p cwd
  for p in $(pgrep -f "node server.js" 2>/dev/null); do
    cwd=$(readlink "/proc/$p/cwd" 2>/dev/null)
    if [ "$cwd" = "$DIR" ]; then
      kill "$p" 2>/dev/null
    fi
  done
}

start() {
  if p=$(get_pid); then
    echo "已在运行 (PID $p)"
    return 0
  fi
  cleanup_stale
  nohup node server.js > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  sleep 1
  if get_pid > /dev/null; then
    echo "启动成功 (PID $(cat "$PID_FILE"))，日志: $LOG_FILE"
    echo "访问: http://<服务器IP>:8930"
  else
    echo "启动失败，最近日志："
    tail -n 20 "$LOG_FILE" 2>/dev/null
    return 1
  fi
}

stop() {
  if p=$(get_pid); then
    kill "$p" && rm -f "$PID_FILE"
    echo "已停止 (PID $p)"
  else
    cleanup_stale
    echo "未发现运行中的服务（已尝试清理残留进程）"
  fi
}

status() {
  if p=$(get_pid); then
    echo "运行中 (PID $p)"
  else
    echo "未运行"
  fi
}

case "$1" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  restart) stop; sleep 1; start ;;
  *) echo "用法: $0 {start|stop|status|restart}" ;;
esac
