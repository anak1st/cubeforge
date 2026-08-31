# 综合分析：Luanti vs Voxelize vs cubeforge 的取向

> 本文是两份参考对象分析的**综合层**：把 `docs/luanti.md`（Luanti 自身分析）与 `docs/voxelize.md`（Voxelize 自身分析）放在一起比较，得出 cubeforge 在每个维度上的具体选择，以及"借鉴什么、不抄什么"的最终清单。子系统的详细实现请回到两份源码分析文档。

## 1. 两个参考对象的分工

| | Luanti（原 Minetest） | Voxelize |
|---|---|---|
| 本质 | 20 年历史的工业级 C++ 引擎 + Lua 内容层 | 新一代 TS/three.js + Rust 引擎 |
| 技术栈与我们 | 异构（C++ 不可直接移植） | **同构**（TS/three.js 可直接抄实现） |
| 强在 | 机制完备性、边界处理、20 年踩坑沉淀 | 同栈代码、现代工程化、WASM/Worker 范式 |
| 弱在 | 渲染保守（无贪心合并）、工程手法老 | 历史短、机制广度不及 Luanti |
| 文档 | `docs/luanti.md` | `docs/voxelize.md` |
| 源码 | `refs/luanti` | `refs/voxelize` |

**使用方式**：设计一个子系统时，先读 Luanti 的对应章节理解"问题为什么难、机制上要处理哪些边界情况"，再看 Voxelize 的对应实现获得"同栈的具体写法"，最后按本文的取向表落决策。

## 2. 逐维度对照与 cubeforge 取向

| 维度 | Luanti 做法 | Voxelize 做法 | **cubeforge 取向** | 理由 |
|---|---|---|---|---|
| chunk 形状 | 16³ 立方体，三维分块 | 柱形（size×maxHeight×size）+ subchunk | **柱形** | 单机、无跨高度流式需求；柱形实现成本低，光照/chunk 寻址更简单 |
| 体素存储 | u16 id + param1/param2 | u32 位打包（id16+旋转+阶段+含水） | **u16 id + u8 param1（光照）+ u8 param2（预留）** | 存储最省；我们无作物/含水需求，位打包是过早优化 |
| 光照通道 | 昼/夜双通道，存 param1 高低 4 位 | 独立数组，阳光+RGB 四通道各 4 位 | **独立 Uint8 数组，先单通道 0..15 + 阳光位** | 数据布局对齐 voxelize（独立数组便于 Worker）；彩色光列为远期彩蛋 |
| 网格生成 | 逐面剔除，无贪心（保每面独立贴图） | Rust 贪心合并 + 稀疏扫描 + 非贪心例外通道 | **M3 逐面（保正确性）→ M10 不达标再按 greedy.rs 做 WASM 贪心** | 先简单后优化；voxelize 已示范两者共存（例外通道） |
| 网格执行位置 | 客户端独立线程 | Worker 中跑 WASM | **Vite module Worker 跑 TS**，后续换 WASM | 计划既定 |
| 光照算法 | 同步 BFS（阳光柱+洪水+收光，跨块欠账位） | 作业化 BFS（批次/序号/重试/包围盒 + 队列压实） | **BFS 算法同源；封装学 voxelize 的作业形态**（天然适配 Worker） | 作业化是现代解 |
| 光照跨块补算 | `lighting_complete` 12 方向位 | `connectivity` 打包位 | **u8/掩码方向位**（两者思想相同） | 必做，防"邻块未加载按空气处理" |
| 方块定义 | drawtype 枚举 + paramtype2 | 声明式 aabbs + 规则引擎（conditional parts/dynamic patterns） | **注册表 + 简单 aabb 字段起步**；连接类方块（栅栏）需要时再加规则 | 规则引擎表达力强但复杂度高 |
| 方块注册表 | NodeDefManager（双 Map + 序列化下发） | Registry（双 Map + serialize） | **双 Map + serialize**（两者一致） | 已验证两次的模式 |
| 物理 | 分轴 AABB 扫掠 + stepheight | 独立小包：sweepAABB + 刚体睡眠 + autostep + 危险跌落 | **vendor voxelize 的 `packages/aabb`、`physics-engine`、`raycast`（MIT）进 core/** | 零依赖纯 TS，直接可用 |
| 拾取 | DDA 体素步进（Amanatides & Woo） | slab 法 AABB 射线（实体） | **方块 DDA（自写）+ 实体 slab（抄 voxelize）** | 各取所长 |
| 物品/背包 | 服务端权威库存 + formspec UI | ItemSlot/ItemSlots 纯逻辑状态机 + canvas-box 离屏图标 | **槽位状态机进 core（学 voxelize），UI 用 React 视图层** | 逻辑可测、视图解耦 |
| 世界生成 | 单文件生成器家族（v5/v6/v7…） | 阶段管线（Shape→Surface→Carve→Populate→River→Flora） | **阶段管线思想，起步只两阶段（Shape→Surface）** | 管线可生长，避免后期重写 |
| 存档 | map.sqlite（块 blob + zstd + NameIdMapping） | 服务器端存储（客户端不持久化） | **IndexedDB + deflate + id↔名字映射表**（取 Luanti 模式，浏览器化） | 见 docs/plan.md M7 |
| UI | formspec DSL（服务端下发） | three.js 内绘 + DOM 库 | **React + Tailwind**（已定） | 我们的场景无服务器下发需求 |
| 多人 | 自研 UDP 权威服务器 | WebSocket/WebRTC + protobuf + ECS | **无联机**；若未来加，参照 voxelize 的协议分层 | 计划既定 |
| 内容扩展 | Lua mod 沙箱 | 代码即内容 | **代码即内容** | 计划既定 |

## 3. 借鉴清单（按里程碑落地）

| 里程碑 | 借鉴 | 来源 |
|---|---|---|
| M2 数据模型 | 柱形 chunk、u16 体素、独立光数组、双 Map 注册表 | luanti §3 §5 + voxelize §3 §6 |
| M3 网格化 | 逐面剔除 + 贪心预留例外通道思想；贪心算法本体（`greedy.rs`）留作性能后手 | voxelize §4 |
| M4 世界生成 | 阶段管线（先 Shape/Surface 两阶段）；种子与参数显式管理 | voxelize §11 + luanti §4 |
| M5 物理/交互 | **vendor `aabb`/`physics-engine`/`raycast` 三包（MIT，保留版权头）**；方块 DDA 自写 | voxelize §7 §8 |
| M6 光照 | flood/removal BFS（luanti 边界处理 + voxelize 作业化封装 + 队列压实）；跨块方向欠账位 | luanti §7 + voxelize §5 |
| M7 UI/存档 | React/zustand 桥接（既定）；存档格式取 Luanti 模式浏览器化 | luanti §13 §14 |
| M8 物品/背包 | ItemSlots 状态机抄结构进 core；canvas-box 离屏图标思想 | voxelize §10 |
| M10 性能 | 顶点量化、内存压力自适应、连通性位；不达标时 WASM 贪心 mesher | voxelize §4 §13 |

**明确不抄**：ECS 权威服务器与协议栈（无联机）、本地点光阴影（3,400 行，过度工程）、WebRTC、formspec 式服务端 UI DSL（我们有 React）、Luanti 的 Lua mod 沙箱（无 mod 需求）。

## 4. 决策记录的维护

本文的取向表是**活文档**：某个维度的实现与取向不符时（比如 M2 最终没用柱形 chunk），必须回来更新该行，并在行内注明实际选择与原因。里程碑验收（`docs/qa/Mxx.md`）时顺手核对一次。
