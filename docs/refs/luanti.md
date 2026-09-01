# Luanti（原 Minetest）源码深度分析

> **上游**：<https://github.com/luanti-org/luanti>（原名 Minetest）· 代码授权 LGPL 2.1+
> **本地源码**：`refs/luanti`（只读，`scripts/fetch-refs.sh` 浅克隆获取）；记录时点 `bd2bda6`（2026-08-31）
>
> **目的**：这是一份"怎么写一款类 Minecraft（MC）游戏"的工程参考。以 Luanti 引擎源码（`refs/luanti`，下文路径均相对于该目录）为蓝本，拆解一款体素游戏需要的每一个子系统：渲染、方块、地图/世界、光照、角色、物理、物品、实体、网络、存档、主界面、脚本化内容。文中所有类名、常量、文件路径都经过源码核实，可以直接对照阅读。
>
> **阅读方式**：每一节先讲"这个子系统要解决什么问题"，再讲"Luanti 怎么做的"，最后给"自己写时的要点/坑"。文末附路线图与关键文件索引。

---

## 目录

1. [全景：一款 MC 由什么组成](#1-全景一款-mc-由什么组成)
2. [引擎与内容分离（最重要的架构决策）](#2-引擎与内容分离)
3. [世界的数据模型：Node → MapBlock → Map](#3-世界的数据模型)
4. [地图生成：噪声、生物群系与 Emerge 线程](#4-地图生成)
5. [方块系统：注册表 + drawtype](#5-方块系统)
6. [渲染管线：从 MapBlock 到屏幕](#6-渲染管线)
7. [光照系统](#7-光照系统)
8. [角色、物理与碰撞](#8-角色物理与碰撞)
9. [交互：射线拾取、挖掘与放置](#9-交互)
10. [物品、库存与合成](#10-物品库存与合成)
11. [实体系统：ActiveObject](#11-实体系统)
12. [网络与多人](#12-网络与多人)
13. [存档与持久化](#13-存档与持久化)
14. [UI：主菜单、HUD 与 Formspec](#14-ui主菜单hud-与-formspec)
15. [音频与粒子](#15-音频与粒子)
16. [脚本系统与内容管线](#16-脚本系统与内容管线)
17. [服务端世界模拟](#17-服务端世界模拟)
18. [线程与性能工程](#18-线程与性能工程)
19. [从零写一款 MC 的路线图](#19-从零写一款-mc-的路线图)
20. [关键文件索引与术语对照](#20-关键文件索引与术语对照)
21. [附录：Minetest Game 内容包](#21-附录minetest-game-内容包)

---

## 1. 全景：一款 MC 由什么组成

拆掉所有玩法外壳，一款体素游戏本质上是这些东西的组合：

| 子系统 | 核心问题 | Luanti 对应 |
|---|---|---|
| 世界数据 | 无限世界怎么存？用多小的块切？ | `MapNode` / `MapBlock` / `Map` |
| 地图生成 | 玩家走到没去过的地方，地形从哪来？ | `src/mapgen/` + `EmergeManager` |
| 渲染 | 几百万个方块，怎么只画看得见的？ | 逐 MapBlock 网格化 + 面剔除 |
| 光照 | 阳光/火把光怎么在方块间传播？ | 0–14 级光值 + BFS 洪水填充 |
| 物理 | 玩家怎么走路、跳跃、不穿墙？ | AABB 碰撞 + 移动参数 |
| 交互 | 怎么知道准星指着哪个方块？ | DDA 体素射线 |
| 物品/库存 | 64 个石头叠一格，怎么表示？ | `ItemStack` + Inventory 列表 |
| 合成 | 3×3 摆配方 → 产出 | `CraftDefinition*` |
| 实体 | 掉落物、箭、生物是什么？ | ActiveObject (SAO/CAO) |
| 网络 | 多人怎么同步世界？ | 自研 UDP 协议 v53，服务器权威 |
| 存档 | 关掉游戏世界去哪了？ | SQLite 中按 MapBlock 存二进制块 |
| UI | 主菜单、物品栏、血条 | 主菜单 = 另一个 Lua 程序；HUD 内建 |
| 内容 | 玩法从哪来？ | Lua mod（全部在服务器端运行） |

代码规模参考：`src/server.cpp` 约 4500 行、`src/client/game.cpp` 约 3800 行、网格生成器 `src/client/content_mapblock.cpp` 约 1900 行——核心逻辑是 C++（约 30 万行），而全部默认玩法（Minetest Game 的 34 个 mod）都是 Lua。

**关键技术选型**（供自研参考）：

- 语言：C++17 内核 + Lua 5.1/LuaJIT 脚本层，CMake 构建
- 渲染：IrrlichtMt（自维护的 Irrlicht 分支，`irr/` 目录内置编译），后端 OpenGL / OpenGL 3 / OpenGL ES 2，窗口输入用 SDL2
- 压缩：zlib / zstd；数据库：SQLite3（默认，另有 LevelDB/PostgreSQL/Redis）
- 音频：OpenAL + Ogg Vorbis；字体：FreeType；网络：自研 UDP 协议（curl 只用于 HTTP 下载）

---

## 2. 引擎与内容分离

Luanti 最重要的架构决策：**引擎零内容**。仓库里没有"石头""树"，只有一个用来测试引擎功能的 `games/devtest`。一个"游戏"（game）仅仅是：

```
games/<gameid>/
├── game.conf        # 标题、最低引擎版本等元信息
├── minetest.conf    # game 级默认设置
├── menu/            # 主菜单背景
└── mods/            # 一堆普通 Lua mod（Minetest Game 有 34 个）
    ├── default/     # 定义石头、泥土、树、水……含 241 张材质 PNG
    ├── doors/ stairs/ tnt/ farming/ ...
```

即 **game = 一捆 mod + 一份配置 + 一张菜单背景**。引擎启动时扫描所有含 `game.conf` 的目录列在主菜单里；创建世界时选一个 game，存档绑定它；玩家还可以在世界里叠加任意第三方 mod。

这个分离带来的直接好处，自己写 MC 时同样适用：

1. **数据和逻辑的归属清晰**：C++ 引擎只管"世界由方块组成、方块有定义"，至于"石头挖掉掉圆石"是内容层的事。
2. **天然的内容生态**：mod/游戏可以独立分发（Luanti 有 ContentDB 内容平台），换材质包不改代码。
3. **测试方便**：引擎改动可以用一个空 game 验证，不被玩法干扰。

类比：引擎 ≈ 游戏机，game ≈ 卡带，mod ≈ DLC，材质包 ≈ 换皮。

---

## 3. 世界的数据模型

### 3.1 最小单元：MapNode（2 字节 + 2 字节参数）

`src/mapnode.h`——Luanti 不叫 block（避免和 MapBlock 混淆），叫 **node**。一个方块就是 4 字节：

```cpp
struct alignas(u32) MapNode {
    u16 param0;  // content id：方块种类，查全局注册表得到名字（air、default:stone…）
    u8  param1;  // 通常存光照：低 4 位 = 夜间光，高 4 位 = 白天光（0..14，阳光=15）
    u8  param2;  // 语义随方块定义变化：朝向、液面高度、调色板索引等
};
```

16 位 content id 意味着全世界最多 65536 种方块（足够）。**"种类→数字"的映射表（NameIdMapping）随存档一起保存**，这样不同 mod 集合的世界也能正确读出。`param1/param2` 是经典的"通用参数槽"设计：渲染/光照用 param1，方向等状态用 param2，每种 drawtype 自己解释（见 §5.3）。

> 自己写时：**别给方块写子类**。一个数字 id + 两个参数位，配合"定义表"解释参数，是把百万级方块塞进内存的唯一办法。16³=4096 方块的 chunk 只需 16 KB 节点数据。

### 3.2 中层单元：MapBlock（16×16×16）

`src/constants.h:64` 定义 `MAP_BLOCKSIZE 16`。16³ = 4096 节点，每块：

- `data`：4096 个 MapNode（16 KB）
- `m_node_metadata`：带箱子/文本/库存的方块元数据（按坐标索引）
- `m_static_objects`：被"冻结"进存档的实体（如掉在地上的物品）
- 时间戳、生成标志等

序列化格式（`doc/world_format.md`）：整块序列化后 **zstd 压缩**（格式版本 ≥29，之前 zlib），头部有 4 个关键标志位：

- `is_underground`：上方没有遮挡时阳光可以直接照下来（省一次光照计算）
- `day_night_differs`：昼夜光照是否不同——只有置位的块才需要在昼夜切换时重新上传网格
- `lighting_complete`：12 个方向位，标记块边界光照是否已算完（块没加载全时光照先欠着，之后补算）
- `generated`：地形是否已生成过（跨地图生成器版本升级时用）

### 3.3 上层：Map 与坐标

`src/map.h`：`Map` 是 MapBlock 的容器（按 block 坐标哈希），客户端侧的 `ClientMap` 同时还是一个 Irrlicht 场景节点，负责把可见的块画出来（见 §6）。坐标分三层，写代码时极易搞混，Luanti 的做法是各用独立类型：

| 层级 | 类型 | 范围 | 例子 |
|---|---|---|---|
| 节点坐标 | `v3s16` | 整数，世界格 | `(1234, 64, -87)` |
| 块坐标 | `v3s16` | 节点坐标 >> 4 | `(77, 4, -6)` |
| 块内坐标 | `v3s16` | 0..15 | 节点 & 15 |

### 3.4 世界 ≠ 内存里那点东西

世界是"无限"的：内存里只保留玩家附近的块（超出视距就卸载，脏块写回数据库），玩家移动时按需把新块 *emerge*（见 §4）。`VoxelManipulator`（`src/voxel.h`）是一次性把一片矩形区域拉进内存的"速写本"，地图生成和批量编辑都用它，避免逐点查询 Map 的开销。

---

## 4. 地图生成

### 4.1 Emerge：按需生成流水线

`src/emerge.h/cpp`。客户端/服务器发现"视野里有个块既不在内存也不在库"时，不自己算，而是丢给 **EmergeManager** 排队，由若干 **EmergeThread**（设置 `num_emerge_threads`，默认 0 = 按 CPU 核数自动）并行处理：

```
请求队列 ──▶ EmergeThread × N ──▶ 1. 从数据库读（存在）
                              ├─ 2. 没有则调 Mapgen 生成地形
                              ├─ 3. 装饰（树/矿/洞穴可能跨块，先"预留"邻块）
                              ├─ 4. 光照传播（含跨块补算，lighting_complete 位）
                              └─ 5. 写库 + 发给客户端 + 通知邻块重新网格化
```

两个值得抄的细节：

- **跨块生成**：树、洞穴会跨越 16³ 边界。Luanti 的做法是生成时把邻块区域也纳入临时 `MMVManip`，邻块若未生成则预留（`generated=false` 的块允许存"邻居伸进来的树枝"），保证多次生成的接缝一致。
- **生成与光照解耦**：块可以带着"光照未完成"标志先发给客户端，客户端先把地形显示出来，光照后台补。

### 4.2 生成器家族与内容生成原语

`src/mapgen/`：内建 8 种生成器（`singlenode` 纯空、`v5/v6/v7` 三代经典、`flat` 平原、`valleys`、`carpathian`、`fractal`），它们共享一批"原语"模块：

| 模块 | 职责 |
|---|---|
| `src/noise.h`（`NoiseParams`/`Noise`） | Perlin 等噪声，参数化（频率、倍频、持久度），地图生成的一切高度/温度/湿度都来自它 |
| `mg_biome.cpp` | 生物群系：按温度/湿度噪声选群系，定义地表/地下/河床节点 |
| `mg_ore.cpp` | 矿物：按噪声/随机散布矿簇，可限定深度与群系 |
| `mg_decoration.cpp` | 装饰物：把 schematic（小结构，如树、仙人掌）按密度撒到地表 |
| `mg_schematic.cpp` | 结构模板：节点矩阵 + 概率 + 旋转 |
| `cavegen/dungeongen/treegen` | 洞穴、地牢、树的专业算法 |

生成器全部参数（种子、噪声参数、群系表）由 Lua 侧注册/配置（`core.register_mapgen_script`、biome/ore/decoration 的 register API），C++ 只认参数对象——**内容层可以完全自定义地形**，包括换掉整个生成器逻辑（on_generated 回调直接改 VoxelManip）。

> 自己写时：先把 `singlenode` + 手放方块跑通，再上"2D 高度图噪声"（最简单可玩的生成器 v5 思路），洞穴和 3D 噪声放后面。种子一定要显式管理，保证同种子同世界。

---

## 5. 方块系统

### 5.1 注册表模式（整个引擎的骨架）

C++ 不认识"石头"，只认识 u16 id。所有方块种类在**启动时**由 Lua 注册，流程：

```
服务器启动
  → 加载 game 的 mods/（按 depends 拓扑排序）
  → 每个 mod 的 init.lua 调 core.register_node("default:stone", {...})
  → builtin/game/register.lua 归一化参数（builtin/ 可覆盖任意注册函数）
  → 走 C++ 绑定（src/script/lua_api/l_nodetimer… l_nodedef.cpp）
  → NodeDefManager 顺序分配 content id，保存全部 ContentFeatures
  → 定义序列化成一包，发给每个连接的客户端（客户端本地也建一份）
  → 之后网络上传的块里只有 u16 id，体积恒定
```

`NodeDefManager`（`src/nodedef.h/cpp`）就是全局查找表：id ↔ 名字、以及每种方块的 `ContentFeatures`（drawtype、贴图、硬度、是否透光、可燃、liquid 属性、碰撞盒、回调 id…）。运行时热点路径（网格生成、光照、碰撞）全部只查这个数组的 id 下标，**没有虚调用**。

> 自己写时：这是 Luanti 最值得复刻的模式——**"数据驱动的方块定义 + id 查表"**。它让你可以在不碰 C++ 的情况下加 1000 种方块。

### 5.2 方块定义长什么样

```lua
core.register_node("default:stone", {
    description = "Stone",              -- 显示名（物品栏里）
    tiles = {"default_stone.png"},      -- 材质，按 +Y,-Y,+X,-X,+Z,-Z 六面，可只给一张
    groups = {cracky = 3},              -- 标签：挖掘工具类型与等级、可燃等
    drop = "default:cobble",            -- 挖掉掉什么（掉落物系统）
    sounds = ...,
})
```

### 5.3 drawtype：一类方块一种画法

`src/nodedef.h:181` 的 `NodeDrawType` 是渲染多样性的全部秘密。同一份"方块数据"，按 drawtype 生成完全不同的网格：

| drawtype | 用途 | 备注 |
|---|---|---|
| `normal` | 实心方块 | 默认；相邻同类面剔除 |
| `airlike` | 空气 | 不画 |
| `liquid` / `flowingliquid` | 水源/流动水 | 与同类相邻不画面；flowing 用 param2 存液面高度，顶面随高度起伏 |
| `glasslike` / `glasslike_framed` | 玻璃 | 相邻玻璃之间不画面 / 边框+液体分三张贴图 |
| `allfaces(_optional)` | 树叶 | 全部面都画（透明纹理） |
| `torchlike` / `signlike` | 火把/牌 | 单张贴图立/贴在面上 |
| `plantlike` | 花草 | 交叉双面片，param2 的 meshoptions 可变高度/随机偏移 |
| `fencelike` / `raillike` | 栅栏/铁轨 | 按邻居自动连接 |
| `nodebox` | 台阶、楼梯、自定义 | **Lua 里定义若干长方体盒子**（可旋转），服务端不下发几何，客户端按预置形状拼 |
| `mesh` | 复杂模型 | mod 自带 .obj/.b3d/.gltf 模型文件（gltf 用内置 tiniergltf 解析） |
| `plantlike_rooted` | 水草 | 底部实心 + 顶部植物 |
| `firelike` | 火 | 微旋转面片 |

再加 `paramtype2`（`facedir` 朝向 / `wallmounted` 挂墙 / `liquid` / `meshoptions` / `color` 调色板…）决定 param2 的解释方式，组合出整个视觉世界。**额外几何（箱子、楼梯）全部是"从参数推导的网格"，不是每方块存顶点**。

### 5.4 节点元数据与定时器

- `NodeMetadata`（`src/nodemetadata.h`）：需要存"数据"的方块（箱子里的库存、告示牌文字、机器的状态机）不能塞进 4 字节，单独存键值对 + 可选库存列表，随块序列化。
- Node Timer：块内每个节点可挂定时器（到期时间 + 到期时长），块激活时恢复——机器加工"过 5 秒出成品"就用它，不必每帧轮询。

---

## 6. 渲染管线

渲染的核心矛盾：**世界无限，显存和 drawcall 有限**。Luanti 的答案是把渲染单元对齐到 MapBlock：一块一张网格（IBO/VBO），按距离/可见性调度。

### 6.1 网格生成（离线式，不在渲染线程）

`src/client/content_mapblock.cpp`（`MapblockMeshGenerator`，约 1900 行）：

1. 取出本块 + 周围一圈块的数据快照（`MeshMakeData`），交给**独立线程**（`MeshUpdateManager`，`src/client/mesh_generator_thread.h`）排队处理——网格化比渲染慢得多，绝不能卡主线程。
2. 逐节点遍历：查 `NodeDefManager` 得 drawtype → 决定拓扑：
   - 面剔除：实心方块的相邻面不生成；玻璃/树叶有自己的"相邻同类不画面"规则
   - `nodebox`/`mesh` 类按定义拼盒子或加载静态模型
   - 流体做顶面高度插值，让水面有坡度
3. 每个四边形顶点写入：位置、UV（来自纹理图集，见下）、**顶点光照**（param1 的光值 → 亮度 + 平滑光照/环境光遮蔽，取相邻 4 块光值平均），按材质（不透明/半透明/植物双面…）分桶到不同 `TileLayer`。
4. 产出 `MapBlockMesh`，主线程异步换上来，同时把"昼夜不同"的块标记出来。

**没有 greedy meshing**：Luanti 逐面生成四边形。原因是要支持每面独立贴图、overlay、平滑光照渐变——合并会破坏这些。代价是顶点数偏高，收益是生成器简单、效果丰富；对自研者这是个真实的取舍点（MC 现代版同样基本放弃了贪心合并，改用分层渲染）。

### 6.2 纹理管线

`src/client/texturesource.cpp` + `tile.h`：

- **纹理图集**：所有用到的 PNG 合成到少量大图集纹理，网格 UV 指向图集内偏移——几十个小贴图合成一张，drawcall 与纹理切换开销骤降。
- **纹理修饰符**：文件名后缀即管线，如 `stone.png^[colorize:#f00:100`（染色）、`^[combine`（拼接）、`^[opacity`……在加载时离线合成进图集。材质包、程序化贴图都靠它，运行时零成本。
- 服务器会把 mod 的媒体文件（PNG/OGG/模型）**打包下发**给客户端（见 §12.3），所以客户端不需要预装任何 mod。

### 6.3 画出来

`src/client/clientmap.h`（`ClientMap::renderMap`）：

1. 视锥剔除：从相机所在块开始，按块坐标遍历视野内块，跳过视锥外/未加载块（用 `occlusion`/距离排序）。
2. 按距离排序后分 pass 渲染：先不透明，再半透明（水/玻璃，需排序），植物等双面材质单独 pass。
3. 支持动态阴影（`renderMapShadows`，映射到 shadow map）。
4. 昼夜切换：只重传 `day_night_differs` 块的顶点光照。

其余视觉元素各有专职类：`camera.cpp`（FOV/第三人称/手持视图）、`sky.cpp`（天空盒/日落色）、`clouds.cpp`、雾（Irrlicht 雾参数随昼夜调整）、`wieldmesh.cpp`（右手手持物品/方块，方块就地用网格生成器缩小渲染）、`hud.cpp`（十字准星/物品栏/血条/氧气泡，支持自定义 HUD 元素）、选中框 + 挖掘裂纹（`crack_anylength.png` 序列帧按挖掘进度换 UV）。

> 自己写时：**第一版渲染循环** = 每块一张 mesh + 相邻面剔除 + 一张图集 + 顶点光照。视锥剔除和后台网格线程是第二优先级。把"网格生成"设计成`输入=块数据快照、输出=顶点缓冲`的纯函数，以后所有优化（异步、增量、LOD）都在这层做。

---

## 7. 光照系统

MC 式体素光照是这类游戏最"算法味"的部分，Luanti 的实现非常完整（`src/light.h`、`src/map.cpp` 光照传播部分）：

1. **两个通道**：白天光和夜间光各 4 位，都存进 param1（低 4 位夜、高 4 位昼）。这样"火把在白天和晚上的亮度差"不用改数据——渲染时按昼夜系数分别乘再取 max。
2. **0..14 + 阳光位**：`LIGHT_MAX=14`，`LIGHT_SUN=15` 是特权值，表示"这是直射阳光，无衰减地垂直向下传播直到撞到不透明方块"（地下标记 `is_underground` 可直接判定柱状阳光，省计算）。其他光源从 14 开始每格衰减 1。
3. **BFS 洪水填充**：放一个光源 = 光源入队，向六邻扩散，亮度不增则停；挖掉遮挡/移除光源 = 反向"光去哪了"也要 BFS 收割再重铺。跨 MapBlock 边界时把邻块也纳入队列（对应存档里 `lighting_complete` 的 12 方向补算位）。
4. **昼夜系数**：游戏时间 0..24000（正午 12000），`daynightratio.h` 查表得 0..1000 的光照系数，着色时 `亮度 = max(天光×昼夜系数, 块光×系数)`。
5. 平滑光照/顶点 AO 是网格化时对相邻 8 块光值平均得到的，不改数据只改顶点色。

> 自己写时：先做"单通道 0..15 + 阳光柱 + BFS"，双通道白天/夜间分离是体验飞跃但算法翻倍，放第二步。**光照更新永远是惰性+区域化**：只更新受影响的块，绝不全局重算。

---

## 8. 角色、物理与碰撞

### 8.1 玩家的四个化身

Luanti 里"玩家"有四个类，职责分得极清（自研多人时值得照抄）：

| 类 | 位置 | 职责 |
|---|---|---|
| `Player`（`src/player.h`） | 通用 | 名字、库存、HP、物理参数（`PlayerPhysicsOverride`：speed/jump/gravity/speed_walk/speed_fast/speed_crouch/speed_climb…） |
| `LocalPlayer`（`src/client/`） | 客户端 | 读输入、**本地执行移动**、相机跟随、本地碰撞预测 |
| `RemotePlayer`（`src/remoteplayer.h`） | 服务器 | 每个在线玩家一份，持久化 |
| `PlayerSAO`（`src/server/player_sao.h`） | 服务器 | 玩家作为"活动对象"参与世界模拟：权威位置、回血、对其它对象可见 |

移动模型：**客户端本地模拟移动并上报位置，服务器校验**（超速/穿墙检测可开关）——手感第一，防作弊靠服务端限制。其他玩家的位置由服务器广播，客户端插值平滑。

### 8.2 物理与碰撞

- 输入 → 意图速度（walk 4 / fast 倍率 / crouch 慢速 / 液体里 fluidity 阻尼）→ 积分 gravity/jump → `collisionMoveSimple`（`src/collision.h:57`）分轴 AABB 扫掠：先 X 后 Y 再 Z 移动，碰到的轴贴墙（`stepheight 0.6` 允许自动踏上矮台阶）。
- 玩家碰撞盒约 0.6×1.8×0.6；爬梯、游泳、飞行、幽灵穿墙都是物理参数开关，不写特殊分支。
- 脚（LocalPlayer）还负责：掉落伤害判定、脚下方块 `on_step` 类回调通知服务器、发出脚步声事件。

### 8.3 相机

`camera.cpp`：第一/第三人称/前视第三人称切换，FOV 可被 mod 动态改（如变焦），手持物品动画（挥动、走路摆动）挂在相机节点下。

---

## 9. 交互

### 9.1 射线拾取（DDA）

`src/raycast.cpp`（`RaycastState`）：从相机沿视线做 **Amanatides & Woo 体素步进**——逐格跨越体素边界，最多到触及距离（默认 4 格，`src/tool.cpp` 的 `getToolRange`，可被物品定义或物品元数据覆盖），每格先查实体（可被实体挡住）再查方块的可选框（`selection_box`），命中返回节点坐标 + **命中面法向**（放置新方块的位置 = 命中方块 + 法向）。方块和实体都支持"不可选中"标记。

### 9.2 挖掘与放置（服务器权威）

- **挖**：按住左键 → 客户端定期上报"我在挖这个" → 服务器按 hardness/groups/工具算耗时 → 广播挖掘进度 → 客户端画裂纹 → 完成时服务器删节点、走 `on_dig`、生成掉落物。中途换目标重新计。
- **放**：右键 → 客户端发"想在 x 放物品栏第 i 格的东西" → 服务器校验（有权限？位置合法？不被实体占？）→ 真正放置并扣物品。**客户端永远只发"意图"，服务器做判定**，这是所有多人体素游戏防作弊的基石。
- 右键方块本身（开箱子/点按钮）优先于放置，方向键 sneak+右键强制放置。

---

## 10. 物品、库存与合成

### 10.1 ItemStack

`src/inventory.h`：物品 = `名字 × 数量 × 磨损 × 元数据`。工具磨损、附魔式元数据（附 Luanti 里是附魔 mod 自己存 meta）、分组堆叠（`stack_max`，默认 99）都在这一个结构里。库存是**命名列表的集合**：玩家有 `main`（8×4=32 格，`constants.h:78`）、`hand`、craft 网格；箱子是"detached inventory"（服务器持有，按权限借给玩家看）。

### 10.2 同步模型

客户端发的永远是对库存的"操作请求"（从 A 列表移到 B 列表某格），**服务器上的 InventoryManager 权威裁决**（允许吗？重量？工具耐久够吗？），然后广播两侧结果。UI 只是视图。

### 10.3 合成

`src/craftdef.h` 五种 `CraftDefinition`：`Shaped`（形状配方，3×3 内任意位置）、`Shapeless`（无序）、`Cooking`（熔炉）、`Fuel`（燃料值）、`ToolRepair`（工具修复）。配方由 mod 注册，支持替换组（配方里写 `group:wood` 匹配任何木板）。内置合成向导 UI（mod 也可换）。

### 10.4 掉落物

挖掉的方块、死亡玩家掉的物品都变成 **item entity**（§11），物理落地、可被吸向玩家拾取、5 分钟消失——这整件事是 **Lua 内建 mod**（`builtin/game/item_entity.lua`）实现的，不在 C++ 里！这是"引擎提供实体机制、内容提供玩法"的绝佳示例。

---

## 11. 实体系统

统一抽象：**ActiveObject**。服务器上的叫 SAO（Server Active Object），客户端对应渲染的叫 CAO（`src/client/content_cao.h:78` `GenericCAO`）。

- 服务器 `ServerEnvironment`（`src/serverenvironment.h`）管理所有 SAO：玩家、Lua 实体、以及"静态化"的对象。实体有真实物理（同 §8 的 AABB 碰撞函数复用）、可持有库存（如骡子背包）。
- **活跃块**机制：只有玩家附近的块是"活跃"的，其中的实体才 tick（`ActiveBlockList`），远处实体序列化进块存档（`StaticObjectList`）休眠——无限世界的实体成本恒定。
- Lua 实体（`core.register_entity`）：每类实体一个 Lua 表，`on_activate/on_step/on_rightclick/on_punch` 回调在服务器 Lua VM 里跑。生物、箭、掉落物全靠它（引擎不带生物， mobs 系 mod 提供）。
- 客户端 `GenericCAO` 收到 spawn 消息后：加载模型/贴图/动画（.b3d/.obj/.gltf + 骨骼动画）、插值位置、渲染 nametag/血条。
- 粒子（`src/client/particles.cpp`）：服务器/客户端均可发射，方块破碎、爆炸、火焰都是粒子，支持贴图动画与重力。

---

## 12. 网络与多人

### 12.1 协议

自研 UDP 协议，当前版本 53（`src/network/networkprotocol.cpp:86`）。分两层：

- 连接层（`connection.cpp`）：UDP 之上做**分通道可靠/不可靠传输**（0/1 通道可靠重传+分包，2/3 通道不可靠用于实时位置），自带 MTU 切包与 ACK。
- 消息层：`serveropcodes/clientopcodes` 两张 opcode 表，每种消息一个 handler（`serverpackethandler.cpp` / `clientpackethandler.cpp`）。

### 12.2 世界同步

- 服务器按玩家视距决定该发哪些块：查库/emerge → zstd 压缩整块二进制（`TOCLIENT_BLOCKDATA`）→ 客户端回 `TOSERVER_GOTBLOCKS` 确认，未确认会重发。**块内只传 u16 id 数组**（定义早已各持一份），带宽极省。
- 单点改动走增量消息（`ADD_NODE`/`REMOVE_NODE`），不重发整块。
- 时间、天气、光照补算也各有消息；块里还带"玩家附近实体快照"。

### 12.3 媒体分发（很特别）

连接时服务器发全部 mod 媒体文件的 SHA1 清单 → 客户端只请求缺的 → 小文件走 UDP 分包，可选配置 HTTP 媒体服务器（ContentDB 的 CDN）走大吞吐下载。**客户端因此零安装即可进任意服务器**——这是"服务器权威内容"架构的收口。

### 12.4 单机 = 本地服务器

单人游戏不是"跳过网络"，而是**起一个真服务器进程内实例 + 本地客户端连接**（loopback）。所有游戏逻辑只写一遍，永远在服务器路径上，多人是免费的。这条对自研者是黄金法则：**客户端只是渲染终端**。

---

## 13. 存档与持久化

`doc/world_format.md`。一个世界 = 一个目录：

```
worlds/myworld/
├── world.mt        # 世界元信息：用哪个 game、启用了哪些 mod、后端选择
├── map.sqlite      # 地图：blobs 表，key=块坐标，value=zstd 压缩的 MapBlock
├── env_meta.txt    # 环境元数据（时间等）
├── auth.sqlite     # 账号密码哈希与权限
├── ipban.txt
└── <玩家名>        # 每玩家文件：位置、库存、hp、元数据（有文本格式版本历史）
```

要点：

- **后端可插拔**（`src/database/`）：`sqlite3`（默认）/ `leveldb` / `postgresql` / `redis` / `files`（散文件，调试用）/ `dummy`。大服务器把地图挪到 Postgres、热点用 Redis 缓存的部署是现成支持的。
- 块序列化见 §3.2；**玩家不随块存**（单独文件/表），防止"块被卸载把玩家也冻住"。
- 保存策略：脏块在卸载或定期时写回；崩溃安全靠 SQLite 事务。
- mod 自己的持久化：mod storage（键值）与元数据系统，禁止 mod 直接写文件路径——保证世界可迁移。

---

## 14. UI：主菜单、HUD 与 Formspec

### 14.1 主菜单是个 Lua 程序

`builtin/mainmenu/`：主菜单不在 C++ 里，而是引擎起一个**专门的 Lua VM** 跑的"前端程序"：`tab_local`（本地游戏）、`tab_online`（服务器列表）、`tab_content`（mod/材质包/游戏管理 + ContentDB 商店）、`tab_about`，外加十几个对话框（`dlg_create_world`、`dlg_config_world`…）。C++ 只提供"渲染 formspec + 设置读写 + 网络探针"的原语。好处：菜单改版不用动引擎，mod 社区甚至能整包替换主题。

### 14.2 Formspec：服务端驱动的 UI DSL

游戏内所有窗口（箱子界面、菜单、mod 自定义界面）用一种**文本 DSL** 描述：

```
formspec_version[4] size[8,9]
list[current_player;main;0.5,5;8,4;]
button[0.5,0.5;2,1;craft;Craft]
```

服务器发字符串，客户端解析渲染并把事件（按钮 x 被点、玩家动了库存）发回服务器。**UI 逻辑天然多人安全**——界面就是服务器状态的投影。代价是表达力有限（Luanti 正在做 SSCSM 缓解：服务器下发沙箱脚本到客户端本地执行，官方文档明确类比"网页里跑 JS"）。

### 14.3 HUD

`builtin/game/hud.lua` + `src/client/hud.cpp`：十字准星、8×4 快捷栏、心形血条（20 HP）、氧气泡（10 breath）、以及 mod 可添加的自定义 HUD 元素（文本/图片/指南针/.Statbar）。引擎只管画，数据全部来自服务器消息。

---

## 15. 音频与粒子

- **OpenAL** 全权负责（`src/client/sound/`）：OGG 文件加载、3D 定位（`sound_openal.cpp`）、按距离衰减。mod 注册 `sounds` 表：`dig/dug/place` 等事件音效 + gain/pitch 随机化。主线程只发指令，混音全在 OpenAL。
- **粒子**（§11 末）：`core.add_particle` 单发 + `add_particlespawner` 持续发射器（速率、寿命、贴图动画、加速度、发光），爆炸/方块碎裂全部用这套，CPU 端 billboard 渲染。

---

## 16. 脚本系统与内容管线

### 16.1 多 Lua VM 架构

引擎里同时跑着**多个互相隔离的 Lua 解释器**（`src/script/`）：

| VM | 文件 | 跑什么 |
|---|---|---|
| Server | `scripting_server.cpp` | 全部 mod 游戏逻辑（权威） |
| Emerge | `scripting_emerge.cpp` | 地图生成脚本（独立于游戏逻辑线程） |
| Mainmenu | `scripting_mainmenu.cpp` | 主菜单 UI |
| Async | `script/async` | mod 的后台工作线程（每次任务一个 VM，无共享状态） |
| Client | `scripting_client.cpp` | 客户端本地 mod（`clientmods/`，默认只有音量控制等） |
| SSCSM | `scripting_sscsm.cpp` | 开发中：服务器下发的客户端脚本（类 JS in browser） |

绑定层是手写的（`script/cpp_api/` 基类 + `lua_api/l_*.cpp` 每个模块一个文件），不是自动绑定。服务器 VM 的每个 mod 有独立环境表（沙箱：禁 `os`/`io` 大部分能力，文件访问仅限自己的目录）。

### 16.2 builtin：引擎的 Lua 半身

`builtin/` 是引擎自带的、伪装成 mod 的系统层：`game/register.lua`（`core.register_node` 的真正实现，甚至允许内建脚本再包一层校验）、`game/falling.lua`（沙子/雪下落——**重力方块是 Lua 实现的**：检测到下方为空就把自己变成实体/移动节点）、`game/item_entity.lua`（掉落物）、`game/auth.lua`、`game/chat.lua`、`common/`（序列化工具、`voxelarea.lua` 区域迭代器）。

> 自己写时：把"哪些东西放 C++、哪些放脚本"的答案记下来——**机制在 C++（物理、光照、库存、注册表），策略在 Lua（下落、掉落、合成表、任务逻辑）**。机制改动要迁移版本，策略改动热更就行。

### 16.3 内容分发

ContentDB（content.luanti.org）：mod/game/材质包的官方仓库，主菜单内置浏览安装。mod 依赖声明 `mod.conf`（depends/optional_depends），加载器拓扑排序。材质包见 `doc/texture_packs.md`：同名 PNG 覆盖 + `override.txt` 精确覆盖，还有服务器强制材质包机制。

---

## 17. 服务端世界模拟

`src/serverenvironment.cpp` 的 tick 循环是"活的世界"的来源，全部是**区域化 + 定步长**设计：

- **活跃块**：玩家周围若干块进入 `ActiveBlockList`，只有它们消耗 CPU。
- **ABM（ActiveBlockModifier）**：mod 注册"某类方块每隔 N 秒有 P 概率触发回调"（庄稼生长、草蔓延、火蔓延）。引擎对活跃块随机抽样执行，**不是每方块每帧**。
- **液体重排**：水流扩散是专用算法（队列式重算，非通用脚本），性能关键路径不放 Lua。
- **下落方块**（builtin Lua）：底部变空 → 转为下落实体 → 落地转回节点。
- **Node Timer**：到点触发（熔炉、机器）。
- **实体 tick**：物理、AI 脚本回调。
- 全局定时器：昼夜、天气、存档快照、玩家活动块轮换。

> 自研要点：把"每帧成本"与"玩家数量×活跃块数"挂钩，而不是与世界大小挂钩。所有模拟入口先问一句：这东西在玩家看不见时需要 tick 吗？

---

## 18. 线程与性能工程

Luanti 的线程盘点（自研时的并行蓝图）：

| 线程 | 职责 |
|---|---|
| 主线程（客户端） | 输入、渲染、场景图 |
| 主线程（服务器，单机时与客户端交错） | 环境模拟、消息处理 |
| EmergeThread × N | 块加载/生成/光照（`num_emerge_threads`，0=自动） |
| MeshUpdateThread | 网格生成队列（每帧限量换入，防卡顿尖峰） |
| Sound thread、Curl（HTTP/媒体）线程、Async Lua 线程池 | 杂务 |

其他工程手段：

- **一切压缩**：zstd 用于块、贴图传输；带宽是体素游戏的第一服务器成本。
- **惰性**：光照欠账（lighting_complete 位）、块按需 emerge、网格按需重建、ABM 抽样。
- **恒定内存**：视距外块卸载回库；贴图全部进图集。
- 数据局部性：节点数组是纯 u16/u8 的连续内存，网格生成器顺序扫描，缓存友好。

---

## 19. 从零写一款 MC 的路线图

综合 Luanti 的架构，给自研者（cubeforge）一个可执行的阶段规划。**每个阶段结束都应有一个能跑、能玩、能给人看的东西。**

**阶段 0 — 走通最小闭环（1–2 周）**
固定小世界（如 256×64×256）+ 单线程。一个方块 id 枚举（石头/草/空气）→ 逐块 mesh（相邻面剔除）→ 一张图集 → 第一人称相机 + WASD + AABB 碰撞 + DDA 拾取 → 左键删块右键放块（内存内）。**没有存档、没有无限、没有光照**。这一步会让你踩完 80% 的坐标系坑。

**阶段 1 — 无限世界与生成**
切块 16³ → 按 chunk 网格化+视锥剔除 → 高度图噪声生成器（先 2D）→ 玩家移动驱动的按需生成/卸载 → SQLite 存档（chunk 二进制 + 压缩 + 脏块回写）。对照阅读：`src/emerge.cpp`、`mapgen/mapgen_v5.cpp`。

**阶段 2 — 光照与体验**
阳光柱 + BFS 单通道光照 → 顶点光照进网格 → 昼夜循环（时间查表调色）。之后是：树叶/水等 drawtype、平滑光照/AO、水体网格。对照：`src/light.h`、`content_mapblock.cpp`。

**阶段 3 — 游戏系统**
ItemStack + 库存 + 快捷栏 UI → 合成（shaped/shapeless）→ 掉落物实体 → 挖掘进度/工具等级 → 玩家存档。对照：`inventory.h`、`craftdef.h`、`builtin/game/item_entity.lua`。

**阶段 4 — 脚本化**
嵌入 Lua，实现 `register_block(def)` 注册表 + 定义下发/查表渲染（§5.1 全套）。这一步之后，加方块不再改 C++。然后才是：多 VM、沙箱、热重载。

**阶段 5 — 多人**
TCP/UDP + 自定协议，先做"服务器权威 + 块同步 + 媒体下发"（§12 全套），单人= 本地服务器。防作弊、区块 interest management（按玩家视距调度）是两个新大陆。

**阶段 6 — 打磨**
主菜单（可先做成另一个脚本入口）、formspec 类 UI DSL、粒子、音效、生物、ABM 式世界模拟、后端抽象（SQLite→可换）。

**常见坑清单**（每条背后都是 Luanti 里现成的解法）：
1. 坐标系混乱（节点/块/世界三级）→ 用独立类型，不做隐式转换
2. 光照跨 chunk 边界错乱 → 欠账标志 + 补算（lighting_complete）
3. 网格化卡帧 → 独立线程 + 每帧换入限额
4. 存档越写越大 → 只存脏块 + 压缩 + 内容 id 化（别存方块名字符串）
5. 多人外挂 → 客户端只发意图，服务器校验一切
6. "世界越大越卡" → 所有模拟绑定活跃区，远处休眠

---

## 20. 关键文件索引与术语对照

### 快速跳转表

| 主题 | 文件 |
|---|---|
| 常量（块大小/库存/HP） | `src/constants.h` |
| 节点结构与参数位 | `src/mapnode.h` |
| 方块注册表与 drawtype | `src/nodedef.h/.cpp` |
| MapBlock / Map | `src/mapblock.h`、`src/map.h` |
| 按需生成 | `src/emerge.h/.cpp` |
| 地图生成器/噪声 | `src/mapgen/`、`src/noise.h` |
| 网格生成 | `src/client/content_mapblock.cpp` |
| 网格线程 | `src/client/mesh_generator_thread.cpp` |
| 纹理图集/修饰符 | `src/client/texturesource.cpp`、`tile.h` |
| 场景渲染 | `src/client/clientmap.cpp` |
| 光照常量/昼夜 | `src/light.h`、`src/daynightratio.h` |
| 碰撞/射线 | `src/collision.cpp`、`src/raycast.cpp` |
| 玩家 | `src/player.h`、`src/client/localplayer.cpp`、`src/server/player_sao.h` |
| 物品/合成 | `src/inventory.h`、`src/itemdef.cpp`、`src/craftdef.h` |
| 实体 | `src/serverenvironment.cpp`、`src/client/content_cao.cpp` |
| 网络 | `src/network/`（协议 53） |
| 存档 | `src/database/`、`doc/world_format.md` |
| 脚本绑定 | `src/script/`，内建层 `builtin/` |
| 主菜单 | `builtin/mainmenu/` |
| Lua API 文档 | `doc/lua_api.md`（约 1 万行，内容层的全部接口） |

### 术语对照（MC ↔ Luanti）

| Minecraft | Luanti | 备注 |
|---|---|---|
| 方块 block | node | 避免与 MapBlock 混淆 |
| 区块 chunk（16×384×16） | MapBlock（16³） | Luanti 的块是立方体，高度方向也切块 |
| 物品 ID | content id（u16） | 随存档保存映射表 |
| 掉落物 item entity | item entity（Lua 内建） | `builtin/game/item_entity.lua` |
| 红石 | 无内建（mesecon mod） | 引擎只给机制 |
| 生物 mob | Lua entity（mobs mod） | 引擎零生物 |
| 资源包 | 材质包 texture pack | |
| 数据包/模组 | mod / game | game=mod 的官方捆包 |
| 附魔 | 无内建（meta 实现） | |

## 21. 附录：Minetest Game 内容包

Luanti 引擎的官方默认游戏包，本地只读克隆于 `refs/minetest_game`（上游 <https://github.com/luanti-org/minetest_game>，浅克隆 `--depth 1`，记录时点 `c42e4d0`）。它是体素游戏"内容层"长什么样（方块定义、合成、贴图组织）的活教材。授权：代码 LGPL 2.1+；媒体（贴图/音效）CC BY-SA 3.0，署名要求见各 `mods/*/README.txt`。

| 主题 | 位置 |
|---|---|
| 方块定义（tiles 写法、硬度、光照参数） | `mods/default/nodes.lua` |
| 物品定义 | `mods/default/craftitems.lua` |
| 合成配方 | `mods/default/crafting.lua` |
| 方块贴图（447 个，CC BY-SA 3.0） | `mods/default/textures/` |
| 各贴图作者清单（CC BY-SA 署名要求） | `mods/*/README.txt` |

---

*基于 `refs/luanti`（提交 bd2bda638）与 `refs/minetest_game`（提交 c42e4d0）撰写；2026-08-31。*
