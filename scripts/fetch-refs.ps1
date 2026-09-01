# 浅克隆参考仓库到 refs/ (--depth 1: 只取最新快照, refs/ 已 gitignore 不入库).
# 各仓库的用途与关键源码索引见 docs/refs/. 克隆失败只提示, 不中断, 重跑本脚本即可续传.
# 用法: pwsh -File scripts/fetch-refs.ps1
$ErrorActionPreference = 'Stop'

$Root = (Get-Item "$PSScriptRoot/..").FullName
New-Item -ItemType Directory -Force "$Root/refs" | Out-Null

function Clone-Repo([string]$name, [string]$url) {
  $dest = "$Root/refs/$name"
  if (Test-Path "$dest/.git") {
    Write-Host "==> $name 已存在, 跳过"
  } else {
    git clone --depth 1 --single-branch $url $dest
    if ($LASTEXITCODE -eq 0) {
      Write-Host "    $name HEAD: $(git -C $dest rev-parse --short HEAD)"
    } else {
      Write-Host "!!  克隆 $name 失败, 已跳过 (可稍后重跑本脚本)"
    }
  }
}

Clone-Repo -name luanti -url https://github.com/luanti-org/luanti.git
Clone-Repo -name minetest_game -url https://github.com/luanti-org/minetest_game.git
Clone-Repo -name voxelize -url https://github.com/voxelize/voxelize.git
