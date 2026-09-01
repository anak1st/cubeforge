#!/usr/bin/env bash
# 用 Vineflower 反编译 MC 官方 client.jar (须为无混淆版本) 为可读 Java, 落 temp/minecraft-src/.
# jar 与 fetch-mc-assets.sh 共用 (SHA1 校验, 坏件自动重下).
# 前置: PATH 里有 java (JDK 21+). 反编译约数分钟, 峰值内存 2-4GB. 产物先写 SOURCE.md 作完成标记, 重做请先删该文件.
set -euo pipefail

MC="26.2"
VF_VER="1.12.0"   # Vineflower 锁版本 (maven central: org.vineflower:vineflower)
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JAR="$ROOT/temp/minecraft-client-$MC.jar"
VF="$ROOT/temp/vineflower-$VF_VER.jar"
OUT="$ROOT/temp/minecraft-src"
mkdir -p "$ROOT/temp"

command -v java >/dev/null || { echo "!! PATH 里找不到 java: 需要 JDK 21+"; exit 1; }

if [ -f "$OUT/SOURCE.md" ]; then
  echo "==> 已反编译过, 跳过 (重做请先删除 ${OUT})"
  exit 0
fi

sha1() { node -e 'const c=require("crypto"),f=require("fs");process.stdout.write(c.createHash("sha1").update(f.readFileSync(process.argv[1])).digest("hex"))' "$1"; }

echo "==> 查询 $MC 下载信息"
INFO=$(MC="$MC" node --input-type=module -e '
const id=process.env.MC;
const m=await (await fetch("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json")).json();
const v=m.versions.find(v=>v.id===id);
const meta=(await (await fetch(v.url)).json());
const d=meta.downloads.client;
if (meta.downloads.client_mappings) { console.error(id+" 仍是混淆版本: 请升级脚本锁定的版本"); process.exit(1); }
console.log(d.url, d.sha1);
')
read -r URL SHA <<< "$INFO"

# jar 缓存: 坏件 (SHA1 不符) 自动重下
if [ -f "$JAR" ] && [ "$(sha1 "$JAR")" != "$SHA" ]; then rm -f "$JAR"; fi
if [ ! -f "$JAR" ]; then
  echo "==> 下载 client.jar (约 40-60MB)"
  curl -fsSL -o "$JAR" "$URL"
  [ "$(sha1 "$JAR")" = "$SHA" ] || { rm -f "$JAR"; echo "!! 下载不完整, 重跑本脚本"; exit 1; }
fi

if [ ! -f "$VF" ]; then
  echo "==> 下载 Vineflower $VF_VER"
  curl -fsSL -o "$VF" "https://repo1.maven.org/maven2/org/vineflower/vineflower/$VF_VER/vineflower-$VF_VER.jar"
fi

echo "==> 反编译到 temp/minecraft-src/ (数分钟)"
rm -rf "$OUT"
java -Xmx4G -jar "$VF" "$JAR" "$OUT"

cat > "$OUT/SOURCE.md" <<EOF
# Minecraft 反编译源码 (本机自用, 勿入库勿分发)

- 版本: ${MC} (无混淆, 含变量名)
- 来源: $URL
- 工具: Vineflower ${VF_VER}
- 生成: $(date +%F), scripts/fetch-mc-src.sh
EOF
echo "==> 完成"
