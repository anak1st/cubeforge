/**
 * 游戏装配:在给定 canvas 上建起世界、主循环、飞行相机与 Pointer Lock 交互,并暴露相位控制给 UI。
 * 这是 ui(game) 与下层的唯一衔接点:ui 调 start/pause/resume/stop,相位变化经 onPhase 上报。
 */
import { generateDemoTerrain } from '../core/terrain'
import { World } from '../core/world'
import { createWorldScene } from '../render/scene'
import { createCameraController, type FlyInput } from './camera'
import { createMainLoop } from './loop'

export type Phase = 'start' | 'playing' | 'paused'

export interface Game {
  start(): void
  resume(): void
  stop(): void
  dispose(): void
}

export interface GameOptions {
  /** 相位变化上报(由 ui 用 React state 落地) */
  onPhase: (phase: Phase) => void
}

export function createGame(canvas: HTMLCanvasElement, options: GameOptions): Game {
  // 世界数据(单 chunk 演示地形),渲染只通过 getBlock 采样,保持 core 纯净
  const world = new World()
  generateDemoTerrain(world.ensureChunk(0, 0, 0))

  const scene = createWorldScene(canvas, (x, y, z) => world.getBlock(x, y, z))
  const fly = createCameraController(scene.camera)
  fly.setPosition(7.5, 14, 26)
  fly.lookTowards(7.5, 3, 7.5)

  let phase: Phase = 'start'
  let justUnlocked = false // Chrome 重获指针后首个 movement 极大,跳过
  const keys: FlyInput = { forward: false, back: false, left: false, right: false, up: false, down: false }

  const setPhase = (p: Phase): void => {
    if (phase !== p) {
      phase = p
      options.onPhase(p)
    }
  }
  const locked = (): boolean => document.pointerLockElement === canvas

  const loop = createMainLoop({
    onTick: (dtMs) => {
      if (locked()) fly.move(dtMs, keys) // 位置走固定 tick(模拟帧)
    },
    onRender: (t, alpha) => {
      fly.render(alpha) // 视角每渲染帧消费增量;位置按 alpha 插值
      scene.renderFrame(t)
    },
  })

  const onPointerLockChange = (): void => {
    if (locked()) {
      justUnlocked = true // 锁定后首次移动跳过 Chrome 报的大增量
      setPhase('playing')
    } else {
      // 退锁时清空移动键,避免重锁后卡键
      keys.forward = keys.back = keys.left = keys.right = keys.up = keys.down = false
      if (phase === 'playing') setPhase('paused') // ESC 由浏览器退锁,视为暂停
    }
  }
  const onMouseMove = (e: MouseEvent): void => {
    if (!locked()) return
    // Chrome 在重获指针后的第一次移动会报极大 movement(≈60+),跳过以免视角跳变
    if (justUnlocked) {
      justUnlocked = false
      return
    }
    fly.turn(e.movementX, e.movementY)
  }
  const onKey = (e: KeyboardEvent, down: boolean): void => {
    if (!locked()) return
    switch (e.code) {
      case 'KeyW': keys.forward = down; break
      case 'KeyS': keys.back = down; break
      case 'KeyA': keys.left = down; break
      case 'KeyD': keys.right = down; break
      case 'Space': keys.up = down; break
      case 'ShiftLeft':
      case 'ShiftRight': keys.down = down; break
    }
  }
  const onKeyDown = (e: KeyboardEvent): void => onKey(e, true)
  const onKeyUp = (e: KeyboardEvent): void => onKey(e, false)

  document.addEventListener('pointerlockchange', onPointerLockChange)
  document.addEventListener('mousemove', onMouseMove)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  const requestLock = (): void => {
    void canvas.requestPointerLock()
  }
  setPhase('start')

  return {
    start() {
      setPhase('playing') // 乐观进入;随后 pointerlockchange 若失败(浏览器拦截),回到 start/paused 由 onPhase 修正
      requestLock()
    },
    resume() {
      requestLock()
    },
    stop() {
      document.exitPointerLock()
      setPhase('start')
    },
    dispose() {
      loop.dispose()
      scene.dispose()
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      document.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    },
  }
}
