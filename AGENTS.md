# AGENTS.md — AI 协作约定

本文件是 AI 编码代理在本仓库工作时的常驻上下文。每次会话开始先读完本文件；与用户指令冲突时以用户指令为准，冲突本身要向用户指出。

## 项目是什么

浏览器端体素实验游戏（Minecraft-like），目的是学习体素引擎核心算法。架构蓝本是 Luanti（原 Minetest）：

- **算法与架构参考**：`docs/luanti.md`（各子系统"问题 → Luanti 做法 → 自研要点"）
- **参考源码**：`refs/luanti`、`refs/minetest_game`（只读克隆，禁止修改、禁止提交、禁止 import 进工程）

## 硬约束（不要提议突破）

1. 无联机、无多人 —— 不写任何网络代码
2. 无 mod/插件系统 —— 不设计脚本接口
3. 仅桌面浏览器，键鼠操作 —— 不做移动端适配
4. 单机实验项目 —— 不过度工程化（不引 monorepo、不造抽象层）

## 技术栈与版本

- TypeScript strict + Vite 8 + pnpm；渲染 three.js（WebGL）；UI React 19 + zustand（仅限 `ui/`）；测试 vitest
- **不升级依赖大版本、不引入上面清单之外的重型库**（物理引擎、状态管理框架、UI 框架等）；需要新依赖时先说明理由征求同意
- 已锁定版本见 `package.json` / `pnpm-lock.yaml`；加依赖时锁定精确版本

## 分层规则（最重要）

```
src/core/     纯逻辑：chunk/注册表/mesher/光照/射线/碰撞/合成
              禁止 import：three、react、react-dom、document/window 等 DOM API
src/render/   three.js 场景与网格装配      禁止 import react
src/game/     游戏循环、输入、玩家、存档    禁止 import react
src/ui/       React 组件、zustand store    禁止 import three
src/workers/  Worker 入口                  只消费 core
```

- 依赖方向单向：`ui → game → core`，禁止反向、禁止跨层（如 `render → ui`）
- ⚠️ 截至 M0，**ESLint 分层禁令尚未配置**（配置本身是 TODO.md 的任务）。配置完成前请自觉遵守：写 `core/` 代码时不得出现任何浏览器/渲染依赖
- 每帧更新的数据（FPS、坐标显示）不得进入 React state——用 ref 直接写 DOM

## 命令

```bash
pnpm dev         # 开发服务器
pnpm build       # tsc -b && vite build
pnpm lint        # ESLint
pnpm preview     # 预览产物
# M0 完成后新增：pnpm test（vitest）、pnpm typecheck（tsc --noEmit）
```

## 完成定义（Definition of Done）

1. `pnpm lint && pnpm build` 全绿（M0 后加 `&& pnpm test && pnpm typecheck`）
2. `src/core/` 的每个新算法/数据结构都有对应 vitest 用例
3. 人工验收清单（`docs/plan.md` 对应里程碑章节）全部通过
4. `TODO.md` 勾选完成项；`docs/qa/Mxx.md` 写验收记录；`git tag Mxx`

## 工作流：里程碑制

- `docs/plan.md` 是唯一事实源：里程碑顺序、任务、**人工验收清单**都以它为准
- 一个里程碑 ≈ 一次 AI 会话的范围；开场读 plan.md 对应章节 + luanti.md 相关章节 + 本文件
- **人的角色是验收员**：AI 产出代码 + 测试 + "待验收"状态，人按清单在浏览器里操作并记录
- 验收不通过时，修复会话只修清单上的失败项，不做清单之外的重构
- 降级预案（光照收光、Worker、IndexedDB 等）按 plan.md 风险表执行，不自行改方案

## 代码风格

- 遵循模板既有 ESLint 规则；不新增风格类规则
- 不写 `any`（用 `unknown` + 收窄，或具体类型）
- 注释只写"为什么/约束"，不写"这段代码在做什么"；公开 API 写 TSDoc 一行
- 提交信息用中文，格式 `feat|fix|docs|test|refactor: 描述`；里程碑完成打 `Mxx` tag

## 常见任务对照

| 要做什么 | 先看 |
|---|---|
| chunk/方块注册表/网格生成 | `docs/luanti.md` §3 §5，`refs/luanti/src/mapblock.h` `src/nodedef.h` |
| 光照 BFS / 昼夜 | `docs/luanti.md` §7，`refs/luanti/src/light.h` `src/daynightratio.h` |
| 碰撞 / 射线拾取 | `docs/luanti.md` §8 §9，`refs/luanti/src/collision.cpp` `src/raycast.cpp` |
| 物品/合成/库存 | `docs/luanti.md` §10，`refs/luanti/src/craftdef.h` |
| 存档格式 | `docs/luanti.md` §13，`refs/luanti/doc/world_format.md` |
| UI/背包/菜单 | `docs/luanti.md` §14 |
