# Minecraft 官方代码 · 结构与机制分析

> **来源**：Mojang 官方 `client.jar` **26.2**（2025-10 官方公告后的无混淆版本，保留原始命名与变量名），Vineflower 1.12.0 反编译。
> **生成**：`scripts/fetch-mc-src.{ps1,sh}`（无参数，下载经 SHA1 校验）；产物在 `temp/minecraft-src/`，gitignore 不入库，删除后重跑脚本即可再生。
> **授权**：© Mojang Studios / Microsoft。EULA 允许阅读学习、禁止再分发——勿入库、勿拷贝代码。
> **阅读方式**：本文按子系统组织，每节先讲结构再讲机制；引用的类名、常量均经源码核实，路径均相对 `temp/minecraft-src/`。

---

## 1. 总览

约 7000 个 .java 文件。**一个 jar 同时包含客户端与服务端**（单机游戏的"内置服务端"模式：游戏逻辑只在服务端路径上跑，客户端是渲染终端）。顶层包结构：

| 包 | 职责 |
|---|---|
| `net/minecraft/world/` | 游戏机制主体：`level/`（世界、chunk、光照、方块）、`entity/`（实体与玩家）、`item/`、`phys/`（数学与形状）、`biome/` |
| `net/minecraft/client/` | 渲染、输入、客户端专属逻辑（`renderer/chunk/` 是 chunk 网格化） |
| `net/minecraft/server/` | 服务端：`MinecraftServer` 主循环、level/server 网络 |
| `net/minecraft/nbt/`、`network/`、`resources/`、`core/`（注册表）、`util/` | 支撑系统 |
| `commands/`、`advancements/`、`stats/`、`sounds/`、`realms/`、`gametest/` | 玩法与运维外围 |

---

## 2. 世界数据模型：Level → LevelChunk → Section → PalettedContainer

四层嵌套，逐层收窄：

```
Level（世界；实现为 ServerLevel / ClientLevel 双面）
 └─ LevelChunk（16×H×16 的柱，H 按维度可配；主世界 Y −64..319 = 24 个 section）
     └─ LevelChunkSection（16³ 立方，217 行，一份 chunk 垂直切分的存储单元）
         ├─ PalettedContainer<BlockState>   方块状态容器
         └─ PalettedContainerRO<Holder<Biome>>  生物群系容器（4×4×4 粗粒度，独立存储）
```

**PalettedContainer（342 行）是存储的核心**：section 内不存方块状态的完整引用，而是存"调色板索引"——数据数组每格只占几 bit，指向一张 section 内实际用到的状态小表。调色板按内容在四种实现间升级（`chunk/` 目录下各一个文件）：

1. `SingleValuePalette`——整个 section 是同一种方块（如全空气），零数据数组；
2. `LinearPalette`——种类少，线性查找；
3. `HashMapPalette`——种类多，哈希查找；
4. `GlobalPalette`——退化成全局 id 直存（等价于裸数组）。

策略选择由 `Strategy` 与 `PalettedContainerFactory` 统一配置（默认方块 = air，默认生物群系 = plains），序列化走 Codec。section 数量、Y 范围由维度配置推导（`LevelHeightAccessor.getSectionsCount()`），并非硬编码。

---

## 3. 方块、状态与注册表

- **`Blocks.java`（约 5900 行）**是全部方块的静态注册表：`public static final Block STONE = register(...)`，每个方块一个常量；属性用链式 `BlockBehaviour.Properties` 声明（如 air 的 `.replaceable().noCollision().noLootTable()`）。注册发生在类加载期，写入全局 `Registry`（`core/registries/`）。
- **BlockState 是不可变 flyweight**：`Block` + 一组属性（朝向、含水、开关…）的组合在 `Block.BLOCK_STATE_REGISTRY` 里全局去重，每种状态全游戏仅一个实例。因此 chunk 容器里"存什么"本质是小整数索引——这正是调色板压缩能成立的前提。
- 行为与数据分离：行为在 `Block` 子类的方法（`randomTick`/`use`/`tick`…），数据在 `Properties` 与 `StateDefinition`（属性定义）。

---

## 4. 光照

`world/level/lighting/` 共 15 个文件，要点：

- **光值 0..15**（`LightEngine.MAX_LEVEL = 15`）；**双通道**：天空光与方块光各自独立存储、独立传播，使用时合并。
- **存储**：每个 section 一张 `DataLayer`（`world/level/chunk/DataLayer.java`），**4-bit nibble 打包**——`data[pos] >> 4 * nibble & 15`，一字节存两个光值，每 section 光照数据仅 2KB。
- **传播**：`LightEngine` 是通用 BFS 引擎，配合 `LeveledPriorityQueue` 与 `DynamicGraphMinFixedPoint` 做**增量**传播——放/移光源只重算受影响区域，不做全量重铺。
- `SkyLightEngine` 专管天空光的特殊规则（竖直向下无衰减的柱状传播），`ChunkSkyLightSources` 缓存每个柱的天光起点；`LayerLightSectionStorage` 管理跨 section 的数据与边界邻接查询。

---

## 5. 形状、物理与射线

- **`world/phys/shapes/`（20 个文件）**：`VoxelShape` 把方块碰撞体表达为离散体素位图（`DiscreteVoxelShape` 及其数组/位集实现），再投影成 AABB 列表参与运算；布尔运算（`BooleanOp`）、切片（`SliceShape`）、合并器（`IndexMerger` 家族）支撑形状求交。
- **实体碰撞**：实体持 `AABB`；`Entity.move(MoverType, Vec3)` → `collide(movement)` → `collideBoundingBox(...)` → `collideWithShapes(Vec3, AABB, List<VoxelShape>)`：分轴扫掠，逐轴裁剪位移到不穿模为止。
- **射线**：`BlockGetter.clip(ClipContext)` → `traverseBlocks` 体素步进（Amanatides-Woo 式 DDA），返回 `BlockHitResult`（命中方块坐标 + 命中面方向）。`ClipContext` 可指定命中时用哪种形状（碰撞/视觉/流体）；`clipWithInteractionOverride` 允许交互目标用与碰撞不同的形状。

---

## 6. 客户端渲染：section 编译

`client/renderer/chunk/` 的流水线：

1. `SectionRenderDispatcher` 排队调度 section 的网格编译（独立于主线程的渲染帧）；
2. `SectionCompiler` 编译单个 section：遍历方块 → 邻接面剔除 → 按 `ChunkSectionLayer`（不透明/剪切/半透明等）分桶 → 产出 `CompiledSectionMesh`；
3. `VisGraph` + `VisibilitySet` 做 section **内部**的遮挡面剔除；`ChunkSectionsToRender` 管 section 间可见性，`TranslucencyPointOfView` 处理半透明排序；
4. 方块外观不是硬编码：`BlockState` → blockstate/model JSON 定义 → 烘焙为 `BakedModel`；颜色走 colormap 贴图 + `ColorResolver`（见 §8）。

---

## 7. 生成与流式加载

`world/level/chunk/status/` 把"一个 chunk 从无到全量"建模成**状态阶梯**：

- `ChunkStatus` 定义等级（空 → 结构 → 地形 → 表面 → 光照 → 全量），`ChunkStep`/`ChunkPyramid`/`ChunkDependencies` 声明每级的前置依赖与工作量；
- `ProtoChunk` 是生成中的半成品块，逐级升级为 `LevelChunk`；`ImposterProtoChunk` 提供只读包装；`EmptyLevelChunk` 是占位；
- `ChunkSource` 是"给我 chunk"的统一入口，按需触发生成或从存储取回；`WorldGenContext` 捆绑生成所需的上下文以便线程分派。

---

## 8. 生物群系与方块染色

- 生物群系 `Biome` 携带气候参数（温度/降水/衍生色），按 4×4×4 粒度存于每个 section 的独立容器；
- **染色发生在客户端**：`client/renderer/BiomeColors.java` 提供 `GRASS_COLOR_RESOLVER` 等 resolver，渲染时按方块所在位置的生物群系实时取色；`client/color/`（`ColorLerper`、`block/`、`item/`）管理方块/物品颜色的注册与插值；
- 灰度贴图 + 色表（colormap PNG，横轴温度纵轴降水）是草/树叶的基础着色方案：一张贴图 + 一次查表 = 所有气候变体。

---

## 9. 反复出现的设计模式

1. **不可变 flyweight**：BlockState 全局去重，"引用即索引"，一切容器/序列化因此可以按整数压缩；
2. **调色板压缩**：数据存索引不存值，配合状态去重，存储体积与内容复杂度解耦；
3. **惰性 + 区域化**：光照增量传播、渲染按 section 编译、生成按 status 阶梯升级——没有任何子系统做全量重算；
4. **注册表 + 数据驱动**：方块/物品/生物群系都是"启动期注册 id → 运行期查表"，外观（模型/贴图）外置为资源 JSON/PNG；
5. **双端同构**：同一套 `world/` 代码同时服务服务端（权威模拟）与客户端（预测渲染），差异隔离在 `client/`/`server/` 包内。

---

## 10. 术语速查

| 术语 | 含义 |
|---|---|
| Level | 世界（服务端 ServerLevel / 客户端 ClientLevel 双实现） |
| LevelChunk | 16×H×16 的柱状 chunk，H 由维度决定 |
| Section（LevelChunkSection） | 16³ 立方，chunk 的垂直切分与最小存储/渲染/光照单元 |
| BlockState | 方块状态 flyweight（Block + 属性组合，全局唯一实例） |
| PalettedContainer | 调色板压缩容器（四种 palette 策略自动升级） |
| DataLayer | 4-bit 打包的光值字节数组（2048B/section） |
| VoxelShape | 离散体素位图表达的方块形状 |
| ChunkStatus / ProtoChunk | 生成阶梯 / 阶梯上的半成品块 |
| ClipContext / BlockHitResult | 射线请求（含形状选择）/ 命中结果（坐标+面方向） |
