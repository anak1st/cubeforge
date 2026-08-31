# CREDITS — 素材来源与授权

## Minecraft 官方资源（`public/texture/minecraft/` 与 `temp/minecraft/`）

提取自 Mojang 官方客户端 26.2（`client.jar`，经 `scripts/fetch-mc-assets.sh` 从 Mojang 官方 CDN 获取，2026-08-31）。
全量解压在 `temp/minecraft/`（工作区），仅挑选必要的资源落位到 `public/texture/minecraft/`。逐类分析与挑选清单见 [`docs/assets/minecraft.md`](docs/assets/minecraft.md)。

- **版权**：© Mojang Studios / Microsoft，保留所有权利。非开源、不可再分发。
- **使用范围**：仅限本机学习自用。`temp/` 与 `public/texture/minecraft/` 均已 gitignore，**不入库、不进分发产物**；新克隆请运行获取脚本。
- **染色机制**：`grass_block_top.png` 为灰度图，按 `grass_colormap.png` 染色（平原 ≈ `#91BD59`）；侧面 = `side` + 染色后的 `side_overlay` 叠加。

## 参考仓库（`refs/`，不入库）

只读克隆，由 `scripts/fetch-refs.sh` 以 `--depth 1` 浅克隆获取：

| 仓库 | 上游 | 授权 | 索引 |
|---|---|---|---|
| luanti | github.com/luanti-org/luanti | 代码 LGPL 2.1+ | `docs/refs/luanti.md` |
| minetest_game | github.com/luanti-org/minetest_game | 代码 LGPL 2.1+，媒体 CC BY-SA 3.0 | `docs/refs/minetest_game.md` |
| voxelize | github.com/voxelize/voxelize | MIT | `docs/refs/voxelize.md` |
