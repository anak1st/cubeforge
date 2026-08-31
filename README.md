# cubeforge

浏览器端体素实验游戏（Minecraft-like）。以学习体素引擎的核心算法为目的——分块世界、网格生成、BFS 光照、体素射线、AABB 碰撞——架构参考开源引擎 [Luanti](https://github.com/luanti-org/luanti)（原 Minetest，源码分析见 [docs/luanti.md](docs/luanti.md)）。

**范围限定**：单机、无联机、无 mod 系统、面向桌面浏览器（Chrome/Firefox/Safari 最新版，键鼠操作）。

## 当前状态

🚧 设计与骨架阶段——里程碑 M0（工程骨架）进行中。整体路线见 [docs/plan.md](docs/plan.md)，当前步骤见 [TODO.md](TODO.md)。

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M0 | 工程骨架与开发回路 | 🚧 脚手架已建，分层规则/测试回路待补 |
| M1 | 场景、相机与调试面板 | ⬜ |
| M2 | 世界数据模型（chunk/注册表，纯逻辑） | ⬜ |
| M3 | 网格化与面剔除 | ⬜ |
| M4 | 无限世界与流式加载 | ⬜ |
| M5 | 第一人称移动与交互（挖/放） | ⬜ |
| M6 | 光照与昼夜 | ⬜ |
| M7 | React UI 与存档 | ⬜ |
| M8 | 物品/背包/合成 | ⬜ |
| M9 | 音效/粒子/表现打磨 | ⬜ |
| M10 | 玩法原型 + 性能验收 + 分发 | ⬜ |

## 技术栈

| 层 | 选型 |
|---|---|
| 语言 | TypeScript（strict） |
| 构建 | Vite 8 + pnpm |
| 渲染 | three.js（WebGL，暂定 M3 引入） |
| UI | React 19 + zustand（仅 UI 层，不进 3D 场景） |
| 测试 | vitest（覆盖 `src/core/` 纯逻辑） |
| 存档 | IndexedDB + 原生 CompressionStream（M7） |

## 目录结构（规划）

```
src/
├── core/      # 纯逻辑：chunk、方块注册表、网格生成、光照 BFS、DDA、碰撞
│              #   —— 禁止 import three/react/DOM，vitest 全覆盖
├── render/    # three.js 场景与网格装配（禁止 import react）
├── game/      # 游戏循环、输入、玩家、存档（禁止 import react）
├── ui/        # React：主菜单/设置/背包/HUD（禁止 import three）
└── workers/   # mesh/light Web Worker（消费 core）
```

分层依赖方向单向：`ui → game → core`。违规会被 ESLint 拦截（M0 待配置）。

## 开发

```bash
pnpm install
pnpm dev        # 开发服务器（HMR）
pnpm build      # 类型检查 + 产物构建
pnpm preview    # 预览构建产物
pnpm lint       # ESLint
```

> `pnpm test` / `pnpm typecheck` 在 M0 完成后可用。

`refs/` 是 Luanti 与 minetest_game 的本地克隆，**只读参考资料**，不参与构建、不入库（已在 .gitignore）。

## 文档

- [docs/plan.md](docs/plan.md) —— 里程碑计划表与人工验收清单
- [docs/luanti.md](docs/luanti.md) —— Luanti 源码深度分析（算法与架构蓝本）
- [docs/voxelize.md](docs/voxelize.md) —— Voxelize 源码深度分析（同栈 TS/three.js 引擎，实现可直接移植）
- [docs/comparison.md](docs/comparison.md) —— 综合分析：两个参考对象逐维度对照与 cubeforge 取向
- [TODO.md](TODO.md) —— 当前里程碑的任务清单
- [AGENTS.md](AGENTS.md) —— AI 协作约定（分层规则、工作流、完成定义）
