import { createDemoScene } from '../render/scene'
import { createMainLoop } from './loop'

/**
 * 游戏装配：在给定 canvas 上建起场景与主循环（唯一装配点，纯 TS 无 hooks）。
 * 返回释放函数；帧统计由循环就地写入全局白板 game/stats.ts，供 UI 低频拉取。
 */
export function createGame(canvas: HTMLCanvasElement): { dispose(): void } {
  const scene = createDemoScene(canvas)
  const loop = createMainLoop({ onRender: (t) => scene.renderFrame(t) })

  return {
    dispose() {
      loop.dispose()
      scene.dispose()
    },
  }
}
