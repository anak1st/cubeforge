import { stats } from './stats'

// 帧长 EMA 的时间常数：约 1 秒。读数平稳可读，持续掉帧仍能在 1–2 秒内反映出来
const EMA_TAU_MS = 1000
// 超过该间隔视为"非渲染间隔"（切页签、调试断点），不参与平滑，避免读数被打穿
const GAP_SKIP_MS = 250
// 固定步长（M1 逻辑 tick）：60Hz = 约 16.67ms
const FIXED_DT_MS = 1000 / 60

export interface MainLoopOptions {
  /** M1：固定步长（60Hz）逻辑 tick，由累加器驱动 */
  onTick?: (dtMs: number) => void
  /** alpha 是渲染插值因子（0..1）：前一 tick 与本帧 tick 位置之间的比例，用于平滑移动 */
  onRender: (timeMs: number, alpha: number) => void
}

export interface MainLoop {
  dispose(): void
}

/**
 * 主循环：全项目唯一的 rAF 持有者（M0 提前落地的 M1 骨架）。
 * 本模块不认识 render/three——渲染经 onRender 注入；帧统计就地写入全局白板 game/stats.ts。
 */
export function createMainLoop(options: MainLoopOptions): MainLoop {
  const { onTick } = options
  let raf = 0
  let disposed = false
  let lastTime = 0
  let smoothMs = 0
  let windowStart = 0
  let ticks = 0
  let accumulator = 0

  const frame = (now: number): void => {
    if (disposed) return

    let dt = 0
    if (lastTime === 0) {
      // 首帧只对表：帧长与统计从下一帧起算，避免把启动等待算进去
      windowStart = now
    } else {
      dt = now - lastTime
      stats.frameMs = dt

      if (dt <= GAP_SKIP_MS) {
        // 帧长指数滑动平均，权重按帧间隔计算（与帧率无关）：
        // 稳态下数字几乎不动，读得清；持续掉帧 1–2 秒内收敛到新值
        const alpha = 1 - Math.exp(-dt / EMA_TAU_MS)
        smoothMs = smoothMs === 0 ? dt : smoothMs + alpha * (dt - smoothMs)
        stats.fps = Math.round(1000 / smoothMs)
      }

      if (now - windowStart >= 500) {
        const sec = (now - windowStart) / 1000
        stats.tps = Math.round(ticks / sec)
        ticks = 0
        windowStart = now
      }
    }
    lastTime = now

    // 固定步长累加器：按 60Hz 补调 onTick；余量钳制在 5 tick 内，卡顿后不追帧螺旋
    accumulator = Math.min(accumulator + dt, FIXED_DT_MS * 5)
    while (accumulator >= FIXED_DT_MS) {
      if (onTick) onTick(FIXED_DT_MS)
      accumulator -= FIXED_DT_MS
      ticks++
    }

    options.onRender(now, accumulator / FIXED_DT_MS)
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  return {
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
    },
  }
}
