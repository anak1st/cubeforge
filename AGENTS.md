# AGENTS.md — AI 协作约定

本文件是 AI 编码代理在本仓库工作时的常驻上下文。

## 目标

浏览器端体素实验游戏（Minecraft-like），目的是学习体素引擎核心算法：分块世界、网格生成、BFS 光照、DDA 射线、AABB 碰撞。

参照（选择性借鉴、不做整体复刻），按用途分层：

- **Minecraft 官方代码**（反编译产物 `temp/minecraft-src/`，分析见 `docs/refs/minecraft.md`）——**世界行为的主要参照**：草方块染色、光照范围等机制规格以此为准
- **Luanti** 与 **Voxelize**（均 `refs/` 只读克隆，后者为 TypeScript + three.js 同栈）——性能优化与工程实现参考

## 硬约束（不要提议突破）

1. 无联机、无多人 —— 不写任何网络代码
2. 无 mod/插件系统 —— 不设计脚本接口
3. 仅桌面浏览器，键鼠操作 —— 不做移动端适配
4. 单机实验项目 —— 不过度工程化（不引 monorepo、不造抽象层）

## 分层规则（最重要）

```
src/core/     纯逻辑：chunk/注册表/mesher/光照/射线/碰撞/合成
              禁止 import：three、react、react-dom、document/window 等 DOM API
src/render/   three.js 场景与网格装配      禁止 import react
src/game/     游戏循环、输入、玩家、存档    禁止 import react
src/ui/       React 组件、zustand store    禁止 import three
src/workers/  Worker 入口                  只消费 core
```

## 命令

```bash
pnpm dev         # 开发服务器
pnpm build       # tsc -b && vite build
pnpm lint        # ESLint
pnpm preview     # 预览产物
pnpm test        # vitest run
pnpm typecheck   # tsc -b
```

## 完成定义（Definition of Done）

1. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` 全绿
2. `src/core/` 的每个新算法/数据结构都有对应 vitest 用例
3. 人工验收清单（`docs/plan/plan.md` 对应里程碑章节）全部通过
4. `TODO.md` 勾选完成项；`docs/impl/Mxx.md` 写验收记录；`git tag Mxx`

## 工作流：里程碑制

- `docs/plan/plan.md` 是唯一事实源：里程碑顺序、任务、人工验收清单都以它为准；设计文档在 `docs/plan/`；当前任务与进度见 `TODO.md`
- 一个里程碑 ≈ 一次 AI 会话的范围；开场读 plan/plan.md 对应章节 + 本文件
- 文档组织只分三块：`docs/refs/`（外部资料与分析）、`docs/plan/`（计划与设计，已实现的只留框架）、`docs/impl/`（实现记录，尽量少写——细节跟代码注释走）
- **人的角色是验收员**：AI 产出代码 + 测试 + "待验收"状态，人按清单在浏览器里操作并记录
- 验收不通过时，修复会话只修清单上的失败项，不做清单之外的重构

## 代码风格

- 遵循模板既有 ESLint 规则；不新增风格类规则
- 不写 `any`（用 `unknown` + 收窄，或具体类型）
- 类/接口/组件/函数前写一行"做什么"的说明注释；函数体内只写承重的约束（数值、浏览器行为等），不写叙述性"为什么"
- 提交信息用中文，格式 `feat|fix|docs|test|refactor: 描述`；里程碑完成打 `Mxx` tag

## 依赖门禁

新增任何依赖（含 devDependencies）必须先向用户说明必要性并获得批准。
