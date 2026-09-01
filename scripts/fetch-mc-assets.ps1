# 下载 MC 官方 client.jar（版本固定 $McVersion），全量资源解压到 temp/minecraft/（浏览用工作区），
# 再把当前需要的资源按原相对路径挑选到 public/（挑选清单见 $Picks）。
# temp/minecraft/<路径> 与 public/<路径> 一一对应，复制时不改相对路径。
# Mojang 版权资产仅限本机自用：temp/ 与 public/textures/ 均不入库（docs/credits.md）。
# 用法：pwsh -File scripts/fetch-mc-assets.ps1
$ErrorActionPreference = 'Stop'

$McVersion = '26.2'
$Root = (Get-Item "$PSScriptRoot/..").FullName
$Temp = "$Root/temp/minecraft"
$Dest = "$Root/public"
New-Item -ItemType Directory -Force $Dest | Out-Null

# 挑选清单：temp/minecraft 内的相对路径，落到 DEST 时原样保留。需要新资源时在下面加行。
$Picks = @(
  'textures/block/grass_block_top.png'
  'textures/block/grass_block_side.png'
  'textures/block/grass_block_side_overlay.png'
  'textures/block/dirt.png'
  'textures/colormap/grass.png'
)

Write-Host "==> 查询 Mojang 版本清单（$McVersion）…"
$manifest = Invoke-RestMethod 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
$version = $manifest.versions | Where-Object id -eq $McVersion | Select-Object -First 1
if (-not $version) { throw "版本清单里找不到 $McVersion" }
$jarUrl = (Invoke-RestMethod $version.url).downloads.client.url

if ((Test-Path "$Temp/.extracted") -and (Get-Content "$Temp/.extracted" -Raw).Trim() -eq $McVersion) {
  Write-Host "==> temp/minecraft/ 已有 $McVersion 全量解压结果，跳过下载"
} else {
  Write-Host "==> 下载 client.jar $McVersion（约 40MB）…"
  $Jar = "$env:TEMP/mc-client.jar"
  curl.exe -sS -o $Jar $jarUrl
  if ($LASTEXITCODE -ne 0) { throw '下载 client.jar 失败' }

  Write-Host '==> 全量解压到 temp/minecraft/…'
  if (Test-Path $Temp) { Remove-Item -Recurse -Force $Temp }
  New-Item -ItemType Directory -Force $Temp | Out-Null
  # 只用 System32 的 bsdtar（Win10+ 自带，支持 zip）：PATH 里的 tar 可能是 Git 的 GNU tar，读不了 zip；
  # bsdtar 默认支持通配符选取条目，--strip-components=2 剥掉 assets/minecraft/ 前缀
  & "$env:SystemRoot/System32/tar.exe" -xf $Jar -C $Temp --strip-components=2 'assets/minecraft/*'
  if ($LASTEXITCODE -ne 0) { throw '解压 client.jar 失败' }
  Remove-Item $Jar
  Set-Content "$Temp/.extracted" $McVersion
}

Write-Host "==> 挑选 $($Picks.Count) 个文件到 $Dest/…"
foreach ($p in $Picks) {
  New-Item -ItemType Directory -Force "$Dest/$(Split-Path $p)" | Out-Null
  Copy-Item "$Temp/$p" "$Dest/$p"
}

Write-Host "==> 完成：挑选 $($Picks.Count) 个文件到 $Dest/"
Write-Host "    全量工作区（可随时浏览挑选）：$Temp/"
