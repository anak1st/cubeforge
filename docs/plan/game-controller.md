# GameController:UI 触发 / 游戏驱动 / 渲染呈现 解耦

状态:设计草案(未实现)。目标是一次把「谁拥有游戏循环、输入、指针锁」定对,避免 M5 再搬一次。
关联:`docs/plan/ui-shell.md`(本次抽象目标替换其「指针锁协议」一节)、`docs/plan/simulation-loop.md`(循环归属依据)。

---

## 1. 动机:当前的分层错位

现状 `src/ui/` 既管视图,又直插输入机制(指针锁)和渲染句柄(scene),绕过 `game/` 该负责的「游戏循环、输入、玩家」这一段:

| 文件 | 越界动作 |
|---|---|
| `src/ui/App.tsx:15-19` | 直接监听 `pointerlockchange` 并 `store.start()/pause()` |
| `src/ui/SceneCanvas.tsx:27-28` | 直接 `setLockTarget(canvas)` / `requestLock` |
| `src/ui/SceneCanvas.tsx:55-57` | 用 `appState` 直控 `scene.setRunning` |
| `src/ui/SceneCanvas.tsx:30-34` | 在 React 里监听 `keydown` 直接 `scene.setBlock` |
| `src/ui/PauseMenu.tsx:19-21` | 直接 `requestLock()` |

方向是反的:现在是 **UI 直接驱动 scene / 直接调 lock**,而不是 ui → game → render。

---

## 2. 目标分层

```
src/ui/     只做两件事: 呈现视图 + 发语义命令
              │  start() / backToMenu() / resume() / setBlock(id) / attach(canvas) / detach()
              ▼
src/game/   GameController —— 拥有: 指针锁、keydown输入、rAF循环、running/paused 运行态、将来的 tick
              │  game.step(dt) → scene.render(dt, rot)
              │  phase 变化 → onState() 推回 UI(供渲染 overlay)
              ▼
src/render/ DemoScene 变成纯绘制: renderer/camera/灯光/网格
                 提供 render(dt, rot)/setBlock(id)/dispose, 不起循环、不持有 running、不监听输入
```

依赖方向单向:**ui → game → render**。`game` 不 import `ui`/`react`(符合 AGENTS.md:
`game/` 禁止 import react;`ui/` 禁止 import three)。

---

## 3. 组件职责

### 3.1 `src/render/scene.ts` — DemoScene 退化为 draw-only

`createDemoScene(canvas, textures) -> DemoScene`:

- 保留:构建 renderer/camera/灯光/网格;`setBlock(id)`(换材质);`dispose()`;resize 监听(它拥有 camera/renderer)。
- **移除**:内部 `setAnimationLoop`、`running` 旗标、`dt` 计算与 50ms 截断。
- **新增**:`render(dt, rot)`。`dt` 由 game 传入;`rot: {x, y}` 为当前实体朝向(game 持有),场景负责应用到 `cube.rotation` 后绘制。场景不再解"是否转",只解"怎么画"。

> 说明:演示里「一个方块在转」就是这个 demo 的全部模拟。为对齐分层,把**旋转角(世界状态)归 game**,场景只接收角度来画。将来真实实体/移动同理:game 持世界状态,render 负责映射到网格。

### 3.2 `src/game/game.ts` — GameController(新增)

单一所有者,持有:

- **指针锁**:注册锁目标、`requestLock`、监听 `pointerlockchange`。ESC 退锁 → phase 置为 paused;重锁成功 → 置为 running。
- **输入**:`keydown`(demo 键 1/2/3 → `setBlock`);将来 mousemove / WASD。
- **循环**:rAF 循环;每帧算 `dt`(**50ms 截断逻辑从 scene 迁到此处**),`game.step(dt)` 后 `scene.render(dt, rot)`。
- **运行态**:`phase: 'idle' | 'running' | 'paused'`;`running = phase === 'running'`。`step(dt)` 里 `if (running) 更新 rot`。
- **场景句柄**:持有 `DemoScene`,生命周期(等贴图加载、创建、dispose)全在内部,不暴露给 UI。

**对外 API(UI 只发这些语义命令):**

```ts
createGameController({ onState }: { onState: (phase: Phase) => void })
  : {
      attach(canvas: HTMLCanvasElement): void   // UI 挂载 canvas 时调用;内部注册锁目标 + 等贴图建 scene + 起循环
      detach(): void                            // UI 卸载时调用;停止循环/释放资源/清锁
      start(): void                             // 开始游戏(menu→playing)
      backToMenu(): void                        // 返回菜单
      resume(): void                            // 恢复(重锁)
      setBlock(id: number): void                // 切换方块(来自 game 自身输入,不暴露给 UI 也行)
      dispose(): void
    }
```

- **`onState` 回调**在 phase 变化时触发,是 game 向 UI 的唯一出口。
- `start` 由 UI 按钮触发;`start` 内部只把 phase 置 running,canvas 随 UI 状态挂载后 `attach` 拿到 canvas 再注册锁。
- `resume` 内部调 `requestLock`;失败保持 paused(由 UI 的冷却定时器决定何时可再点)。
- `attach` 要能承受 StrictMode 双挂载/卸载竞态:晚到的贴图加载结果、重复 attach 都需幂等处理(`disposed` 语义从 SceneCanvas 迁入)。

### 3.3 `src/ui/store.ts` — appState 仍是视图单一事实源,但由 game 喂

- 保留 `appState: 'menu' | 'playing' | 'paused'`,语义不变;初始 `menu`。
- 新增:`store` 在启动时订阅 `GameController` 的 `onState`,把 `phase` 映射为 `appState`
  (`idle→menu`、`running→playing`、`paused→paused`)。
- `start`/`backToMenu`/`resume` 动作**改为转发到 `game`**(而非直接 `set`);`pause` 不再由 UI 直接调,而由 game 的锁/输入解释回调触发,经 `onState` 写回 store。
- **写入 appState 的来源只剩两类**:UI 的导航意图(start/backToMenu → 经 game),与 game 的锁/输入解释(ESC→pause、resume→running → 经 onState)。

### 3.4 `src/ui/*` 组件 — 收缩为视图 + 命令

- `StartMenu`:"开始游戏" 改调 `game.start()`。
- `PauseMenu`:"继续" 改调 `game.resume()`("返回菜单" 改调 `game.backToMenu()`);1.25s 冷却禁用逻辑保留在 UI(纯视图口径)。
- `SceneCanvas`:`useEffect` 只做 `game.attach(canvas)` + cleanup `game.detach()`;删掉 `setLockTarget`/`requestLock`/`sceneRef`/`keydown`/`setRunning`/`setBlock` 等全部越界逻辑。
- `App`:删除 `pointerlockchange` 监听(迁入 game);仍按 `appState` 渲染 StartMenu / SceneCanvas / PauseMenu。
- `src/game/pointer-lock.ts`:`setLockTarget`/`requestLock` 保留,但只被 game 内部调用;不再被 ui 引用。

---

## 4. 需要保留的既有行为(迁移时逐一核对)

1. 开始屏幕无游戏画面;点开始 → 方块双轴自转、指针锁定。
2. ESC → 暂停覆盖层(变暗模糊),方块冻结,「继续」禁约 1.25s 后自动可点并聚焦,点击后恢复无角度跳变。
3. 暂停中按 ESC 无反应;返回菜单 → 画布消失回开始屏幕。
4. playing 中按 1/2/3 → 方块在 草/泥/石 间切换。
5. **暂停 ≠ 停循环**:`paused` 期间 rAF 仍跑,只是 `step` 不改 `rot`(渲染仍被调用,画面冻结)。对齐 MC 暂停观感。
6. **50ms dt 截断**、StrictMode 双挂载 / 卸载竞态(discard 晚到结果)从旧逻辑迁移,不丢失。
7. 指针锁 1.25s 重锁冷却:语义不变,只是 `requestLock` 的位置从 UI 迁到 game。

---

## 5. 落地顺序(供之后实现参考)

1. `src/render/scene.ts`:删 `setAnimationLoop`/`running`/dt;加 `render(dt, rot)`。
2. 新增 `src/game/game.ts`:`GameController`(锁 + 输入 + 循环 + phase + 场景句柄 + onState)。
3. `src/ui/store.ts`:订阅 game 的 onState;命令转发到 game。
4. `src/ui/*`:删越界逻辑,只留 `game.xxx()` 与渲染。
5. 更新 `docs/plan/ui-shell.md` 的「指针锁协议」一节为指向本文;`TODO.md` 记录。
6. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` 全绿;人工按第 4 节清单验收。

---

## 6. 不做(符合"不过度工程化")

- 不引事件总线/框架;用 zustand + 一个回调(`onState`)即可。
- 不做抽象基类、不搞 plugin 接口。
- 不把 demo 的"方块旋转"过度建模成实体系统——game 持有 `rot`,render 接收 `rot`,足够。
