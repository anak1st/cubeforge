#!/usr/bin/env bash
# 反编译 MC 官方 client.jar（版本固定 MC_VERSION，与 fetch-mc-assets.sh 一致；须为无混淆版本）为可读 Java，
# 产物直接落 temp/minecraft-src/（只保留这一个版本；temp/ 已 gitignore 不入库）。
# jar 与 fetch-mc-assets.sh 共用 temp/minecraft-client-<版本>.jar（SHA1 校验，坏件自动重下）。
# 自 2025-10 官方公告起新版本 jar 带原始命名（含变量名）；反编译产物无注释，仅供本机学习——EULA 允许阅读、禁止再分发。
# 前置：PATH 里有 java（JDK 21+）。反编译全 jar 约数分钟、峰值内存 2-4GB。
# 用法：bash scripts/fetch-mc-src.sh（无参数；重做请先删 temp/minecraft-src/）
set -euo pipefail

# 反编译器锁版本（maven central: org.vineflower:vineflower）
VINEFLOWER_VERSION="1.12.0"
# MC 版本锁死，与 fetch-mc-assets.sh 的 MC_VERSION 一致；升级时两处一起改。
MC_VERSION="26.2"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/temp/minecraft-src"
JAR="$ROOT/temp/minecraft-client-$MC_VERSION.jar"
VF="$ROOT/temp/vineflower-$VINEFLOWER_VERSION.jar"
mkdir -p "$ROOT/temp"

command -v java >/dev/null || { echo "!! PATH 里找不到 java：需要 JDK 21+"; exit 1; }

sha1_of() {
  node -e 'const c=require("crypto"),f=require("fs");console.log(c.createHash("sha1").update(f.readFileSync(process.argv[1])).digest("hex"))' "$1"
}

if [ -f "$OUT/SOURCE.md" ]; then
  echo "==> temp/minecraft-src/ 已有反编译产物，跳过（重做请先删除该目录）"
  exit 0
fi

echo "==> 查询 Mojang 版本清单（$MC_VERSION）…"
INFO=$(MC_VERSION="$MC_VERSION" node --input-type=module -e '
const id = process.env.MC_VERSION;
const manifest = await (await fetch("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json")).json();
const v = manifest.versions.find(v => v.id === id);
if (!v) { console.error(`版本清单里找不到 ${id}`); process.exit(1); }
const meta = await (await fetch(v.url)).json();
if (meta.downloads.client_mappings) { console.error(`${id} 仍是混淆版本：请升级脚本里锁定的版本`); process.exit(1); }
console.log(meta.downloads.client.url, meta.downloads.client.sha1);
')
[ -n "$INFO" ] || { echo "!! 未取得下载信息"; exit 1; }
JAR_URL="${INFO% *}"
SHA1="${INFO##* }"

# 共享 jar 缓存：坏件（SHA1 不符，多半是下载中断截断）自动重下
if [ -f "$JAR" ] && [ "$(sha1_of "$JAR")" != "$SHA1" ]; then
  echo "==> 已有 jar 的 SHA1 不符（下载不完整），重新下载…"
  rm -f "$JAR"
fi
if [ ! -f "$JAR" ]; then
  echo "==> 下载 client.jar $MC_VERSION（约 40-60MB）…"
  curl -sS --fail -o "$JAR" "$JAR_URL"
fi
if [ "$(sha1_of "$JAR")" != "$SHA1" ]; then
  rm -f "$JAR"
  echo "!! jar SHA1 校验失败（下载不完整），重跑本脚本"
  exit 1
fi

if [ ! -f "$VF" ]; then
  echo "==> 下载 Vineflower $VINEFLOWER_VERSION…"
  curl -sS --fail -o "$VF" "https://repo1.maven.org/maven2/org/vineflower/vineflower/$VINEFLOWER_VERSION/vineflower-$VINEFLOWER_VERSION.jar"
fi

echo "==> 反编译到 temp/minecraft-src/（数分钟，别关窗口）…"
mkdir -p "$OUT"
find "$OUT" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
java -Xmx4G -jar "$VF" "$JAR" "$OUT"

TODAY="$(date +%F)"
cat > "$OUT/SOURCE.md" <<EOF
# Minecraft 反编译源码（本机自用，勿入库勿分发）

- 版本：$MC_VERSION（无混淆，含变量名）
- 来源：$JAR_URL
- 工具：Vineflower $VINEFLOWER_VERSION
- 生成：$TODAY，scripts/fetch-mc-src.sh
EOF

echo "==> 完成：temp/minecraft-src/"
