#!/usr/bin/env bash
# 下载 MC 官方 client.jar（版本固定 MC_VERSION），全量资源解压到 temp/minecraft-assets/（浏览用工作区），
# 再把当前需要的资源按原相对路径挑选到 public/（挑选清单见 PICKS）。
# temp/minecraft-assets/<路径> 与 public/<路径> 一一对应，复制时不改相对路径。
# 只解压一个版本：jar 共享缓存在 temp/minecraft-client-<版本>.jar（SHA1 校验，坏件自动重下），fetch-mc-src.sh 反编译复用同一份。
# Mojang 版权资产仅限本机自用：temp/ 与 public/textures/ 均不入库（docs/credits.md）。
# 用法：bash scripts/fetch-mc-assets.sh
set -euo pipefail

MC_VERSION="26.2"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEMP="$ROOT/temp/minecraft-assets"
JAR="$ROOT/temp/minecraft-client-$MC_VERSION.jar"
DEST="$ROOT/public"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 挑选清单：temp/minecraft-assets 内的相对路径，落到 DEST 时原样保留。需要新资源时在下面加行。
PICKS=(
  "textures/block/grass_block_top.png"
  "textures/block/grass_block_side.png"
  "textures/block/grass_block_side_overlay.png"
  "textures/block/dirt.png"
  "textures/colormap/grass.png"
)

sha1_of() {
  node -e 'const c=require("crypto"),f=require("fs");console.log(c.createHash("sha1").update(f.readFileSync(process.argv[1])).digest("hex"))' "$1"
}

echo "==> 查询 Mojang 版本清单（$MC_VERSION）…"
INFO=$(MC_VERSION="$MC_VERSION" node --input-type=module -e '
const id = process.env.MC_VERSION;
const manifest = await (await fetch("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json")).json();
const v = manifest.versions.find(v => v.id === id);
if (!v) { console.error(`版本清单里找不到 ${id}`); process.exit(1); }
const meta = await (await fetch(v.url)).json();
console.log(meta.downloads.client.url, meta.downloads.client.sha1);
')
[ -n "$INFO" ] || { echo "!! 未取得 $MC_VERSION 的下载信息"; exit 1; }
JAR_URL="${INFO% *}"
SHA1="${INFO##* }"

# 共享 jar 缓存：存在但 SHA1 不符（下载不完整）时重下
if [ -f "$JAR" ] && [ "$(sha1_of "$JAR")" != "$SHA1" ]; then
  echo "==> 已有 jar 的 SHA1 不符（下载不完整），重新下载…"
  rm -f "$JAR"
fi
if [ ! -f "$JAR" ]; then
  echo "==> 下载 client.jar $MC_VERSION（约 40MB）…"
  curl -sS --fail -o "$JAR" "$JAR_URL"
  [ "$(sha1_of "$JAR")" = "$SHA1" ] || { rm -f "$JAR"; echo "!! jar SHA1 校验失败（下载不完整），重跑本脚本"; exit 1; }
fi

if [ "$(cat "$TEMP/.extracted" 2>/dev/null)" = "$MC_VERSION" ]; then
  echo "==> temp/minecraft-assets/ 已有 $MC_VERSION 全量解压结果，跳过解压"
else
  echo "==> 全量解压到 temp/minecraft-assets/…"
  rm -rf "$TEMP"
  mkdir -p "$TEMP"
  unzip -oq "$JAR" 'assets/minecraft/*' -d "$TMP/x"
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
echo "    jar 共享缓存：$JAR（fetch-mc-src.sh 反编译复用）"
