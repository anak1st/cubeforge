# 帧驱动 / 物理步进 / 移动 / 视角 —— 三项目对照

> 目的：弄清 Minecraft / Voxelize / Luanti 各自如何处理**渲染帧、模拟帧、移动、视角转动**，找出我们相机"视角转动卡顿"的正确解法。
> 依据（直接引用源码，行号可复查）
> - MC：`temp/minecraft-src/net/minecraft/client/Minecraft.java`、`net/minecraft/world/entity/Entity.java`、`net/minecraft/client/MouseHandler.java`
> - Voxelize：`refs/voxelize/packages/core/src/core/controls.ts`、`packages/physics-engine/src/index.ts`
> - Luanti：`refs/luanti/src/client/game.cpp`、`src/client/clientenvironment.cpp`

---

## 0. 一句话结论

三个项目**没有一个用"固定 60Hz 步进驱动相机 + prev/当前插值"**。它们的共同点是：

- **相机（视角 + 位置）在渲染帧（variable dt / 显示刷新率）上驱动**，不与固定 tick 对齐；
- 视角多用**两层模型**：输入直接写"目标朝向"，显示层再经 `lerp / damp / slerp` 朝目标平滑收敛；
- **只有 MC 用固定 tick**（20 TPS），但它渲染时用 `partialTicks` 对**位置+朝向都插值**，且鼠标转向是**每帧**做、不进 tick。

我们当前把相机塞进 60Hz 固定 tick 再用 prev/current 插值，等于把转向量化成 60Hz 抽样——这就是残余卡顿的根因。

---

## 1. Minecraft

### 渲染帧与模拟帧（分离）
- 主循环 `Minecraft.run()`（`Minecraft.java:875`）：`while(running)` 每轮调 `runTick(...)`（:1145）。
- **固定 tick**：`DeltaTracker.Timer(20.0F, …)`（:277）= 20 TPS（50ms）。`runTick` 里 `advanceGameTime(Util.getMillis()) → ticksToDo`（:1158），再 `for (i < min(10,ticksToDo)) this.tick()`（:1176）——累加器式，单帧最多补 10 个 tick（防螺旋）。
- **渲染**：每帧一次 `renderFrame`（:1223）→（:1295）`gameRenderer.render(deltaTracker, advanceGameTime)`。
- **插值因子**：`deltaTracker.getGameTimeDeltaPartialTick(false)`（:1284）→ `worldPartialTicks`，用于 `pick`（:1285）。渲染时用 `DeltaTracker` 携带 partial tick。

### 移动（在固定 tick 里，渲染时插值）
- 玩家物理在 `tick()`（20Hz）里推进。渲染用 partial tick 对**位置与朝向都插值**：
  - 位置：`Entity.getEyePosition(partialTicks)` → `Mth.lerp(partialTickTime, xo, getX())`（`Entity.java:1995-1997`）。
  - 朝向：`getYRot(partialTicks) → Mth.rotLerp(partialTicks, yRotO, getYRot())`（:1968-1969）；`getXRot(partialTicks) → Mth.lerp(partialTicks, xRotO, getXRot())`（:1964-1965）。
  - 所以 MC 渲染的是"上一 tick 状态 → 当前 tick 状态"的**连续插值**，物理在固定的 50ms 网格上推进。

### 视角转动（每帧，不进 tick）
- `MouseHandler.onMove`（:261）：把增量累加进 `accumulatedDX/DY`（:269-270），并不立即转。
- `handleAccumulatedMovement()`（:1197）**每渲染帧调用一次**；内部 `turnPlayer(mousea)`（:348）→ `player.turn(xo, yo)`（:373）→ `setYRot/XRot`。
- 可选平滑：`options.smoothCamera` 时用 `smoothTurnX/Y`（`getNewDeltaValue`，:355-356）；默认关（`reset()` + 直取，:365-368）。
- 结论：**MC 转向是显示率（帧率），不是 tick 率**；tick 只负责模拟与位置。

> 细节：`turnPlayer` 的敏感度公式 `ss = sensitivity*0.6+0.2; s^3; sens = s^3*8`（:349-351）。

---

## 2. Voxelize（同栈 three.js，最贴合我们）

### 渲染帧与模拟帧（不分离——全在每帧）
- 库模式：渲染循环里调 `controls.update()` + `renderer.render()`（controls 文档注明："Call the controls update function in the render loop"）。
- `controls.update()`（`controls.ts:685`）：
  - `timer.update(); delta = Math.min(0.1, timer.getDelta())`（:687-688）——**variable dt，钳到 0.1s**，无固定 tick、无累加器。
  - `object.quaternion.slerp(this.quaternion, rotationLerp)`（:690，默认 0.9）——**显示朝向朝目标收敛**。
  - `object.position.lerp(newPosition, positionLerp)`（:691，默认 1.0）——**显示位置朝物理位置收敛**。
  - `moveRigidBody()` + `updateRigidBody(delta)`（:712-713）。

### 移动（力/加速度式，variable dt）
- 物理引擎 `Engine.update(dt)`（`physics-engine/index.ts:88`）→ 每 body `iterateBody(body, dt, noGravity)`（:98）：
  - `dv = i/m + a*dt`（:134-139）；`x += v*dt`（:168-172）；`drag/friction` 用 `max(1 - drag*dt/m, 0)`（:161）。
  - 移动模式仿 Quake pmove：由输入算 heading，`push = 目标速度 − 当前速度`，用 `moveForce`/`responsiveness` 限幅施力，再乘摩擦（`:1620-1684`）。**没有固定子步**，直接按 dt 积分。

### 视角转动（鼠标事件 → 目标，每帧收敛）
- `onMouseMove`（:1870）：`euler.setFromQuaternion(目标quat)` → `euler.y -= movementX*sens*0.002/100`、`euler.x -= movementY*sens*0.002/100`（:1883-1886）→ clamp pitch（:1888）→ `quaternion.setFromEuler`（:1893）。**在 mousemove 事件上直接改"目标"**。
- 显示层每帧 `slerp(target, rotationLerp=0.9)` 收敛——两阶段。
- `justUnlocked`：重获指针后第一次移动跳过（:1875-1878，:1949）——Chrome 首个 movement 达 60+ 的 bug。

---

## 3. Luanti

### 渲染帧与模拟帧（不分离——全在每帧，靠帧率限制器定 pace）
- `Game::run`（`game.cpp:474`）：`while(run())`，每轮 `draw_times.limit(device, &dtime)`（:520）——**按目标 FPS 限帧并算出 dtime（真实帧长 + 补睡到目标 FPS）**。
- 每帧顺序（:539-593）：`processUserInput(dtime)` → `updateCameraDirection(&cam_view_target, dtime)`（:562）→ 平滑 `cam_view`（:563-578）→ `updatePlayerControl(cam_view)`（:579）→ `step(dtime)`（:585）→ `updateCamera(dtime)`（:590）→ 渲染（:593）。
- 注意顺序：**先更新相机方向，再做玩家移动**，注释即"避免相机滞后一帧"（:561）。

### 移动（variable dt + 碰撞子步）
- `Client::step(dtime)`（`client.cpp:428`）：`if (dtime > DTIME_LIMIT) dtime = DTIME_LIMIT;`，再 `m_env.step(dtime)`（:565）。
- `ClientEnvironment::step(dtime)`（`clientenvironment.cpp:72`）：
  - 按速度算碰撞子步上限：`dtime_max_increment = 0.1*BS / speed`，封顶 0.01s（:97,106-107）。
  - `steps = ceil(dtime / dtime_max_increment); dtime_part = dtime / steps`（:117-118）。
  - 循环 `applyControl(dtime_part)`（:125）+ 重力/液体（:128-172）+ `move(dtime_part)`（:180，内含碰撞检测）。
  - 结论：**每帧 variable dt + 为碰撞把 dt 拆 ≤10ms 子步**，无全局固定 tick。

### 视角转动（每帧写目标 + damp 平滑）
- `updateCameraOrientation`（`game.cpp:1998`）：鼠标 `dist.X * m_cache_mouse_sensitivity`（:2014-2015）、方向键轴（:2025-2031）、`pitch ∈ [-90,90]`（:2033）——**每帧把输入直接写进 `cam_view_target`（目标）**。
- 平滑层（:563-578）：`cam_smoothing <= 0` → `cam_view = cam_view_target`（瞬时）；否则 `damp(cam_view, cam_view_target, 1/smoothing*dtime)`（:568-577）。

---

## 4. 对照表

| 维度 | Minecraft | Voxelize | Luanti |
|---|---|---|---|
| **渲染帧** | 显示刷新率（vsync） | rAF | 目标 FPS 帧率限制器 |
| **模拟帧** | **固定 20 TPS**（累加器，单帧≤10） | **variable dt**（钳 0.1） | **variable dt**（钳 DTIME_LIMIT） |
| **移动** | tick 内推进 + 碰撞 | 力/加速度（Quake pmove）+ 摩擦 | 加速度 + 摩擦 + 重力，碰撞**子步≤10ms** |
| **移动渲染** | `partialTicks` 插值位置（lerp xo→x） | 显示位置 `lerp(物理位置, positionLerp)` | 直接取玩家位置（前置相机更新） |
| **视角输入** | 鼠标增量累积，**每帧** `turnPlayer` | 鼠标事件→写**目标四元数** | **每帧**写 `cam_view_target` |
| **视角平滑** | 可选 `smoothTurn`（默认关） | `slerp(target, rotationLerp=0.9)` | `damp`（`cam_smoothing`） |
| **视角渲染插值** | 无(turnPlayer 即时)；主由偏转插值：`rotLerp(partialTicks, yRotO...)` | slerp 每帧 | damp 每帧 |
| **固定 tick 与相机关系** | 相机不进 tick | 无 tick | 无 tick |
| **首次重锁跳变处理** | `ignoreFirstMove` | `justUnlocked` | — |

---

## 5. 对我们相机的结论（供后续改动参考）

**根因**：我们把"视角+移动"都放进 60Hz 固定 tick，再用 prev/current 插值。转向因此被量化为 60Hz 抽样——高速滑动鼠标时看起来呈步进/卡顿。

**应改成（对齐三个项目）**：
1. 相机在**渲染帧驱动**（variable dt），不再走固定 tick。即 `onRender(dt)` 里更新相机，`onTick` 留作将来真正的逻辑（M5 碰撞等）。
2. 采用**目标 + 平滑两层**：
   - 鼠标增量累积 → 每帧消费，写进 `targetYaw/targetPitch`（或 target quaternion）。
   - 显示用 `damp(viewYaw, targetYaw, dt/k)`（Luanti 式）或 `slerp`（Voxelize 式）收敛。
   - 平滑量默认可设很小或 0（＝瞬时，等同 MC 默认 + Voxelize lerp≈1）。
3. 处理 Chrome「重获指针后首个 movement≈60」跳变（`justUnlocked`/`ignoreFirstMove`）。
4. 位置：air 飞行可直接 `position += 速度*dt`（variable dt）；**若 M5 引入碰撞**，则学 MC/Luanti——固定 tick 或子步推进，渲染再插值/直接取，二者取其一。

**映射建议**：短切片期用"每帧 variable dt + 目标/damp"，最简单且和 Luanti/Voxelize 一致；到 M5 碰撞时再叠"固定 tick over 渲染"或"子步碰撞"，届时参照 MC（固定 tick + partialTicks 插位置与朝向）较合适。

## 关联

- `docs/design/blocks.md`（方块定义维度，Blocks 侧）
- `src/game/loop.ts` / `camera.ts` / `game.ts`（当前实现：60Hz tick + prev/current 插值，待按本报告重构）
- `docs/refs/minecraft.md`、`docs/refs/voxelize.md`、`docs/refs/luanti.md`
