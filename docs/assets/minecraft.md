# Minecraft 官方资源 · 描述与分析

> 版本 26.2。
> 来源：Mojang 官方 CDN 的 `client.jar`。**版权资产仅限本机自用，不入库不分发**——见仓库根 [`CREDITS.md`](../CREDITS.md)。

## 资源流：全量工作区 → 挑选落位

```
client.jar (Mojang CDN, ~40MB)
  └─ scripts/fetch-mc-assets.sh
       ├─ temp/minecraft/            全量解压（45MB，gitignore，可随时浏览；含 .extracted 标记免重复下载）
       └─ public/texture/minecraft/  挑选的文件按原相对路径一一映射落位
```

- **放置规则**：`temp/minecraft/<路径>` 与 `public/texture/minecraft/<路径>` 一一对应，复制时不改相对路径；需要新资源时在脚本的 `PICKS` 清单加一行即可。
- temp 里保留 jar 内 assets/minecraft 的原始目录结构（`textures/`、`models/`、`lang/`…），方便对照原版文档找东西。

## 当前挑选清单（public/texture/minecraft/）

| 文件 | 用途 |
|---|---|
| `textures/block/grass_block_top.png` | 草方块顶面（**灰度图**，需染色） |
| `textures/block/grass_block_side.png` | 草方块侧面底图 |
| `textures/block/grass_block_side_overlay.png` | 侧面草皮叠加层（灰度，染色后盖在 side 上） |
| `textures/block/dirt.png` | 草方块底面 / 泥土 |
| `textures/colormap/grass.png` | 生物群系色表，取平原绿 `#91BD59` |

## 全量树（temp/minecraft/）分类速览

client.jar 含 15 个顶层资源目录（实测 4031 个贴图文件 / 17MB + 模型/语言/着色器等数据）。**没有 `sounds/`**——音效由启动器另行下载，不在 client.jar 里。

| 目录 | 内容 | cubeforge 取用 |
|---|---|---|
| `textures/block/` | 方块面贴图（1371 个文件含 102 个动画 .mcmeta） | ✅ 挑选中 |
| `textures/colormap/` | 生物群系色表：grass / foliage / dry_foliage | ✅ 挑选中 |
| `textures/item/` | 非方块物品图标（796 个） | M8 背包 |
| `textures/environment/` | 太阳/月亮/云/雨雪 | M6 昼夜参考 |
| `textures/particle/` | 粒子（含破坏方块碎片） | M9 粒子 |
| `models/`、`blockstates/` | 方块模型与状态定义（JSON） | 机制参考 |
| `lang/`、`shaders/`、`atlases/` 等 | 翻译、着色器、图集清单 | 机制参考 |
| `textures/entity/`、`gui/`、`font/`、`painting/` 等 | 生物皮肤、MC 界面、字体、画 | ❌ 不取（React 自建 UI，无人形生物计划） |

## 值得引擎学习者注意的机制

1. **灰度图 + 色表染色**：`grass_block_top.png` 是灰度图，颜色来自 256×256 查找表（横轴≈温度、纵轴≈降水，平原 ≈ `#91BD59`）。一张贴图 + 一次乘法 = 几十种气候变体。注意新版已无水的色表（水色移入生物群系数据）。
2. **多面方块的文件拆分**：`oak_log.png` + `oak_log_top.png`；草方块 = `top` / `side` / `side_overlay`（灰度叠加层，染色后盖上去）/ 底面复用 `dirt.png`。引擎里存的是"方块定义 → 每面一个贴图名"。
3. **动画贴图**：多帧竖向堆叠在一张 PNG（如 `water_still.png`），同名 `.mcmeta` 声明帧时长。
4. **overlay 叠加**：叠加层只画变化部分（草皮边缘），透明处露底图——染色只作用于 overlay，泥土不受影响。
5. **方块物品没有图标**：`item/` 里没有 `dirt.png`，方块类物品直接用方块贴图渲染 3D 图标。
6. **命名空间在路径**：`assets/minecraft/textures/...`，与 Luanti 的文件名前缀（`default_stone.png`）不同，但本质都是"方块定义 → 每面贴图名字符串 → 命名空间解析"。我们 `core/blocks.ts` 照此设计，换材质包只换字符串。
