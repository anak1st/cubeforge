# 方块定义 — MC 官方结构探查

> 探索目的：搞清 Minecraft 官方从哪些**维度**定义一个方块，作为 `src/core/blocks.ts` 的 `BlockDef` 演进参照。
> 依据：反编译源码 `temp/minecraft-src/`（MC 26.2）。权威文件：`net/minecraft/world/level/block/state/BlockBehaviour.java`、`net/minecraft/world/level/block/Blocks.java`。

## 核心结论

MC 的"方块"是**三类东西叠加**，不是一个简单结构体：

- **定义数据（`BlockBehaviour.Properties`）**：本文件主体，一组属性 + 构建器方法
- **状态（`BlockState`）**：方块附带一组 `stateDefinition` 属性（facing/waterlogged/age…），值组合成千个 `BlockState`；**被世界存储与渲染的最小单元是 BlockState，不是 Block**
- **资源层（JSON/贴图/标签，不在 Java 里）**：`blockstate` JSON、`model` JSON、材质、渲染分层、工具标签、生物群系染色

`refs/minecraft.md` 反复出现的"不可变 flyweight + 注册表 + 数据驱动"模式正是这套：属性属 Block，状态属 BlockState，外观与行为外置为资源。

## Properties 全量维度（按功能归类）

一个个 builder 方法/字段，来源于 `BlockBehaviour.java`（`Properties` 内部类，行 975–1284）：

### 1. 硬度 / 抗性（挖、炸）

| 方法/字段 | 含义 | 说明 |
|---|---|---|
| `destroyTime` | 硬度，挖掘进度**分母** | `getDestroyProgress`：`player.getDestroySpeed / destroySpeed / modifier`；`-1` = 不可破坏（bedrock）；`modifier` 拿对工具=30 否则=100 |
| `explosionResistance` | 抗爆值 | `explosionResistance(x)` 会 `max(0, x)` 钳制 |
| `requiresCorrectToolForDrops` | 需正确工具才掉落 | 如 stone |
| `instabreak()` | 瞬破 | `strength(0.0F)` |

> 工具能否采/效率倍率在**外部** `minecraft:mineable/pickaxe` 等 `BlockTag` + Item 工具速度表，不在方块 Properties 里。

### 2. 碰撞 / 固体性

| 方法/字段 | 含义 |
|---|---|
| `hasCollision` / `noCollision()` | 是否参与碰撞（`noCollision` 同时把 `canOcclude` 置 false） |
| `forceSolidOn/Off` | 强制/解除"固体"判定 |

> 具体碰撞形状是 **VoxelShape**，由 `Block.getShape / getCollisionShape` 重写（物理层，独立于 Properties）。

### 3. 渲染 / 遮挡 / 视觉

| 方法/字段 | 含义 |
|---|---|
| `canOcclude` / `noOcclusion()` | 是否**遮挡相邻面**（**面剔除**依据） |
| `isViewBlocking` | 渲染时是否挡视线 |
| `emissiveRendering` | 是否自发光渲染 |
| `lightEmission` | 发光 0..15（`ToIntFunction<BlockState>`） |
| `mapColor` | 小地图/羊剪毛贴图上色 |
| `offsetType` | 草/花的随机视觉偏移 |
| `postProcess` | 贴图后处理 |
| `dynamicShape` | 动态碰撞形状标记 |

### 4. 音效 / 手感

| 方法/字段 | 含义 |
|---|---|
| `sound` / `SoundType` | 挖/放/踩的音效组 |
| `friction` | 摩擦力（默认 0.6；冰≈0.989） |
| `speedFactor` | 行走速度倍率（灵魂沙 0.4） |
| `jumpFactor` | 跳跃速度倍率 |
| `bounceRestitution` | 弹跳恢复系数（史莱姆块） |

### 5. 行为 / 逻辑

| 方法/字段 | 含义 |
|---|---|
| `isRandomlyTicking` / `randomTicks()` | 是否随机 tick（草/岩浆株） |
| `ignitedByLava` | 是否被岩浆点燃（树叶/木板） |
| `isAir` | 是否为空气 |
| `isRedstoneConductor` | 是否传导红石 |
| `isValidSpawn` | 实体能否在其上生成 |
| `isSuffocating` | 是否窒息（填满碰撞盒） |
| `pushReaction` | 活塞推动反应（NORMAL/BLOCK/MOVE/DESTROY） |
| `replaceable` | 是否可被替换（水/雪/草） |

### 6. 掉落 / 经济

| 方法/字段 | 含义 |
|---|---|
| `drops` | 战利品表（默认 `blocks/<id>`） |
| `noLootTable()` / `overrideLootTable` | 无掉落 / 覆盖掉落表 |

### 7. 注册 / 元数据

| 方法/字段 | 含义 |
|---|---|
| `id` / `ResourceKey` | 注册 id |
| `descriptionId` | 本地化描述 |
| `requiredFeatures` | 需要哪些实验特性 |
| `instrument` | 音符盒乐器 |
| `spawnTerrainParticles` | 是否生成破坏粒子 |

## 官方各方块的实际数值（Blocks.java 注册处）

| 方块 | destroyTime(硬度) | explosionResistance | 关键属性 |
|---|---|---|---|
| stone (`:57`) | 1.5 | 6.0 | `requiresCorrectToolForDrops` |
| grass_block (`:84`) | 0.6 | 0.6 | `randomTicks` |
| dirt (`:86`) | 0.5 | 0.5 | — |
| sand (`:313`) | 0.5 | 0.5 | mapColor SAND |
| oak_leaves (`:565`, `leavesProperties:5762`) | 0.2 | 0.2 | `noOcclusion`、非 suffocating/viewBlocking/redstoneConductor、`ignitedByLava` |
| water (`:285`) | 100.0 | (flow) | 流体 `LiquidBlock`、`noCollision`、`replaceable` |

> `strength(a)` = `strength(a, a)`（同值）；`strength(a, b)` 分开设。MC 未用单独的 `transparent` 布尔——它用一组正交谓词（`canOcclude`/`isViewBlocking`/`isSuffocating`/`isRedstoneConductor`）表达近似语义。

## 对 blocks.ts 的映射

| 我们 `BlockProperties` | 对应 MC | 现状 |
|---|---|---|
| `hasCollision` | `Properties.hasCollision` | 单布尔，够用（MC 另有 VoxelShape） |
| `canOcclude` | `Properties.canOcclude`（渲染遮挡） | 单布尔，可行（树叶/walkable 与 occlude 是两个正交维度，我们目前用两布尔恰好能表达 leaves=碰撞+透剔） |
| `destroyTime` | `Properties.destroyTime` | **数值已对齐 MC**（stone 1.5 / grass 0.6 / dirt 0.5 / sand 0.5 / leaves 0.2 / water 负数） |
| — | `explosionResistance` | 未建（M6 后按需） |
| — | 贴图/model 资源、tile 映射 | 目前在 `core/mesher.ts` 的 `tileFor` 硬编码，未进 BlockDef |

## 演进建议

- **按需扩展**，避免一次到位：M3 加"贴图资源/渲染层"维度；M5 加 VoxelShape（碰撞）；M6 加 `lightEmission` 与遮挡细节。
- **已落地命名对齐**：`blocks.ts` 的 `BlockDef`→`BlockProperties`，字段 `solid/transparent/hardness`→`hasCollision/canOcclude/destroyTime`，`destroyTime` 数值对齐 MC 官方。
- 长期，若方块种类变多可考虑引入 `BlockState` 属性系统（M8+ 物品/状态化方块时）。

## 关联

- `src/core/blocks.ts`（现行最小注册表）
- `docs/refs/minecraft.md` §5/§9（存储分层、注册表模式）
- `docs/refs/luanti.md` §5.1（`NodeDefManager`，Luanti 侧的等价设计）
