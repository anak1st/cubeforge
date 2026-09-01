#!/usr/bin/env bash
# 浅克隆参考仓库到 refs/ (--depth 1 --single-branch: 只取最新快照, refs/ 已 gitignore 不入库).
# 各仓库的用途与关键源码索引见 docs/refs/. 克隆失败只提示, 不中断, 重跑本脚本即可续传.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/refs"

clone() {
  local name=$1 url=$2 dest="$ROOT/refs/$1"
  if [ -d "$dest/.git" ]; then
    echo "==> $name 已存在, 跳过"
  elif git clone --depth 1 --single-branch "$url" "$dest"; then
    echo "    $name HEAD: $(git -C "$dest" rev-parse --short HEAD)"
  else
    echo "!!  克隆 $name 失败, 已跳过 (可稍后重跑本脚本)"
  fi
}

clone luanti        https://github.com/luanti-org/luanti.git
clone minetest_game https://github.com/luanti-org/minetest_game.git
clone voxelize      https://github.com/voxelize/voxelize.git
