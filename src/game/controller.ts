import { gameStore } from './store'
import { exitLock, requestLock, setLockTarget } from './pointer-lock'
import { createDemoScene, type DemoScene } from '@/render/scene'
import { loadTextures } from '@/render/textures'
import { BLOCK_DIRT, BLOCK_GRASS, BLOCK_STONE } from '@/core/blocks'

// Chrome 在用户 ESC 退锁后约 1.25s 内拒绝一切重锁请求(程序化退锁无此冷却)
const LOCK_COOLDOWN_MS = 1250

// 演示方块切换键
const DEMO_KEYS: Record<string, number> = {
  Digit1: BLOCK_GRASS,
  Digit2: BLOCK_DIRT,
  Digit3: BLOCK_STONE,
}

let cooldownTimer: ReturnType<typeof setTimeout> | undefined

// 指针锁的实况由浏览器事件回流写 store, 与下方 action 是同一状态的另一个写入方
document.addEventListener('pointerlockchange', () => {
  const { phase } = gameStore.getState()
  if (document.pointerLockElement) {
    // 重锁成功; 初始进入时 phase 已是 playing, 此处自然跳过
    if (phase === 'paused') gameStore.setState({ phase: 'playing' })
  } else if (phase === 'playing') {
    enterPaused() // playing 期持有的锁退掉, 只可能是用户 ESC 或切页签
  }
})

// 进入暂停: 附带重锁冷却, 期满恢复 canResume
function enterPaused(): void {
  gameStore.setState({ phase: 'paused', canResume: false })
  clearTimeout(cooldownTimer)
  cooldownTimer = setTimeout(() => gameStore.setState({ canResume: true }), LOCK_COOLDOWN_MS)
}

/** 切换到 playing; 指针锁由 attachCanvas 作为副作用请求. */
export function startGame(): void {
  gameStore.setState({ phase: 'playing' })
}

/** 切换到 paused 并主动退锁; 程序化退锁不触发浏览器重锁冷却, canResume 立即为真. */
export function pauseGame(): void {
  clearTimeout(cooldownTimer)
  gameStore.setState({ phase: 'paused', canResume: true })
  exitLock()
}

/** 请求重锁以回到 playing; 冷却期内为空操作, 结果由 lockchange 监听写回. */
export function resumeGame(): void {
  if (!gameStore.getState().canResume) return
  void requestLock().catch(() => {
    // 冷却或拒绝: 保持 paused
  })
}

/** 切换回 menu. */
export function backToMenu(): void {
  gameStore.setState({ phase: 'menu' })
}

let scene: DemoScene | null = null
let rafId = 0
let lastTime = 0
// 每次挂载/卸载自增; 晚到的贴图加载结果按代号丢弃(StrictMode 双挂载安全)
let attachEpoch = 0

/** 渲染循环一帧: playing 时推进旋转角, 随后绘制当前状态. */
function frame(now: number): void {
  const dt = Math.min(now - lastTime, 50) // 后台页签 rAF 停摆, 恢复首帧 dt 截断
  lastTime = now
  const s = gameStore.getState()
  if (s.phase === 'playing') {
    // 双轴异速慢滚: 顶, 侧, 底都能被看到
    gameStore.setState({ rot: { x: s.rot.x + dt * 0.00015, y: s.rot.y + dt * 0.0004 } })
  }
  scene?.render(gameStore.getState().rot) // 暂停时旋转角不变, 画面冻结但仍持续渲染
  rafId = requestAnimationFrame(frame)
}

/** 演示键输入: 锁定态下按 1/2/3 切换演示方块. */
function onDemoKey(e: KeyboardEvent): void {
  if (!document.pointerLockElement) return
  const id = DEMO_KEYS[e.code]
  if (id !== undefined) scene?.setBlock(id)
}

/** 挂载画布: 注册锁目标与演示键输入, 请求指针锁, 场景就绪后启动循环. */
export function attachCanvas(canvas: HTMLCanvasElement): void {
  const epoch = ++attachEpoch
  setLockTarget(canvas)
  window.addEventListener('keydown', onDemoKey)
  void loadTextures().then((textures) => {
    if (epoch !== attachEpoch) return
    scene = createDemoScene(canvas, textures)
    lastTime = performance.now()
    rafId = requestAnimationFrame(frame)
  })
  requestLock().catch(enterPaused) // 锁请求被拒(手势失效等)→ 进入暂停等待重试
}

/** 卸载画布: 停循环, 清输入与锁目标, 退锁, 释放场景. */
export function detachCanvas(): void {
  attachEpoch++
  cancelAnimationFrame(rafId)
  window.removeEventListener('keydown', onDemoKey)
  setLockTarget(null)
  exitLock()
  scene?.dispose()
  scene = null
}
