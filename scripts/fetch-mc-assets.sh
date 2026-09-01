#!/usr/bin/env bash
# 下载指定版本 MC 客户端 jar, 全量解压到 temp/minecraft-assets/, 再按清单挑选到 public/.
# jar 与 fetch-mc-src.sh 共用 (SHA1 校验, 坏件自动重下). temp/ 与 public/textures/ 不入库.
set -euo pipefail

MC="26.2"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JAR="$ROOT/temp/minecraft-client-$MC.jar"
TEMP="$ROOT/temp/minecraft-assets"
DEST="$ROOT/public"
mkdir -p "$ROOT/temp"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 挑选清单: temp/minecraft-assets 内的相对路径, 落到 public/ 时原样保留. 需要新资源时在下面加行.
PICKS=(
  "textures/block/grass_block_top.png"
  "textures/block/grass_block_side.png"
  "textures/block/grass_block_side_overlay.png"
  "textures/block/dirt.png"
  "textures/colormap/grass.png"
)

sha1() { node -e 'const c=require("crypto"),f=require("fs");process.stdout.write(c.createHash("sha1").update(f.readFileSync(process.argv[1])).digest("hex"))' "$1"; }

echo "==> 查询 $MC 下载信息"
INFO=$(MC="$MC" node --input-type=module -e '
const id=process.env.MC;
const m=await (await fetch("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json")).json();
const v=m.versions.find(v=>v.id===id);
const d=(await (await fetch(v.url)).json()).downloads.client;
console.log(d.url, d.sha1);
')
read -r URL SHA <<< "$INFO"

# jar 缓存: 坏件 (SHA1 不符) 自动重下
if [ -f "$JAR" ] && [ "$(sha1 "$JAR")" != "$SHA" ]; then rm -f "$JAR"; fi
if [ ! -f "$JAR" ]; then
  echo "==> 下载 client.jar (约 40MB)"
  curl -fsSL -o "$JAR" "$URL"
  [ "$(sha1 "$JAR")" = "$SHA" ] || { rm -f "$JAR"; echo "!! 下载不完整, 重跑本脚本"; exit 1; }
fi

if [ "$(cat "$TEMP/.extracted" 2>/dev/null)" = "$MC" ]; then
  echo "==> 已解压过, 跳过"
else
  echo "==> 解压资源"
  rm -rf "$TEMP"; mkdir -p "$TEMP"
  unzip -oq "$JAR" 'assets/minecraft/*' -d "$TMP/x"
  cp -R "$TMP/x/assets/minecraft/." "$TEMP/"
  echo "$MC" > "$TEMP/.extracted"
fi

echo "==> 挑选 ${#PICKS[@]} 个文件到 public/"
for p in "${PICKS[@]}"; do
  mkdir -p "$DEST/$(dirname "$p")"
  cp "$TEMP/$p" "$DEST/$p"
done
echo "==> 完成"
