# 下载 MC 官方 client.jar (版本固定 $McVersion), 全量解压到 temp/minecraft-assets/, 再按清单挑选到 public/.
# jar 与 fetch-mc-src.ps1 共用 (SHA1 校验, 坏件自动重下). Mojang 资源仅本机自用: temp/ 与 public/textures/ 均不入库 (docs/credits.md).
# 用法: pwsh -File scripts/fetch-mc-assets.ps1
$ErrorActionPreference = 'Stop'

$McVersion = '26.2'
$Root = (Get-Item "$PSScriptRoot/..").FullName
$Jar = "$Root/temp/minecraft-client-$McVersion.jar"
$Temp = "$Root/temp/minecraft-assets"
$Dest = "$Root/public"
New-Item -ItemType Directory -Force "$Root/temp" | Out-Null

# 挑选清单: temp/minecraft-assets 内的相对路径, 落到 public/ 时原样保留. 需要新资源时在下面加行.
$Picks = @(
  'textures/block/grass_block_top.png'
  'textures/block/grass_block_side.png'
  'textures/block/grass_block_side_overlay.png'
  'textures/block/dirt.png'
  'textures/block/stone.png'
  'textures/colormap/grass.png'
)

Write-Host "==> 查询 $McVersion 下载信息"
$manifest = Invoke-RestMethod 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
$version = $manifest.versions | Where-Object id -eq $McVersion | Select-Object -First 1
if (-not $version) { throw "版本清单里找不到 $McVersion" }
$meta = Invoke-RestMethod $version.url
$sha1 = $meta.downloads.client.sha1

# jar 缓存: 坏件 (SHA1 不符) 自动重下
if ((Test-Path $Jar) -and ((Get-FileHash -Algorithm SHA1 $Jar).Hash -ne $sha1)) { Remove-Item $Jar }
if (-not (Test-Path $Jar)) {
  Write-Host '==> 下载 client.jar (约 40MB)'
  curl.exe -fsSL -o $Jar $meta.downloads.client.url
  if ($LASTEXITCODE -ne 0) { throw '下载 client.jar 失败' }
  if ((Get-FileHash -Algorithm SHA1 $Jar).Hash -ne $sha1) { Remove-Item $Jar; throw '!! 下载不完整, 重跑本脚本' }
}

if ((Test-Path "$Temp/.extracted") -and (Get-Content "$Temp/.extracted" -Raw).Trim() -eq $McVersion) {
  Write-Host '==> 已解压过, 跳过'
} else {
  Write-Host '==> 解压资源'
  if (Test-Path $Temp) { Remove-Item -Recurse -Force $Temp }
  New-Item -ItemType Directory -Force $Temp | Out-Null
  # 只用 System32 的 bsdtar (Win10+ 自带, 支持 zip): PATH 里的 tar 可能是 Git 的 GNU tar, 读不了 zip;
  # --strip-components=2 剥掉 assets/minecraft/ 前缀
  & "$env:SystemRoot/System32/tar.exe" -xf $Jar -C $Temp --strip-components=2 'assets/minecraft/*'
  if ($LASTEXITCODE -ne 0) { throw '解压 client.jar 失败' }
  Set-Content "$Temp/.extracted" $McVersion
}

Write-Host "==> 挑选 $($Picks.Count) 个文件到 public/"
foreach ($p in $Picks) {
  New-Item -ItemType Directory -Force "$Dest/$(Split-Path $p)" | Out-Null
  Copy-Item "$Temp/$p" "$Dest/$p"
}
Write-Host '==> 完成'
