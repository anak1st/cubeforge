# TODO — 当前进度

> 详细背景见 `docs/plan.md`。当前状态：**M2 世界数据模型已实现 + 测试，待验收**。下一阶段是**可玩切片**——把 M2 的数据接到"看得见、能飞、能暂停"的第一条线。

---

## 当前焦点：可玩切片（playable slice）

**一句话**：单个 16³ chunk 的有限世界（草/泥/石分层）+ 飞行相机 + 开始/暂停菜单。
**对应里程碑**：M3（网格化最小版）+ M1（飞行相机，已提前落地骨架）+ M7（菜单最小版）。
**为什么先围出这条线**：M2 纯数据不可见，用户反馈"空中楼阁没把握"。本切片用最小代价把 core→render→game→ui 四层全部打通，让数据模型第一次被眼睛验证；同时把 mesh/相机/菜单的骨架立起来，后续 M4-M6 在骨架上加。

### 范围与分层（谁写什么）

| 层 | 产出 | 依赖 |
|---|---|---|
| `core/` | `mesher.ts`（纯函数网格化）、`terrain.ts`（演示地形生成）、纹理 tile 映射 | 只依赖 blocks/chunk，无 three/DOM |
| `render/` | chunk 网格装配（`MeshData`→`BufferGeometry`）、canvas 合成图集、世界场景 | three |
| `game/` | `camera.ts`（飞行相机 + Pointer Lock）、`createGame` 接线（循环 + 场景 + 相位控制） | three 可 import，不 import react |
| `ui/` | 相位状态机（**React state**，`useState`/Context）、`StartMenu`/`PauseMenu`、`GameView` 接线 | 仅 react/react-dom，不 import three |

> 依赖方向单向：ui → game → render → core。game 通过"暴露 start/pause/resume + 回调上报相位"与 ui 协作，ui 绝不直接读 three 对象。
> 相位状态用 **React state**（用户决定，不引 zustand / 无新依赖）。

### 世界构造（单 chunk，有限）

16×16 地表，一个 chunk 的 footprint（16³）。分层层列（每列 x,z ∈ 0..15）：

| y | 方块 | 说明 |
|---|---|---|
| 5..15 | 空气 | 上是天空 |
| 4 | 草 | 顶面 |
| 2..3 | 泥土 | 过渡层 |
| 0..1 | 石头 | 底座 |

`terrain.ts`：`generateDemoTerrain(chunk)` 按上表填列。**纯函数、可测**（逐层 id 断言）。不引入高度图扰动，flat 即可——侧面能看到草/泥/石三色分层，反面验证面剔除生效。

### 网格化（core/mesher.ts）

**接口（为 M4 跨 chunk 预留，不做重写）**：
```ts
// isOpaque 由调用方包一层，本切片对单 chunk 而言"邻居越界=空气=透明"
mesher(getBlock: (x,y,z) => number): MeshData
interface MeshData { positions: Float32Array; normals: Float32Array; uvs: Float32Array; indices: Uint32Array }
```
- 逐格遍历：`id===air` 跳过；对 6 个方向，邻居 `isTransparent` → 递归面。
- 每面 4 顶点 + 2 三角（indices 6）；法线=面法向；uv 按 tile 矩形取样。
- **面剔除判定**：方块本身稳定，透明邻居才留面；空气必然透明，故 chunk 越界外壳面呈现在屏幕上。
- **纹理 tile 映射（core 纯逻辑，反查表）**：图集 2×2 = `[grass_top, grass_side, dirt, stone]`。grass: 顶=0 侧=1 底=2(dirt)；dirt 全 2；stone 全 3。
- **测试（DoD 必须）**：
  1. 单个 stone 方块 → 恰 6 面
  2. 两相邻同实体 → 共享面剔除，共 10 面
  3. 邻居为空气（含越界）→ 面保留
  4. 各面法线方向正确、uv/fnv 落在对应 tile 矩形
  5. 空 chunk → 0 面

### 渲染装配（render）

- `buildChunkGeometry(data): THREE.BufferGeometry`：Position/uv/normal + index。
- **canvas 合成图集**：复用 `scene.ts` 现有 `tinted`（Multiply 上色 + destination-in）给草顶/草侧染色（`PLAINS_GREEN`），拼 2×2 到一张 `CanvasTexture`（NearestFilter，sRGB）。
- **世界场景**：把现有"演示单方块"替换为单个 chunk 网格；保留环境光/平行光/天空(改浅蓝)/雾/相机/裁剪。
- 材质：`MeshLambertMaterial({ map: atlas })`，单 opaque pass；本切片不含水/树叶（透明分桶挂到 M3 完整版）。

### 飞行相机（game/camera.ts）

- Pointer Lock：点击开始/继续时 `requestPointerLock`；`pointerlockchange` 锁丢失 → 自动暂停（ESC 由浏览器退锁，天然不做 keydown 拦截）。
- 视角：movementX/Y → yaw/pitch；WASD 沿 yaw 水平移动，Space/Shift 升降，滚轮调速。
- 位置由主循环 `onTick`（固定步长，M1 累加器接线）按 dt 积分；无碰撞。
- **相机对象归属 render**：`createWorldScene` 返回 `camera`，game 拿到引用驱动，保持 scene 只负责 three 装配。

### 菜单状态机（ui + zustand）

相位：`start | playing | paused`。

| 事件 | 相位变化 | 谁触发 |
|---|---|---|
| 页面加载 | → start | ui（显示开始菜单：标题 + "开始游戏"） |
| 点"开始游戏" | → 请求PointerLock → playing | ui 调 `game.start()` |
| 玩中按 ESC（浏览器退锁） | → paused | game 经 `pointerlockchange` 上报，ui 显示暂停菜单（继续 / 返回菜单） |
| 点"继续" | → 重新锁定 → playing | ui 调 `game.resume()` |
| 点"返回菜单" | → start | ui 调 `game.stop()`（解锁 + 暂停循环） |

- **game → ui 上报**：`createGame` 收 `onPhase(phase)` 回调，ui 用 `useState` 更新相位。
- **ui → game 指令**：`createGame` 返回 `{ start, pause, resume, stop, dispose }`。
- 相位 state 由 ui 层（`GameView`/`App`）持有，menu 组件读相位渲染；`GameView` 用 `useEffect` 完成初始装配与析构。

### 依赖 / MC 参考

- **无新依赖**（相位用 React state，不引 zustand）。
- MC 参考：网格化与面剔除 → `client/renderer/chunk/SectionCompiler.java`（逐 section 编译、按渲染层分桶）；相机观感 → `client/Camera.java`、`GameRenderer.java`。具体数值/手法在实现前读对应 `docs/refs/minecraft.md` 模块。

### 验收（人过清单 + qa 记录 + tag）

1. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` 全绿。
2. `src/core/` 新增 mesher/terrain 均有 vitest 用例；`grep -rn "three\|document\|window" src/core/` 零命中。
3. 浏览器人工：加载见开始菜单 → 点开始 → 见一个小岛（草顶/泥/石侧面清晰区分）→ WASD/滚轮/Space/Shift 飞行流畅、视角可控 → ESC 弹出暂停菜单 → 点"继续"回到飞行、画面不重置 → 点"返回菜单"回开始页。
4. 角标 FPS ≈ 刷新率；无 Console 报错。
5. 通过后写 `docs/qa/` 记录 + 打 tag（**plan.md 里程碑总览不动**，本切片在 TODO 追踪；tag 名称实现前定，不强行冒充 `M3` 全量）。

### 任务清单

- [x] M2 验收（机械化：test 已绿 + core 纯度 grep），写 `docs/qa/M2.md` + `git tag M2`
- [x] `core/mesher.ts` + 测试（8 用例）
- [x] `core/terrain.ts` + 测试（3 用例）
- [x] `render/`：图集合成 + `buildChunkGeometry` + 世界场景（替换演示方块）
- [x] `game/camera.ts`（Pointer Lock + 飞行）+ `createGame` 接线 + 相位控制
- [x] `ui/`：React state 相位 + 开始/暂停菜单 + `GameView` 接线
- [x] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` 全绿（31 用例）
- [ ] **人工验收**（plan.md 下方清单逐条，浏览器操作）→ `docs/qa/` 记录 → `git tag Mx`（tag 名实现前定）

### 验收快照（已完成实现的机械项）

- test：5 文件 31 用例全过；新增 mesher(8)/terrain(3) 已有用例
- lint / typecheck：clean
- build：production 成功
- core 纯度：`grep -rn "three\|document\|window" src/core/` —— 仅注释命中"three"，无 import/DOM
- 新增素材：`public/textures/block/stone.png`（已并入 `scripts/fetch-mc-assets.sh` 的 PICKS）
- 无新增 npm 依赖（相位用 React state）
