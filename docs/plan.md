# cubeforge 开发计划

> **技术栈**：浏览器 · TypeScript(strict) + Vite + three.js + React 19 · 单机、无联机、无 mod、桌面键鼠（硬约束见 [AGENTS.md](../AGENTS.md)）。
> **架构分层**：`core/`（纯逻辑）→ `render/`（three）→ `game/`（循环/输入/存档）→ `ui/`（React），依赖单向；`workers/` 只消费 core。
> **参照策略**：**世界行为以 Minecraft 官方源码为准**——机制规格、数值、手感基准一律先查 `temp/minecraft-src/`（模块地图见 [refs/minecraft.md](refs/minecraft.md)）；性能与工程手法参考 Luanti（`refs/luanti`）与 Voxelize（`refs/voxelize`）；Web 平台事实基准以 MDN / web.dev 为准。
> **审核原则**：人按各里程碑"验收"在浏览器里过一遍；性能类指标写明看 DevTools 哪个数字；不验收代码风格。
> 本文是 `docs/` 唯一计划文档：跨里程碑定案在"架构定案"，其余设计按里程碑内嵌；外部资料与分析在 `refs/`。

## 通用完成定义

1. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` 全绿。
2. `src/core/` 每个新算法有 vitest 用例；core 无 three/DOM 依赖。
3. 验收要点逐条通过，记录 `docs/impl/Mxx.md`，打 `git tag Mxx`。
4. 一个里程碑 ≈ 一次 AI 会话：开场读本文对应章节 + AGENTS.md + refs 对应模块指引。

## 里程碑总览

| # | 名称 | 产出 | 状态 |
|---|---|---|---|
| M0 | 工程骨架与开发回路 | 可跑的空壳 | ✅ |
| M1 | 场景 / 相机 / 调试面板 | 看得见的 3D 世界 | |
| M2 | 世界数据模型（纯逻辑） | core 层 + 测试 | 🔶 注册表已落地 |
| M3 | 网格化与面剔除 | 方块长出三角形 | |
| M4 | 无限世界与流式加载 | 走不到边的地形 | |
| M5 | 第一人称：移动 / 碰撞 / 挖放 | 手感闭环 | |
| M6 | 光照与昼夜 | 明暗世界 | |
| M7 | UI 与存档 | 菜单 / 设置 / 存档 | 🔶 壳已提前实现（见下 M7 进度） |
| M8 | 物品 / 背包 / 合成 | 游戏性闭环 | |
| M9 | 音效 / 粒子 / 水 / 树 | "像一款游戏" | |
| M10 | 玩法原型 + 性能 + 分发 | 可分享链接 | |

## 架构定案（跨里程碑）

### 所有权：ui → game → render

- **游戏数据的唯一存放处是 `src/game/store.ts`**（zustand vanilla 全局单例，不依赖 React）：应用阶段、世界状态（演示期 = 方块旋转角）都在这里。任何模块直接 import，不经 props / 实例透传、不在顶层定义再层层下发。
- **`src/game/controller.ts` 导出语义 action 与画布挂载 API**：`startGame / pauseGame / resumeGame / backToMenu` 负责切换游戏状态；**指针锁等浏览器 API 是 action 内部的副作用**，UI 不触碰原始接口；浏览器事件（pointerlockchange）作为另一个驱动源，把锁的实况回流写 store。rAF 循环、50ms dt 截断、演示键输入、场景生命周期（`attachCanvas`/`detachCanvas`，幂等承受 StrictMode 双挂载）也在这里。浏览器原始封装只存在于 `src/game/pointer-lock.ts` 一个文件。
- `ui/` 只做两件事：经 `useGame(selector)` 读 store 渲染（低频订阅，selector 不变不重渲染）+ 调语义 action；每帧量不过 React。
- `render/` 纯绘制（`render(rot)` / `setBlock` / `dispose`）：不起循环、不持有运行状态、不监听输入。
- 现状：以上已实现（demo 范围），行为保持——开始屏无画面、ESC→暂停覆盖层、"继续"冷却 1.25s 后可点且恢复无角度跳变、暂停中 ESC 无反应、暂停≠停循环。

### 应用状态机（已实现，v1）

`menu ──开始──▶ playing ──ESC退锁──▶ paused ──点击重锁──▶ playing`；`menu` 不挂画布，`paused` 冻结+覆盖层。单一事实源 zustand；`pointerlockchange` 是 phase 唯一事实源（锁定即 running、退锁即 paused，切页签/最小化自动退锁同理）。

### 相机与循环

三项目（MC/Luanti/Voxelize）无一把相机放进固定 tick：**相机在渲染帧驱动**（variable dt），转向用"目标 + 平滑收敛"两层；MC 固定 20 TPS 只管模拟、渲染用 partialTicks 插值。我们：M1 起相机走渲染帧；M5 引入碰撞时再叠固定 tick 或子步。重锁后丢弃首个鼠标增量（Chrome 首帧 ~60 跳变；MC `ignoreFirstMove`、Voxelize `justUnlocked` 同款）。依据与源码行号见 [refs/loop-camera.md](refs/loop-camera.md)。

### UI 边界

- zustand 只存**低频**视图态：appState、选中快捷栏位、生命（事件驱动，非每帧）。
- **每帧量不过 React**：坐标/FPS/朝向归 game 层（store + 循环持有）；F3 面板 `subscribe` + ref 直写 `textContent`，节流 ~4Hz；游戏循环在 React 外。
- DOM overlay（React）做菜单与 HUD，canvas 只画世界；焦点规则：暂停覆盖层出现→焦点移入菜单，恢复→交还画布；按钮保持真实 `<button>` + `focus-visible`，键盘可达不因像素风牺牲。

### 资源加载（已实现）

`MANIFEST` 是全项目唯一贴图清单；逐张独立降级（失败换 16×16 紫黑棋盘 + warn，**永不 reject**，缺失不阻塞游戏）。MC 哲学：紫黑棋盘继续跑。细节见 `src/render/textures.ts`；贴图文件 gitignore（授权见 [refs/minecraft-assets.md](refs/minecraft-assets.md)）。

---

## 关键决策记录

- **参照分层**（2026-09-01）：世界行为以 MC 为准；Luanti / Voxelize 用于性能与工程手法。
- **存档 = 生成即冻结**（2026-09-01，对齐 MC）：chunk 首次生成即持久化，之后仅脏块重写；元信息记 `generatorVersion` 与 `saveVersion`。
- **存储起点**：`Uint16Array` 直存 id（≈ MC GlobalPalette 退化形态）；M4 视需要上调色板压缩。
- **光照直接双通道**（0..15，天空光 / 方块光分开存）：先正确 BFS，再谈增量优化。
- **回退重做**（2026-09-02）：可玩切片整体回退，代码自 M0 演示重新生长；同日提前落地 UI 壳与资源加载体系。
- **Web 平台外围定案**（2026-09-04，上网调研后）：指针锁 Promise + `unadjustedMovement` 降级；输入绑定 `e.code`、只拦游戏用键；存储分层 localStorage（设置）+ IndexedDB（存档，原生 CompressionStream 压缩、零新依赖）+ `storage.persist()`；生命周期 `hidden` 即暂停回写、弃用 unload。要点内嵌于 M5 / M7 / M10。
- **状态架构定案**（2026-09-05）：游戏数据存全局单例 store（`src/game/store.ts`），任意模块直接 import，不做实例/props 透传；UI 只调语义 action（`src/game/controller.ts`），**指针锁等浏览器 API 是切换状态的副作用而非 UI 的职责**，浏览器事件回流写 store。已按此重构 demo 壳；跨目录 import 一律用 `@/` 别名（tsconfig paths + vite alias）。
- **文档收敛**（2026-09-05）：`docs/plan/` 并入本文单文件；MC 方块探查与循环对照移入 `refs/`；已实现设计只留框架。细节查 git 历史。

---

## 各里程碑

每项按"目标 / 范围 / MC 参考 / 验收"组织。范围只定"做什么"，不定"怎么做"——动手前先读对应 MC 模块。

### M0 · 工程骨架 ✅

工具链、分层目录、开发回路已就绪。资源加载体系一并提前落地（见"架构定案·资源加载"）。挂账：Tweakpane 面板（与 M1 一并完成）。

### M1 · 场景、相机与调试面板

- **目标**：屏幕里有带光照的三维内容，相机可控，参数可视化。
- **范围**：环境光 / 平行光 / 天空 / 雾；飞行相机（拖转 + WASD），**相机在渲染帧驱动、不做固定 tick + 插值**（架构定案）；固定步长累加器接线（60Hz 逻辑）留作 M5 前 stub；Tweakpane 绑 FOV / 雾距 / 步长。挂账：滚轮调速（M5 一并实现）。
- **MC 参考**：`client/renderer/GameRenderer.java`、`client/Camera.java`。
- **验收**：方块阵列明暗可辨面；相机平滑无步进感；FOV / 雾距实时生效；窗口缩放不变形；FPS ≈ 刷新率。

### M2 · 世界数据模型（纯逻辑）

- **目标**：MC/Luanti 式"世界 = 数字"的数据模型在 core 落地，本步不渲染。
- **范围**：16³ chunk（id + 光照预留）；World 容器与跨块寻址；三级坐标换算（位运算，负数正确）。
- **方块定义定案**：`BlockProperties` 字段 `hasCollision` / `canOcclude` / `destroyTime` 对齐 MC（`destroyTime` 数值已对齐：stone 1.5 / grass 0.6 / dirt 0.5 / sand 0.5 / leaves 0.2）；资源引用（贴图/model）不进 core，映射在 render 层。**按需扩展**：M3 加渲染层维度、M5 加 VoxelShape、M6 加 `lightEmission`；BlockState 属性系统挂 M8+。MC 维度全表见 [refs/mc-block-properties.md](refs/mc-block-properties.md)。
- **MC 参考**：`world/level/chunk/LevelChunkSection.java`、`PalettedContainer.java`。
- **验收**：`pnpm test` 全绿（坐标往返 / 越界防护 / 跨块读写 / 初始全 0）；`grep -rn "three\|document\|window" src/core/` 零命中。
- **进度**（2026-09-02）：方块注册表已落地（7 方块，外观映射 `materialsForBlock`，切换演示 1/2/3）；chunk / World 部分未开始。

### M3 · 网格化与面剔除

- **目标**：chunk 数据 → 顶点缓冲 → 屏幕；相邻面剔除；一张纹理图集。
- **范围**：mesher 纯函数（chunk + 四邻查询 → position/uv/light）；程序化高度图地形（草 / 泥 / 石）；canvas 合成图集；透明方块分桶到第二材质 pass；F3 调试（三角形数 / chunk 数 / 边界线框）。遮挡判定用 `canOcclude`（M2 定案）。
- **MC 参考**：`client/renderer/chunk/SectionCompiler.java`（逐 section 编译、面剔除、按渲染层分桶）。
- **验收**：丘陵地形可辨草 / 泥 / 石；chunk 交界无裂缝、无闪面；三角形数随视点与挖方明显变化（证明剔除生效）；mesher 测试绿。

### M4 · 无限世界与流式加载

- **目标**：Emerge 最小版——走到哪生成到哪，走远卸载，种子确定性。
- **范围**：按视距生成 / 卸载（视距可调）；网格生成移入 Worker（手写消息协议，每帧限量换入）；修改波及邻块重网格；慢生成模拟开关（验证不冻结画面）。
- **MC 参考**：`server/level/ChunkMap.java`、`ChunkTaskDispatcher.java`；`world/level/chunk/status/`（生成阶梯）；`PalettedContainer`（是否上压缩在此拍板）。
- **验收**：连续飞 2 分钟无世界尽头；原路返回地形一致（同种子确定性）；Performance 录制无 >200ms 长任务；快速穿行约 100 chunk 后 FPS 回正常；地平线温和浮现无整片闪现。

### M5 · 第一人称：移动、碰撞、挖与放

- **目标**：物理 + AABB 碰撞 + DDA 拾取 + 挖 / 放的手感闭环。输入在现有 game 层结构上扩展为完整键位表 + 鼠标增量（架构定案）。
- **范围**：玩家 AABB（0.6×1.8）重力跳跃、分轴碰撞、自动上台阶；射线 4 格 + 线框选中；按硬度挖掘（裂纹反馈）、放置拒绝入体；掉出世界回出生点；碰撞子步方案在此按 refs/loop-camera.md 拍板（固定 tick + 插值 或 子步）。
- **指针锁协议 v2**（2026-09 调研定案）：
  - Promise 版 `requestPointerLock({ unadjustedMovement: true })`（关 OS 鼠标加速）；reject 且 `NotSupportedError` → 无参降级（Safari 未跟进）；需瞬态用户激活。
  - `pointerlockchange`/`pointerlockerror` 都挂 document；**phase 唯一事实源是 pointerlockchange**，不另监听 ESC 键（防双迁移）；`pointerlockerror` → 保持 paused，**不自动重试**。
  - ESC 退锁浏览器强制、不可拦；Chrome 在用户 ESC 退锁后 ~1.25s 拒绝重锁（冷却**仅此路径**，程序化 `exitPointerLock()` 无冷却）；重锁丢弃首个 movement；`movementX/Y` 无需 DPI 换算。
  - 同手势既要指针锁又要全屏：先 `requestPointerLock()` 再 `requestFullscreen()`（后者消费瞬态激活）。
- **输入规则**：键位表（`e.code` → 语义）是唯一绑定源；**仅锁定态**对表内键 preventDefault（Space 跳、F3 调试、滚轮换栏）；canvas 拦 `contextmenu`（右键放置）与中键 autoscroll（`mousedown button===1`，中键取方块）；Ctrl+W / Alt+Tab 等保留键不对抗——潜行用 Shift 避让；菜单态全放行保 Tab / Enter。
- **MC 参考**：`world/entity/Entity.java`（`move → collide → collideWithShapes`）、`world/phys/shapes/`、`BlockGetter.clip`；敏感度公式 `sens=(0.6x+0.2)³×8`（`MouseHandler.java:349-351`）。
- **验收**：手感成立（跳 1 格、跳不上 2 格、Shift 减速明显）；贴墙滑行不卡不穿；4 格外不选中；挖放全套含"不放进自己身体"；右键 / 中键 / Space / F3 浏览器默认行为已拦；切页签回来停暂停菜单，冷却后点击恢复且无首帧视角跳变；Ctrl+W 仍关页签（证明没做无谓对抗）；碰撞 / 射线纯函数测试绿。

### M6 · 光照与昼夜

- **目标**：阳光柱 + BFS 方块光、跨 chunk 补算、平滑光照 / AO、昼夜循环。
- **范围**：双通道 0..15；BFS 传播与收光；跨 chunk 欠账补算；顶点色 + 平滑 / AO；10 分钟昼夜（天空 / 雾联动）；火把（光 14）注册，`lightEmission` 维度按 M2 定案加入。
- **MC 参考**：`world/level/lighting/`（传播规则、增量队列、跨 section 邻接——行为基准）。
- **验收**：隧道渐变平滑无跳变；火把光圈正确出现 / 消失；光跨 chunk 边界照到邻块；昼夜切换帧率不掉；光照 core 测试绿（收光 / 边界 / 树叶截断）。

### M7 · UI 与存档

- **目标**：主菜单 / 设置 / 暂停 / 存取的单机闭环。
- **进度**（2026-09-02 提前落地）：应用状态机 v1、开始/暂停画面、像素风按钮、指针锁 v1、资源加载——见"架构定案"。
- **范围**：settings 态、像素风 HUD（按"UI 边界"三档：静态 / 低频 zustand / 高频 ref 直写）；存档落地：
  - **库划分**：IndexedDB `cubeforge` 两 store——`meta`（名字 / 种子 / 时间 / `saveVersion` / `generatorVersion`）、`chunks`（key=`世界id:chunk坐标`，value=压缩 `Uint8Array`）；chunk 本体 `Uint16Array` 直存（生成即冻结），写盘前经原生 `CompressionStream('deflate-raw')` 压缩（2025-11 起全浏览器 baseline，**零新依赖**）。设置走 localStorage（前缀 `cubeforge.`），与存档分离——IDB 故障不影响进游戏。
  - **回写时机**：脏 chunk 攒批 ~3s 周期 + `visibilitychange→hidden`（暂停 + 立即回写）+ `pagehide` 兜底；**不注册** unload / beforeunload（不可靠且拖累 bfcache）；`pageshow(persisted)` 停 paused；后台 rAF 自停靠 dt 钳制兜底。
  - **持久化与兜底**：首次建世界调 `navigator.storage.persist()`（被拒不阻塞）；导出 / 导入单世界文件（File System Access 优先，退 `<a download>`/`<input type=file>`）；存档 IO 归主线程 `game/`，`workers/` 不做 IO；不用 OPFS / SQLite（无关系查询需求）。
- **MC 参考**：存档语义对齐 MC；UI 无官方对应，自建。
- **验收**：新建世界 → 玩 → 退出 → 重进全流程；改动 / 位置 / 时间保持；设置即时生效且刷新保留；删除世界生效；走远触发卸载再走回，地形与离开时一致；杀页签重开损失 ≤ 一个回写周期；导出 → 删 → 导入一致；清空 IDB（模拟损坏）仍可进菜单、新建世界；开始屏无游戏画面 / ESC 暂停 / 冷却恢复 / 键盘可操作（壳 v1 待验收项在此一并过）。

### M8 · 物品、背包与合成

- **目标**：ItemStack、掉落物实体、背包 / 快捷栏 UI、最小合成链。
- **范围**：ItemStack 与物品注册（工具硬度倍率）；掉落物实体（吸附 / 旋转 / 消失）；背包 UI（拖拽 / 堆叠 / 拆半）；合成（shaped 平移匹配 + shapeless）；挖掘联动工具倍率；BlockState 属性系统若需要在此拍板。
- **MC 参考**：`world/item/`、`world/entity/item/`（掉落物行为参数）。
- **验收**：挖掉落 → 吸附入包；拖拽 / 合并 / 拆半正确；合成错配无输出、取出返还；木镐明显加速；背包满时掉落物不被吞；测试绿。

### M9 · 音效、粒子与表现打磨

- **目标**：从能玩到像游戏——全部观感项。
- **范围**：WebAudio 音效（挖 / 放 / 脚步 / 拾取，音量设置接通；**AudioContext 在首次用户手势 `resume()`**——挂"开始 / 继续"点击）；破坏粒子；手持物摆动 / 挥动；水（半透明、入水减速变色）；树叶 alpha 镂空；树生成（原木 + 树叶簇）。
- **MC 参考**：`client/particle/`、`client/renderer/`、树 / 水方块的行为参数。
- **验收**：音效随方块材质区分且音量可控；粒子受重力落地消失；手持物摆动 / 挥动；水观感成立；树叶透空；新世界有树。

### M10 · 玩法原型 + 性能验收 + 分发

- **目标**：回答"这是个什么实验游戏"，给出可分享链接。
- **范围**：玩法方向 M9 末拍板（限时挖矿 / 蓝图对比 / 轻生存）；固定种子脚本化巡检 + 人工复核；静态托管（GitHub Pages 顶层优先 / itch 第二渠道）+ 加载页；qa 归档与 known-issues。
- **分发注意**：跨域 iframe（itch）需宿主 `allow` 含 pointer-lock 与 fullscreen（itch 对 HTML5 构建自动处理，自建嵌入页自行配置）；已知怪癖：多显示器下全屏 + 指针锁鼠标可能逃出 iframe——顶层托管无此问题。
- **验收**：陌生电脑（Chrome）加载可玩 10 分钟；进世界 <5s；视距 8 站定 FPS ≈60、绕圈无 <30 持续掉帧；无 >200ms 主线程长任务；Console 无持续报错；玩法循环自洽。

## 风险与降级

| 风险 | 信号 | 降级方案 |
|---|---|---|
| M6 光照复杂度超预期 | 超期 1 天以上 | "放置重算受影响区"替代精确收光 |
| Worker 通讯难定位 | M4 卡壳 | mesh 回主线程，Worker 挂账 M9 前 |
| 存档回写丢数据 | 杀页签重开损失超一个回写周期 | 缩短回写周期；导出 / 导入兜底 |
| 性能不达标 | M4 / M10 验收失败 | 降视距 → 视锥剔除细化 → 热路径 WASM |
| 玩法方向悬而不决 | M9 末未拍板 | "免费建造 + 截图分享"兜底 |

## 平台资料（Web 事实来源）

指针锁：[MDN Pointer Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API)、[requestPointerLock()](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock)；生命周期：[Chrome Page Lifecycle](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)、[web.dev bfcache](https://web.dev/articles/bfcache)；存储：[web.dev Storage for the web](https://web.dev/articles/storage-for-the-web)、[Compression Streams 全浏览器支持](https://web.dev/blog/compressionstreams)；参照实现：[refs/loop-camera.md](refs/loop-camera.md)。
