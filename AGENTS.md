# AGENTS.md — AI 协作约定

本文件是 AI 编码代理在本仓库工作时的常驻上下文。

## 目标

浏览器端体素实验游戏（Minecraft-like），目的是学习体素引擎核心算法：分块世界、网格生成、BFS 光照、DDA 射线、AABB 碰撞。

两个参考对象，选择性借鉴、不做整体复刻：

- **Luanti**（原 Minetest，C++）——机制参考：边界处理、光照、碰撞等"标准答案"，源码只读克隆于 `refs/luanti`
- **Voxelize**（TypeScript + three.js 同栈）——实现参考：算法可直接移植，源码只读克隆于 `refs/voxelize`

## 硬约束（不要提议突破）

1. 无联机、无多人 —— 不写任何网络代码
2. 无 mod/插件系统 —— 不设计脚本接口
3. 仅桌面浏览器，键鼠操作 —— 不做移动端适配
4. 单机实验项目 —— 不过度工程化（不引 monorepo、不造抽象层）

## 当前实现

- 工程骨架：Vite 8 + TypeScript strict + React 19 + Tailwind CSS 4 + three.js r185（pnpm，精确版本锁 `package.json`）
- `src/render/scene.ts`：three.js 演示场景（黑底自转草方块，原版贴图 + 生物群系染色），`createDemoScene(canvas)` 返回释放函数
- `src/ui/`：`SceneCanvas`（React 承载 canvas 的范式）+ `App`（全屏容器 + 标题角标）
- 资源脚本：`scripts/fetch-mc-assets.sh`（MC 全量资源解压到 `temp/minecraft/`，按原相对路径挑选到 `public/`）、`scripts/fetch-refs.sh`（参考仓库浅克隆）
- 里程碑进度与人工验收清单见 `docs/plan.md`，当前任务见 `TODO.md`

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
- ⚠️ **ESLint 分层禁令尚未配置**（TODO.md 任务）。配置完成前请自觉遵守：写 `core/` 代码时不得出现任何浏览器/渲染依赖
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

- `docs/plan.md` 是唯一事实源：里程碑顺序、任务、人工验收清单都以它为准
- 一个里程碑 ≈ 一次 AI 会话的范围；开场读 plan.md 对应章节 + 本文件
- **人的角色是验收员**：AI 产出代码 + 测试 + "待验收"状态，人按清单在浏览器里操作并记录
- 验收不通过时，修复会话只修清单上的失败项，不做清单之外的重构

## 代码风格

- 遵循模板既有 ESLint 规则；不新增风格类规则
- 不写 `any`（用 `unknown` + 收窄，或具体类型）
- 注释只写"为什么/约束"，不写"这段代码在做什么"；公开 API 写 TSDoc 一行
- 提交信息用中文，格式 `feat|fix|docs|test|refactor: 描述`；里程碑完成打 `Mxx` tag

## 依赖门禁

新增任何依赖（含 devDependencies）必须先向用户说明必要性并获得批准；加依赖锁精确版本，不升级大版本。
