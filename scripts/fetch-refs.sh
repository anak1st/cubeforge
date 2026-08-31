#!/usr/bin/env bash
# 浅克隆参考仓库到 refs/（--depth 1：只取最新快照，refs/ 已 gitignore 不入库）。
# 各仓库的用途与关键源码索引见 docs/refs/。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/refs"

clone() {
  local name=$1 url=$2
  if [ -d "$ROOT/refs/$name/.git" ]; then
    echo "==> $name 已存在，跳过"
  else
    echo "==> 浅克隆 $name …"
    git clone --depth 1 --single-branch "$url" "$ROOT/refs/$name"
  fi
  echo "    $name HEAD: $(git -C "$ROOT/refs/$name" rev-parse --short HEAD)"
}

clone luanti       https://github.com/luanti-org/luanti.git
clone minetest_game https://github.com/luanti-org/minetest_game.git
clone voxelize     https://github.com/voxelize/voxelize.git
