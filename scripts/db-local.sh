#!/usr/bin/env bash
# 本地开发用的便携 MySQL 管理脚本（免安装，仅用于本机开发调试）
# 用法: scripts/db-local.sh {start|stop|status|restart}
set -euo pipefail

# 项目根目录（脚本位于 <root>/scripts 下）
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_DIR="$ROOT_DIR/.localdb"
BASE_DIR="$DB_DIR/mysql"
DATA_DIR="$DB_DIR/data"
SOCK="$DB_DIR/mysql.sock"
PID_FILE="$DB_DIR/mysql.pid"
LOG_FILE="$DB_DIR/mysql.log"
MYSQLD="$BASE_DIR/bin/mysqld"
MYSQL="$BASE_DIR/bin/mysql"
PORT=3306

is_running() {
  lsof -i :"$PORT" 2>/dev/null | grep -q LISTEN
}

start() {
  if [ ! -x "$MYSQLD" ]; then
    echo "错误: 未找到便携 MySQL ($MYSQLD)。" >&2
    echo "请先按 README 说明下载 MySQL 便携包到 .localdb/mysql。" >&2
    exit 1
  fi
  if is_running; then
    echo "MySQL 已在运行 (127.0.0.1:$PORT)。"
    return 0
  fi
  echo "启动本地 MySQL..."
  nohup "$MYSQLD" --no-defaults \
    --basedir="$BASE_DIR" \
    --datadir="$DATA_DIR" \
    --socket="$SOCK" \
    --port="$PORT" \
    --bind-address=127.0.0.1 \
    --mysqlx=OFF \
    --pid-file="$PID_FILE" \
    > "$LOG_FILE" 2>&1 &
  # 等待就绪（最多 ~20s）
  for i in $(seq 1 20); do
    if is_running; then
      echo "MySQL 已启动 (127.0.0.1:$PORT)。"
      return 0
    fi
    sleep 1
  done
  echo "MySQL 启动超时，请查看日志: $LOG_FILE" >&2
  tail -8 "$LOG_FILE" >&2 || true
  exit 1
}

stop() {
  if ! is_running; then
    echo "MySQL 未在运行。"
    return 0
  fi
  echo "停止本地 MySQL..."
  if [ -f "$PID_FILE" ]; then
    kill "$(cat "$PID_FILE")" 2>/dev/null || true
  fi
  for i in $(seq 1 15); do
    if ! is_running; then
      echo "MySQL 已停止。"
      return 0
    fi
    sleep 1
  done
  echo "优雅停止超时，强制结束。" >&2
  pkill -f "$MYSQLD" 2>/dev/null || true
}

status() {
  if is_running; then
    echo "运行中: MySQL 127.0.0.1:$PORT"
  else
    echo "已停止: MySQL 未监听 $PORT"
  fi
}

case "${1:-}" in
  start)   start ;;
  stop)    stop ;;
  restart) stop; start ;;
  status)  status ;;
  *)
    echo "用法: $0 {start|stop|status|restart}" >&2
    exit 1
    ;;
esac
