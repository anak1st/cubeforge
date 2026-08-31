# Voxelize 源码深度分析

> **上游**：<https://github.com/voxelize/voxelize> · 授权 MIT
> **本地源码**：`refs/voxelize`（只读，`scripts/fetch-refs.sh` 浅克隆获取）；记录时点 `d84a174`（2026-08-31）
>
> 本文档只分析 Voxelize 引擎本身：它是什么、每个子系统怎么实现、数据如何组织、算法细节是什么。
> 所有类名、位布局、算法行为均核实自 `refs/voxelize` 源码（v3.0.0，浅克隆）。

---

## 目录

1. [概览与定位](#1-概览与定位)
2. [架构与工程布局](#2-架构与工程布局)
3. [世界数据模型](#3-世界数据模型)
4. [网格生成](#4-网格生成)
5. [光照系统](#5-光照系统)
6. [方块系统](#6-方块系统)
7. [物理引擎](#7-物理引擎)
8. [控制与角色](#8-控制与角色)
9. [客户端渲染工程](#9-客户端渲染工程)
10. [物品与 UI 库](#10-物品与-ui-库)
11. [世界生成](#11-世界生成)
12. [网络与协议](#12-网络与协议)
13. [性能工程汇总](#13-性能工程汇总)
14. [工程化与测试文化](#14-工程化与测试文化)

---

## 1. 概览与定位

Voxelize 是一个**多人体素游戏引擎**，宣传语是 "A multiplayer, super fast, voxel engine in your browser"。由 Rust 服务器 + TypeScript 浏览器客户端组成，通过 protobuf 协议通信，无安装、无插件、浏览器即玩。有生产部署案例（create.town，一个持续运行的多人世界）。

| 项 | 数据 |
|---|---|
| 版本 | v3.0.0 |
| 客户端 | TypeScript + three.js，`packages/` 共约 **59,000 行** |
| 服务器 | Rust（ECS 框架 `specs` 0.20），`crates/` + `server/` 约 **21,000 行** |
| 协议 | protobuf（根目录 `messages.proto`，仅 136 行） |
| 测试 | 35 个测试文件（TS `*.test.ts` 与 Rust `tests.rs` 混布） |
| 基准 | `benches/`：灯光、网格、寻路三组 criterion 基准测试 |
| 独立包 | 客户端各包与 `voxelize-wasm-mesher` 均单独发布 npm |

## 2. 架构与工程布局

pnpm workspace + lerna 的 monorepo，服务端 crate 与客户端包一一对应着"同一份领域概念的两端实现"：

```
packages/               # TS 客户端（npm 逐包发布）
├── core/               # 引擎本体：World/Chunk/光照/网格消费/渲染（~4.7 万行）
├── aabb/               # 纯 TS AABB 类（零依赖）
├── physics-engine/     # 刚体 + 扫掠碰撞（~1,300 行）
├── raycast/            # slab 法射线（零依赖）
├── particles/          # 粒子
├── protocol/           # protobuf 生成的消息类型
├── transport/          # WebSocket 传输层
├── agent/ · debug/     # 服务端脚本代理 / 调试工具

crates/                 # Rust（cargo workspace）
├── core/               # 体素数据访问（VoxelAccess trait、块/光位操作）
├── gen/                # 世界生成（阶段管线 + 气候/地质/生态/河流/植被）
├── mesher/             # 网格生成（贪心合并、流体、顶点光、连通性）
└── wasm-mesher/        # 上面 mesher 的 wasm-pack 封装 → npm 包给浏览器

server/                 # 权威服务器运行时（specs ECS 世界）
messages.proto          # 全部协议消息（136 行）
```

两个架构事实值得注意：

1. **客户端和服务器共享同一套位级定义**。光照的打包/解包在 `packages/core/src/utils/light-utils.ts` 和 `crates/core/src/light.rs` 里逐字对应（TS `(light >> 12) & 0xf` ↔ Rust `(light >> 12) & 0xF`），靠纪律保持同步。
2. **网格生成器只有一个 Rust 实现**，服务器直接用它，浏览器通过 WASM 用同一个——两端网格结果天然一致，没有"客户端重写一份算法"的漂移问题。

## 3. 世界数据模型

### 3.1 柱形 Chunk：RawChunk

`packages/core/src/core/world/raw-chunk.ts`（720 行，带测试）。chunk 是 **x,z 两维的柱**，高度方向一整根：

```ts
class RawChunk {
  coords: Coords2;                   // 仅 (x, z)
  voxels: NdArray<Uint32Array>;      // 形状 [size, maxHeight, size]
  lights: NdArray<Uint32Array>;      // 同形状，光照独立成数组
  options: { size, maxHeight, maxLightLevel, subChunks };
}
```

- 坐标换算 `toLocal` 用移位与掩码（size 为 2 的幂时 `vx & (size-1)`）。
- `transferMode: "transfer" | "shared"`：Worker 间传输支持 **transferable ArrayBuffer 所有权转移**，或在 SharedArrayBuffer 可用时走共享内存零拷贝（配套 `libs/chunk-shared-pool.ts` 缓冲池）。
- 体素与光照**分成两个数组**：改光照不触碰体素数据，网格化/光照两个系统各自访问自己关心的数组，缓存友好。

### 3.2 体素 32 位位布局

一个体素一个 `u32`，位段定义在 `packages/core/src/utils/block-utils.ts`（Rust 侧同构）：

| 位 | 含义 | 容量 |
|---|---|---|
| 0–15 | 方块 id | 65,536 种 |
| 16–19 | 旋转（六面朝向） | 16 档 |
| 20–23 | Y 轴旋转 | 16 档 |
| 24–27 | **stage**（生长阶段） | 16 档 |
| 28 | waterlogged（含水标记） | 1 位 |
| 29–31 | waterlog level（水位） | 8 档 |

即：id + 朝向 + 作物生长阶段 + 含水状态全部塞进一个字。读改写用掩码：`extractID = voxel & 0xffff`、`insertID = (voxel & 0xffff0000) | id`。

### 3.3 光照 32 位位布局

`utils/light-utils.ts` / `crates/core/src/light.rs`，**四通道各 4 位**：

| 位 | 通道 |
|---|---|
| 12–15 | 阳光（Sunlight） |
| 8–11 | 红（Red） |
| 4–7 | 绿（Green） |
| 0–3 | 蓝（Blue） |

即每体素光值 = `(sun << 12) | (red << 8) | (green << 4) | blue`。四通道意味着火把可以真的是彩色光（红石灯发红光），阳光独立通道使昼夜切换**无需重算任何光值**——渲染时只调阳光通道的权重。

## 4. 网格生成

### 4.1 Rust mesher（`crates/mesher/src/mesher/`）

入口 `mesh_space_greedy(min, max, space, registry) -> Vec<GeometryProtocol>`，输入 `MeshInput { chunks: Vec<Option<ChunkData>>, min, max, registry, config }`——**一次网格化一个矩形区域，携带周围一圈 chunk**（Option 可空，边界欠数据时降级处理），输出几何 + 连通性。

算法主干（`greedy.rs`，约 600 行）：

1. **稀疏边界优化**：`find_sparse_non_empty_bounds` 先扫描实际非空范围，Empty 直接返回零几何，Sparse 则把扫描范围收缩到有方块的区域——大片空气不消耗循环。
2. **六个方向逐一切片**：对每个朝向（±x/±y/±z），沿该轴逐层切片；每层用 `HashMap<(i32,i32), FaceData>` 建一张 **2D 暴露面掩码**。
3. **贪心合并**：在掩码上把"同 id、同贴图、同光照"的相邻面合并成大四边形（`extract_greedy_quads` → `process_greedy_quad`），这是 Minecraft 式 greedy meshing 的标准做法，顶点数下降一个数量级。
4. **例外走非贪心通道**：`processed_non_greedy` / `processed_waterlogged` 两个集合标记特殊方块——带独立贴图面的方块、含水方块不参与合并，单独生成面（贪心与精细视觉并存的关键设计）。
5. 输出 `MeshOutput { geometries, connectivity: u32 }`——**connectivity 打包了本区域六个方向的面可见位**（`CONNECTIVITY_FULL/SEALED` 等），供邻区块后续网格化时做面剔除决策，避免"邻块未加载时先按空气处理、加载后再全部重算"。

配套模块：`fluid.rs`（水面高度插值专门网格化）、`vertex_light.rs`（光值烘焙为顶点色）、`connectivity.rs`、`faces.rs`（面定义）、`space.rs`（体素空间抽象）。

### 4.2 WASM 封装（`crates/wasm-mesher/`）

独立的 cargo workspace（wasm-pack 构建，crate-type cdylib），依赖 `wasm-bindgen` + `js-sys` + `serde`，发布为 npm 包。序列化边界用 serde camelCase 对齐 TS 命名。客户端在 `workers/mesh-worker.ts` 里调用它——**网格化在 Worker 里跑 Rust/WASM**，主线程只负责把结果装进 three.js BufferGeometry。

### 4.3 客户端消费侧的内存工程（`packages/core/src/core/world/`）

- `vertex-quantization.ts`：顶点坐标量化（降低 GPU 带宽与内存）。
- `chunk-region-arenas.ts`：几何内存 arena，按 region 分配，减少碎片。
- `memory-pressure.ts`：**内存压力监测 → 自适应降质**（卸载/降级远处资源），带测试。
- `chunk-shared-pool.ts`：SAB 缓冲池，配合 RawChunk 的 shared 传输模式。
- `section-visibility.ts`：subchunk 级可见性判定。

## 5. 光照系统

`packages/core/src/core/world/lighting.ts`（1,215 行）+ `workers/light-worker.ts` + Rust 侧 `crates/core/src/light.rs`。

### 5.1 数据与领域划分

- 光照值存于 RawChunk 的 `lights` u32 数组（四通道，见 §3.3）。
- `maxLightLevel` 可配置（经典 15）。
- 世界抽象 `VoxelLightVolume` 提供 `getSunlightAt / setSunlightAt / getTorchLightAt(颜色) / setTorchLightAt`。

### 5.2 floodLight：增量 BFS 洪水填充

签名：`floodLight(world, queue: LightNode[], color, min?, max?)`，`LightNode = { voxel: Coords3, level }`。算法逐条：

1. **范围约束**：传播被限制在 chunk 坐标区间（startCX..endCX 等）和可选的 min/max 包围盒内——光照作业天然按区域拆分。
2. **查询缓存**：`blockCache` / `rotationCache` 两个 Map 缓存已查询方块的透明度/旋转，避免 BFS 反复访问体素数组。
3. **逐节点处理**（head 指针扫描队列，非 shift）：
   - 取源方块的**逐面透明度数组**（6 布尔，随方块旋转旋转）；
   - 对六个邻居：算 `floodLightNextLevel(isSunlight, attenuation, oy, level, maxLightLevel)`——**阳光向下传播不衰减**（`oy` 参与判断），其他方向每格衰减 attenuation+1；彩色光则恒定衰减；
   - `canEnter(sourceTransparency, nTransparency, ox,oy,oz)` 做**面配对**判定（源面透明且邻居对应面透明才进）；
   - 新等级 > 现存值才写入并入队——保证收敛、天然去重。
4. **队列压实**：head 超过 8192 时 `queue.splice(0, head)` 把已处理前缀截掉，长队列只持有活跃边界（内存优化，注释明说与 light worker 的守卫对齐）。

### 5.3 removeLight：反向"收光"BFS

`removeLight(world, voxel, color)`：从被移除的光源出发两阶段扫描——先收集所有"光等级 < 移除路径等级"的受影响体素（把它们清零并入重传播队列），再对这些体素周围的存留光源重新 `floodLight` 补光。这是体素光照的标准解法，Voxelize 的实现与 Luanti 思想一致但细节（旋转透明度、四通道、范围约束）不同。

### 5.4 作业化与 Worker

`LightJob { jobId, color, lightOps: { removals, floods }, boundingBox, startSequenceId, retryCount, batchId }` + `LightBatch` 聚合器——光照改动被打包成**带序号、可重试、按包围盒聚合的作业**，交给 `workers/light-worker.ts` 异步执行，结果回填后按 `modifiedChunks` 通知重网格化。这套"光照即作业"的封装是它区别于 Luanti 同步实现的点。

### 5.5 本地点光阴影（local-lights/，约 3,400 行）

对少量近处彩色点光源做**实时体素阴影**：`clustering.ts` 光源聚类（限制阴影投射器数量）→ `shadow-scheduler.ts` 按重要性动态排程 → 自定义 shader 采样。这是引擎里最重的视觉特性（另有独立的 `light-cones.ts`、`entity-shadow-uniforms.ts`）。

## 6. 方块系统

### 6.1 Registry（客户端 `core/world/registry.ts`）

`blocksByName: Map<string, Block>` + `blocksById: Map<number, Block>` + name↔id 双向映射，`serialize()` 生成可下发/可入库的纯对象。整个注册表由服务器定义、随协议同步到客户端（id 一致性由服务器保证）。

### 6.2 Block 定义（`core/world/block.ts` + Rust `crates/core/src/block.rs`）

方块定义是**富声明式**的：

- `aabbs`：一组碰撞盒（可多个），即"方块外观/碰撞形状"的通用描述（台阶、栅栏都是一个 aabb 列表）；
- `independentFaces` / `isolatedFaces`：独立贴图面/孤立面声明（mesher 据此把它们排除出贪心合并）；
- `rotation` + 逐面透明度数组：随朝向变化的几何/光学属性；
- `lightAttenuation`：每方块光衰减；
- Rust 侧更进一层：`BlockRule` / `BlockSimpleRule` / `BlockRuleLogic` / `BlockConditionalPart` / `BlockDynamicPattern` + `dynamicFn`——**条件部件与动态图案**，用规则描述"按邻居形状自动连接"的方块（栅栏、门框）和动画方块（`Y_ROT_SEGMENTS` 参与旋转分档）。

简言之：Luanti 用 drawtype 枚举 + paramtype2 的"类型学"方案，Voxelize 用"几何规则引擎"方案——表达能力更强，实现和心智成本也更高。

## 7. 物理引擎

`packages/physics-engine/`（约 1,300 行，带 195 行测试）+ `packages/aabb` + `packages/raycast`，三者零依赖。

- **AABB**（`packages/aabb/src/index.ts`）：`class AABB { minX,minY,minZ,maxX,maxY,maxZ }` + width/height/depth getter，标准实体几何原语。
- **sweep.ts（230 行）**：**swept AABB 扫掠碰撞**。`sweepAABB(self, other, vector)` 用 Minkowski 差（把 other 按 self 尺寸膨胀成 `m = other ± size`）+ `lineToPlane`（射线与六个平面求交）算出本帧移动的最早碰撞时间与碰撞轴；`between` 判定交点落在面内。返回碰撞时间/轴/法线，供上层做贴墙滑行。
- **rigid-body.ts**：`RigidBody { position, velocity, width, height, ... , sleepFrameCount }`——**帧数睡眠**（静止若干帧后休眠，受力/施加冲量时唤醒），`applyForce` / `applyImpulse`。
- **index.ts（772 行）**：`Engine` 每帧：积分 → 扫掠逐轴移动 → **自动上台阶**（autostep，`stepHeight` 配置，试抬升后前移再落下，含"危险跌落"检测 `isDangerousDrop` 防止自动走上悬崖）→ 碰撞事件回调 → 清力。

这就是一个"刚好够用的 Minecraft 专用物理引擎"：没有旋转刚体、没有关节——体素世界的正确规模。

## 8. 控制与角色

`packages/core/src/core/controls.ts`（1,951 行）：`RigidControls` 整合 Pointer Lock、键盘输入（`Inputs`）、相机（YXZ 欧拉 + 四元数）、物理刚体（`RigidBody`）、角色外观（`libs/character.ts`，1,307 行，第一/三人称模型与动画）和**手持物品手臂 `Arm`**（走路摆动/挥动）。它实现了 `NetIntercept` 接口——控制器的移动状态直接作为网络消息源（单机场景下这就是本地回环）。挖掘/放置的射线走 `packages/raycast`：对实体用 slab 法 `raycastAABB`，对方块用体素步进。

## 9. 客户端渲染工程

`World` 类（`core/world/index.ts`，6,815 行）**直接继承 three.js 的 `Scene`**——世界本身就是场景图，27 个公开成员管理 chunk 生命周期、注册表、光照作业、实体、天气。渲染相关模块：

- `chunk-renderer.ts` / `chunk.ts`：chunk 几何管理与 three.js 对象池；
- `shaders.ts`（1,365 行）：自定义 shader 片段集合（体素顶点光照、雾、水下）；
- `sky.ts` / `sky-fog.ts` / `clouds.ts`（云在独立 Worker 生成）；
- `water-optics.ts`：水下色调与焦散类效果；
- `csm-renderer.ts`（845 行）：级联阴影贴图（CSM）；
- `pipelines.ts`：材质/管线组织；
- `deferred-block-entity-updates.ts`：方块实体（箱子内容等）延迟更新；
- `loader.ts`：chunk 请求/加载状态机（请求 → 网格化 → 上传 GPU → 就绪）。

## 10. 物品与 UI 库

- `libs/item-slots.ts`（912 行）：`ItemSlot<T>` / `ItemSlots<T>`——物品槽的**完整状态机**：堆叠上限、拆半堆、拖放来源/目标、悬停高亮。纯逻辑，不绑 DOM，前端 UI 只做视图。
- `libs/canvas-box.ts`（849 行）：**把 3D 方块离屏渲染成 2D 图标**——用 three 的 BoxGeometry + CanvasTexture 把方块贴图渲成等距小图，供背包/物品栏 DOM 使用；同时承载实体阴影 uniform 与水下雾 uniform 的创建。

## 11. 世界生成

`crates/gen/`（Rust，约 21,000 行中的大头）。核心思想：**世界生成 = 纯函数阶段管线**（`stages.rs` 的 `install(pipeline, generator)`）：

| 阶段 | 职责 |
|---|---|
| `GenShapeStage` | 基础地形形状（密度场，`density.rs`/`field.rs`） |
| `GenSurfaceStage` | 地表材质铺装（`surface.rs`，按 `climate.rs` 气候选表层） |
| `GenCarveStage` | 雕刻：洞穴/峡谷（`carve.rs`） |
| `RiverStage` | 河流（`rivers.rs`） |
| `GenPopulateStage` | 结构填充（`structures.rs`） |
| `FloraStage` | 植被（`flora.rs`） |

支撑模块：`climate.rs`（温度/湿度场）、`ecology.rs`（生态 → 群系）、`geology/`（地层）、`hydro.rs`（水文）、`noise.rs`、`mosaic.rs`、`lane.rs`、`stream.rs`。生成器由"规格"（`spec.rs`）编译成 `CompiledGenerator` 后跑在管线里——**每个阶段只看前一阶段的输出**，阶段可插拔、可缓存、可并行。

## 12. 网络与协议

- `messages.proto`（136 行）定义全部消息：`Chunk`（体素+光照载荷）、`Mesh`/`Geometry`（网格下发）、`Entity`、`Peer`（玩家）、`Event`、`Method`、`Update` / `BulkUpdate`（增量体素修改）、`ChatMessage`、`Message`（信封）。
- `packages/protocol/` 从 proto 生成 TS 类型；`packages/transport/` 管 WebSocket 连接、重连、通道。
- 服务器 `server/` 用 **specs ECS**（Rust）组织实体与系统（`runtime.rs` 系统调度、`webrtc/` 实验性 WebRTC 数据通道）。
- 客户端 `network/`（979 行）：拦截器模式（`NetIntercept`——World、Controls 等各自声明自己关心/发送的消息），收发 + 插值。
- 客户端可嵌 `packages/agent`——服务端可下发脚本代理（类似 Luanti SSCSM 的方向）。

## 13. 性能工程汇总

| 手段 | 位置 | 解决什么 |
|---|---|---|
| 贪心网格合并（Rust/WASM） | `crates/mesher/greedy.rs` | 顶点数/drawcall |
| 稀疏扫描边界 | 同上 `find_sparse_non_empty_bounds` | 空气区域零开销 |
| 网格/光照/云三类 Worker | `core/world/workers/` | 主线程只渲染 |
| SharedArrayBuffer + 缓冲池 | `raw-chunk.ts`、`chunk-shared-pool.ts` | 跨线程零拷贝 |
| 顶点量化 | `vertex-quantization.ts` | GPU 带宽/内存 |
| 几何 arena | `chunk-region-arenas.ts` | 碎片与分配开销 |
| 内存压力自适应 | `memory-pressure.ts` | 低内存设备自动降质 |
| 区块连通性位 | `connectivity.rs` / `section-visibility.ts` | 避免重复网格化、子区块剔除 |
| 光照作业批处理 + 队列压实 | `lighting.ts` | 大范围光照的内存与延迟 |
| 刚体睡眠 | `physics-engine/rigid-body.ts` | 静止实体零开销 |

## 14. 工程化与测试文化

- **测试贴着源码放**（`*.test.ts` 与被测文件同目录：`raw-chunk.test.ts`、`memory-pressure.test.ts`、`section-visibility.test.ts`、`sky-fog.test.ts`、`water-optics.test.ts`……），Rust 侧 `tests.rs` 内嵌；仓库根还有 `tests/` 集成测试与 `benches/`（灯光/网格/寻路三组 criterion 基准）。
- **两份 AGENTS.md 式文档**：仓库自带 `AGENTS.md` 与 `docs/`——AI 协作友好的工程。
- 发布纪律：客户端逐包发 npm（`@voxelize/*`），服务端发 crates.io，版本同步由 lerna 管；`pnpm-workspace.yaml` + `rust-toolchain.toml` 钉住工具链。
- `tutorial/` 与 `examples/client|server`：最小可运行游戏模板。

---

*基于 `refs/voxelize` v3.0.0 撰写；2026-08-31。*
