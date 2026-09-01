# 用 Vineflower 反编译 MC 官方 client.jar (须为无混淆版本) 为可读 Java, 落 temp/minecraft-src/.
# jar 与 fetch-mc-assets.ps1 共用 (SHA1 校验, 坏件自动重下).
# 前置: PATH 里有 java (JDK 21+). 反编译约数分钟, 峰值内存 2-4GB. 产物先写 SOURCE.md 作完成标记, 重做请先删该文件.
# 用法: pwsh -File scripts/fetch-mc-src.ps1
$ErrorActionPreference = 'Stop'

$McVersion = '26.2'
$VineflowerVersion = '1.12.0'   # Vineflower 锁版本 (maven central: org.vineflower:vineflower)
$Root = (Get-Item "$PSScriptRoot/..").FullName
$Jar = "$Root/temp/minecraft-client-$McVersion.jar"
$Vf = "$Root/temp/vineflower-$VineflowerVersion.jar"
$Out = "$Root/temp/minecraft-src"
New-Item -ItemType Directory -Force "$Root/temp" | Out-Null

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  throw '!! PATH 里找不到 java: 需要 JDK 21+ (如 scoop install temurin21-jdk)'
}

if (Test-Path "$Out/SOURCE.md") {
  Write-Host "==> 已反编译过, 跳过 (重做请先删除 $Out)"
  exit 0
}

Write-Host "==> 查询 $McVersion 下载信息"
$manifest = Invoke-RestMethod 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
$entry = $manifest.versions | Where-Object id -eq $McVersion | Select-Object -First 1
if (-not $entry) { throw "版本清单里找不到 $McVersion" }
$meta = Invoke-RestMethod $entry.url
# 无混淆版的判定: version JSON 里没有 client_mappings 下载项 (有即仍是混淆版)
if ($meta.downloads.PSObject.Properties['client_mappings']) {
  throw "$McVersion 仍是混淆版本: 升级脚本里锁定的版本"
}
$sha1 = $meta.downloads.client.sha1

# jar 缓存: 坏件 (SHA1 不符) 自动重下
if ((Test-Path $Jar) -and ((Get-FileHash -Algorithm SHA1 $Jar).Hash -ne $sha1)) { Remove-Item $Jar }
if (-not (Test-Path $Jar)) {
  Write-Host '==> 下载 client.jar (约 40-60MB)'
  curl.exe -fsSL -o $Jar $meta.downloads.client.url
  if ($LASTEXITCODE -ne 0) { throw '下载 client.jar 失败' }
}
if ((Get-FileHash -Algorithm SHA1 $Jar).Hash -ne $sha1) { Remove-Item $Jar; throw '!! 下载不完整, 重跑本脚本' }

if (-not (Test-Path $Vf)) {
  Write-Host "==> 下载 Vineflower $VineflowerVersion"
  curl.exe -fsSL -o $Vf "https://repo1.maven.org/maven2/org/vineflower/vineflower/$VineflowerVersion/vineflower-$VineflowerVersion.jar"
  if ($LASTEXITCODE -ne 0) { throw '下载 Vineflower 失败' }
}

Write-Host '==> 反编译到 temp/minecraft-src/ (数分钟)'
New-Item -ItemType Directory -Force $Out | Out-Null
Get-ChildItem $Out -Force | Remove-Item -Recurse -Force
java -Xmx4G -jar $Vf $Jar $Out
if ($LASTEXITCODE -ne 0) { throw '反编译失败 (内存不足可加大 -Xmx, 或换更新的 JDK)' }

Set-Content "$Out/SOURCE.md" @"
# Minecraft 反编译源码 (本机自用, 勿入库勿分发)

- 版本: $McVersion (无混淆, 含变量名)
- 来源: $($meta.downloads.client.url)
- 工具: Vineflower $VineflowerVersion
- 生成: $(Get-Date -Format 'yyyy-MM-dd'), scripts/fetch-mc-src.ps1
"@
Write-Host '==> 完成'
