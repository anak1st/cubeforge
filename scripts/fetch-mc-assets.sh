#!/usr/bin/env bash
# 下载 MC 官方 client.jar，全量资源解压到 temp/minecraft/（浏览用工作区），
# 再把当前需要的资源按原相对路径挑选到 public/texture/minecraft/（挑选清单见下方 PICKS）。
# temp/minecraft/<路径> 与 public/texture/minecraft/<路径> 一一对应，复制时不改相对路径。
# Mojang 版权资产仅限本机自用：temp/ 与 public/texture/ 均不入库（CREDITS.md）。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEMP="$ROOT/temp/minecraft"
DEST="$ROOT/public/texture/minecraft"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 挑选清单：temp/minecraft 内的相对路径，落到 DEST 时原样保留。需要新资源时在下面加行。
PICKS=(
  "textures/block/grass_block_top.png"
  "textures/block/grass_block_side.png"
  "textures/block/grass_block_side_overlay.png"
  "textures/block/dirt.png"
  "textures/colormap/grass.png"
)

echo "==> 查询 Mojang 官方版本清单…"
JAR_URL=$(node --input-type=module -e '
const m = await (await fetch("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json")).json();
const v = m.versions.find(v => v.id === m.latest.release);
const meta = await (await fetch(v.url)).json();
console.log(meta.downloads.client.url);
')

if [ ! -f "$TEMP/.extracted" ]; then
  echo "==> 下载 client.jar（约 40MB）…"
  curl -sS -o "$TMP/client.jar" "$JAR_URL"
  echo "==> 全量解压到 temp/minecraft/…"
  mkdir -p "$TEMP"
  unzip -oq "$TMP/client.jar" 'assets/minecraft/*' -d "$TMP/x"
  cp -R "$TMP/x/assets/minecraft/." "$TEMP/"
  touch "$TEMP/.extracted"
else
  echo "==> temp/minecraft/ 已有全量解压结果，跳过下载"
fi

echo "==> 挑选 ${#PICKS[@]} 个文件到 $DEST/…"
for p in "${PICKS[@]}"; do
  mkdir -p "$DEST/$(dirname "$p")"
  cp "$TEMP/$p" "$DEST/$p"
done

echo "==> 完成：$DEST/ 现有 $(find "$DEST" -type f | wc -l | tr -d ' ') 个文件"
echo "    全量工作区（可随时浏览挑选）：$TEMP/"
