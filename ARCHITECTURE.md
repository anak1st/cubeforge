# cubeforge 架构设计

> 本文只定义架构的**形状**：各层入口、主要类与函数、主要流水线。
> 逐文件的落位在动手的里程碑里按本文生长，不提前铺开。
> 描述刻意只用文字与字符画——**一段结构若讲不清楚，说明它复杂了：先简化设计，而不是加注释去救**。
> 单机浏览器游戏：无联机、无 mod、无移动端（AGENTS.md 硬约束）。Minecraft 只作为结构与命名的参照。

---

## 1. 设计原则

1. **依赖单向**：`ui → game → render → core`，`workers → core`；反向引用一票否决。
2. **数据与呈现分离**：`World` 是唯一权威数据；three 的几何、React 的状态都是它的投影。
3. **纯逻辑可测试**：core 不碰 three / DOM / react，算法一律"输入 → 输出"，vitest 直接测。
4. **不做全量重算**：地形按需生成、网格只重编脏 chunk、光照只重算受影响区。
5. **按里程碑生长**：本文定形状不定文件清单；每个能力在它所属的里程碑出现。

## 2. 分层

```
 ui ──▶ game ──▶ render ──▶ core
          │                   ▲
          └──▶ workers ───────┘
```

边上流的是什么：

- `ui → game`：start / resume / stop 命令；onPhase 回调上报相位。
- `game → render`：MeshData 换入（chunk 网格增删改）；相机驱动。
- `game ↔ workers`：消息 + transferable 缓冲（请求生成/网格化，回传结果）。
- `render → core` / `workers → core`：查表（方块属性）、采样（方块 id）。

每层一句话，以及它**不是**什么：

| 层 | 是 | 不是 |
|---|---|---|
| core | 世界数据模型 + 全部算法 | 不认识 three、DOM、react |
| workers | 生成与网格化的后台线程 | 只算不存，无状态 |
| render | three 装配：数据 → GPU | 不做游戏逻辑 |
| game | 唯一主循环 + 各子系统的装配 | 不含算法 |
| ui | React 壳：菜单 / HUD / 相位 | 每帧变化的数据不进 React state |

明确不做：事件总线、依赖注入容器、ECS、`utils/` 杂物目录。

---

## 3. 各层入口形状

"入口" = 其他层唯一被允许消费的东西，入口之外皆私有。

### core —— 数据 + 纯函数

```ts
// 数据
class Chunk               // 16³ 方块：ids + 光照（一对 TypedArray）
class World               // chunk 容器：跨块读写；setBlock 时标 dirty
interface BlockProperties // 方块定义：碰撞 / 遮挡 / 硬度 / 贴图槽位 / 发光（注册表查表）

// 算法（全是"输入 → 输出"，可进 worker、可进测试）
generateChunk(cx, cy, cz, seed) → Chunk                       // 地形生成，种子确定
buildChunkMesh(sample, origin) → MeshData                     // 网格化：邻接剔除 + 分层分桶
raycast(origin, dir, maxDist, isTarget) → BlockHit | null     // DDA 体素射线
sweepAABB(world, box, delta) → { 位移, 碰撞轴 }               // 分轴 AABB 扫掠
class LightEngine         // 双通道 0..15 BFS：增量传播与收光

// 后期
encodeChunk / decodeChunk // 存档编解码
ItemStack + 合成匹配      // 物品与合成
```

约定：数据容器用 class，算法用纯函数；除 World 的 dirty 标记外无副作用。

### workers —— 消息协议

```
请求  { type: 'build', jobs: [{ chunkKey, seed, 邻块边界面 }] }
响应  { chunkIds, meshData }   // TypedArray 一律 transferable 转移，零拷贝
```

worker 内只跑 core 的 gen / mesher / light，不持有任何状态；协议是它唯一的对外形状。

### render —— 工厂 + dispose

```ts
createWorldScene(canvas) → { camera; renderFrame(t); dispose }  // 场景总装
buildAtlas() → Promise<Atlas>      // 贴图加载、染色、合成
buildGeometry(buffers) → BufferGeometry   // 数据 → GPU 的纯翻译
createChunkView(scene) → { upsert(key, mesh); remove(key) }  // chunk 网格换入换出
```

约定：render 模块一律 `createXxx()` 工厂，返回带 `dispose()` 的接口；不持有游戏状态。

### game —— 唯一装配入口

```ts
createGame(canvas, { onPhase }) → Game
interface Game { start(); resume(); stop(); dispose() }
type Phase = 'start' | 'playing' | 'paused'
```

game 内部是并列的子系统（各自成文件，`game.ts` 只做装配）：
主循环 loop、输入 input（Pointer Lock + 键鼠）、相机 camera、玩家 player、流式加载 streaming、存档 persistence、音效 audio。

### ui —— React 壳

```
<GameView>   拥有 <canvas>；useEffect 里 createGame / dispose —— 命令式世界的唯一接缝
<App>        持有相位 state，按相位显示菜单
菜单 / HUD   回调驱动，只读；每帧数字（FPS 等）走 stats 白板直写 DOM
```

---

## 4. 主要流水线

### 4.1 帧循环（全项目唯一 rAF，双频率）

```
每个渲染帧（rAF，显示刷新率）
  ├─ 累加器 += 帧长（钳上限，卡顿后不追帧）
  ├─ 每攒满 16.7ms 执行一次 tick（固定 60Hz 逻辑）：
  │     输入意图 → 玩家物理（core 碰撞）→ 挖掘 / 放置 → 时间推进
  └─ 渲染：
        视角：消费鼠标增量（不进 tick，转向不被量化）
        位置：上一 tick → 本 tick 之间按 alpha 插值
        scene.renderFrame()
```

### 4.2 chunk：从无到屏幕

```
streaming 判定视距内需要哪些 chunk
  ├─ 有存档：persistence 从 IndexedDB 读回
  └─ 无存档：worker 里 generateChunk 生成（种子确定）
        ↓
  World（唯一权威数据）
    ├─ 首写存档："生成即冻结"
    └─ worker 里 buildChunkMesh 网格化
          ↓ MeshData（transferable 回主线程）
        chunkView 换入 BufferGeometry → 场景 → GPU

编辑 / 光照变化 → World.dirty → 只重编脏 chunk + 回写存档
走出视距 → 撤网格、回写、释放 chunk
```

### 4.3 方块编辑（挖 / 放）

```
鼠标 → input → raycast（≤ 4 格）
  ├─ 命中 + 左键按住：按硬度累积进度（裂纹反馈）→ setBlock(空气)
  ├─ 命中 + 右键：命中格 + 命中面；与玩家身体相交则拒绝 → setBlock(方块)
  └─ 未命中：无操作

setBlock 之后一条链自动发生：
  光照增量更新（BFS，只动受影响区）
  → World.dirty 标记（所在 chunk + 边界邻块）
  → 脏 chunk 重新网格化
  → 存档节流回写
```

---

## 5. 主要类与函数一览

| 层 | 名字 | 一句话职责 | MC 对应 |
|---|---|---|---|
| core | `Chunk` | 16³ 存储块 | LevelChunkSection |
| core | `World` | chunk 容器 + 跨块读写 + 脏标记 | Level |
| core | `BlockProperties` | 方块定义，注册表查表 | Blocks.java / Properties |
| core | `generateChunk()` | 种子确定性地形 | levelgen |
| core | `buildChunkMesh()` | 邻接剔除 + 分层分桶 | SectionCompiler |
| core | `LightEngine` | 双通道 BFS 光照 | LightEngine |
| core | `raycast()` | DDA 体素射线 | BlockGetter.clip |
| core | `sweepAABB()` | 分轴 AABB 碰撞 | collideWithShapes |
| workers | `world.worker` | gen + mesh 后台执行 | 后台线程分派 |
| render | `createWorldScene()` | 场景总装 | LevelRenderer |
| render | `buildAtlas()` | 贴图合成与染色 | BiomeColors |
| render | `createChunkView()` | chunk 网格换入换出 | SectionRenderDispatcher |
| game | `createGame()` | 装配根 | Minecraft |
| game | `createMainLoop()` | 唯一 rAF + 固定 tick | runTick |
| game | `createInput()` | Pointer Lock + 键鼠 | Mouse/KeyboardHandler |
| game | `createPlayer()` | 意图 → 物理 → 挖放 | LocalPlayer |
| game | `createStreaming()` | 视距供需与卸载 | ChunkMap |
| ui | `GameView` | React 与游戏的接缝 | — |

---

## 6. 风格约定

- 命名直译 MC 术语（见上表），一文件一职责。
- core：容器 class + 算法纯函数；render / game：`createXxx()` 工厂 + `dispose()`；ui：函数组件。
- 测试与源文件同目录伴生（`foo.ts` ↔ `foo.test.ts`）。
- 模块头注释一行写"对应 MC 什么"，依据指向 `docs/refs/minecraft.md`。

## 7. 生长（粗粒度）

| 里程碑 | 落进架构的能力 |
|---|---|
| M3 | mesher 分桶、贴图槽位数据化、F3 调试 HUD |
| M4 | workers + streaming + chunkView（流式加载闭环） |
| M5 | raycast / sweepAABB / player + 挖放 |
| M6 | LightEngine + 昼夜 |
| M7 | 存档（encode/decode + persistence）+ ui 状态管理 |
| M8 | 物品、背包、合成 |
| M9 | 音效、粒子、水、树 |
