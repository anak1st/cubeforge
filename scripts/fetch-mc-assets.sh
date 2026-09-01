#!/usr/bin/env bash
# 下载 MC 官方 client.jar（版本固定 MC_VERSION），全量资源解压到 temp/minecraft/（浏览用工作区），
# 再把当前需要的资源按原相对路径挑选到 public/（挑选清单见 PICKS）。
# temp/minecraft/<路径> 与 public/<路径> 一一对应，复制时不改相对路径。
# Mojang 版权资产仅限本机自用：temp/ 与 public/textures/ 均不入库（docs/credits.md）。
set -euo pipefail

MC_VERSION="26.2"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEMP="$ROOT/temp/minecraft"
DEST="$ROOT/public"
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

echo "==> 查询 Mojang 版本清单（$MC_VERSION）…"
JAR_URL=$(MC_VERSION="$MC_VERSION" node --input-type=module -e '
const id = process.env.MC_VERSION;
const manifest = await (await fetch("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json")).json();
const v = manifest.versions.find(v => v.id === id);
if (!v) { console.error(`版本清单里找不到 ${id}`); process.exit(1); }
const meta = await (await fetch(v.url)).json();
console.log(meta.downloads.client.url);
')
[ -n "$JAR_URL" ] || { echo "!! 未取得 $MC_VERSION 的下载地址"; exit 1; }

if [ "$(cat "$TEMP/.extracted" 2>/dev/null)" = "$MC_VERSION" ]; then
  echo "==> temp/minecraft/ 已有 $MC_VERSION 全量解压结果，跳过下载"
else
  echo "==> 下载 client.jar $MC_VERSION（约 40MB）…"
  rm -rf "$TEMP"
  mkdir -p "$TEMP"
  curl -sS -o "$TMP/client.jar" "$JAR_URL"
  echo "==> 全量解压到 temp/minecraft/…"
  unzip -oq "$TMP/client.jar" 'assets/minecraft/*' -d "$TMP/x"
  cp -R "$TMP/x/assets/minecraft/." "$TEMP/"
  echo "$MC_VERSION" > "$TEMP/.extracted"
fi

echo "==> 挑选 ${#PICKS[@]} 个文件到 $DEST/…"
for p in "${PICKS[@]}"; do
  mkdir -p "$DEST/$(dirname "$p")"
  cp "$TEMP/$p" "$DEST/$p"
done

echo "==> 完成：挑选 ${#PICKS[@]} 个文件到 $DEST/"
echo "    全量工作区（可随时浏览挑选）：$TEMP/"
