# 反编译 MC 官方 client.jar（版本固定 $McVersion，与 fetch-mc-assets.ps1 一致；须为无混淆版本）为可读 Java，
# 产物直接落 temp/minecraft-src/（只保留这一个版本；temp/ 已 gitignore 不入库）。
# jar 与 fetch-mc-assets.ps1 共用 temp/minecraft-client-<版本>.jar（SHA1 校验，坏件自动重下）。
# 自 2025-10 官方公告起新版本 jar 带原始命名（含变量名）；反编译产物无注释，仅供本机学习——EULA 允许阅读、禁止再分发。
# 前置：PATH 里有 java（JDK 21+）。反编译全 jar 约数分钟、峰值内存 2-4GB。
# 用法：pwsh -File scripts/fetch-mc-src.ps1（无参数；重做请先删 temp/minecraft-src/）
$ErrorActionPreference = 'Stop'

# 反编译器锁版本（maven central: org.vineflower:vineflower）
$VineflowerVersion = '1.12.0'
# MC 版本锁死，与 fetch-mc-assets.ps1 的 $McVersion 一致；升级时两处一起改。
$McVersion = '26.2'

$Root = (Get-Item "$PSScriptRoot/..").FullName
$Out = "$Root/temp/minecraft-src"
$Jar = "$Root/temp/minecraft-client-$McVersion.jar"
$Vf = "$Root/temp/vineflower-$VineflowerVersion.jar"
New-Item -ItemType Directory -Force "$Root/temp" | Out-Null

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  throw 'PATH 里找不到 java：需要 JDK 21+（如 scoop install temurin21-jdk）'
}

if (Test-Path "$Out/SOURCE.md") {
  Write-Host '==> temp/minecraft-src/ 已有反编译产物，跳过（重做请先删除该目录）'
  exit 0
}

Write-Host "==> 查询 Mojang 版本清单（$McVersion）…"
$manifest = Invoke-RestMethod 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
$entry = $manifest.versions | Where-Object id -eq $McVersion | Select-Object -First 1
if (-not $entry) { throw "版本清单里找不到 $McVersion" }
$meta = Invoke-RestMethod $entry.url
# 无混淆版的判定：version JSON 里没有 client_mappings 下载项（有即仍是混淆版）
if ($meta.downloads.PSObject.Properties['client_mappings']) {
  throw "$McVersion 仍是混淆版本：升级脚本里锁定的版本"
}

# 共享 jar 缓存：坏件（SHA1 不符，多半是下载中断截断）自动重下
$sha1 = $meta.downloads.client.sha1
if ((Test-Path $Jar) -and ((Get-FileHash -Algorithm SHA1 $Jar).Hash -ne $sha1)) {
  Write-Host '==> 已有 jar 的 SHA1 不符（下载不完整），重新下载…'
  Remove-Item $Jar
}
if (-not (Test-Path $Jar)) {
  Write-Host "==> 下载 client.jar $McVersion（约 40-60MB）…"
  curl.exe -sS --fail -o $Jar $meta.downloads.client.url
  if ($LASTEXITCODE -ne 0) { throw '下载 client.jar 失败' }
}
if ((Get-FileHash -Algorithm SHA1 $Jar).Hash -ne $sha1) {
  Remove-Item $Jar
  throw 'jar SHA1 校验失败（下载不完整），重跑本脚本'
}

if (-not (Test-Path $Vf)) {
  Write-Host "==> 下载 Vineflower $VineflowerVersion…"
  curl.exe -sS --fail -o $Vf "https://repo1.maven.org/maven2/org/vineflower/vineflower/$VineflowerVersion/vineflower-$VineflowerVersion.jar"
  if ($LASTEXITCODE -ne 0) { throw '下载 Vineflower 失败' }
}

Write-Host '==> 反编译到 temp/minecraft-src/（数分钟，别关窗口）…'
New-Item -ItemType Directory -Force $Out | Out-Null
# 产物目录整体重建（jar 与反编译器都在 temp 根，不在 $Out 里，可放心清空）
Get-ChildItem $Out -Force | Remove-Item -Recurse -Force
java -Xmx4G -jar $Vf $Jar $Out
if ($LASTEXITCODE -ne 0) { throw '反编译失败（内存不足可加大 -Xmx，或换更新的 JDK）' }

Set-Content "$Out/SOURCE.md" @"
# Minecraft 反编译源码（本机自用，勿入库勿分发）

- 版本：$McVersion（无混淆，含变量名）
- 来源：$($meta.downloads.client.url)
- 工具：Vineflower $VineflowerVersion
- 生成：$(Get-Date -Format 'yyyy-MM-dd')，scripts/fetch-mc-src.ps1
"@

Write-Host '==> 完成：temp/minecraft-src/'
