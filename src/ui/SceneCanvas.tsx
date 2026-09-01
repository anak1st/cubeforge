import { useEffect, useRef, useState } from 'react'
import { createMainLoop } from '../game/loop'
import type { GameStats } from '../game/loop'
import { createDemoScene } from '../render/scene'
import { FpsCounter } from './FpsCounter'

// 装配点：render 的场景 + game 的主循环在此接线（game 不 import render，靠这里注入回调）。
// dispose 链作 effect cleanup 返回，天然兼容 StrictMode 双挂载。
export function SceneCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stats, setStats] = useState<GameStats | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const scene = createDemoScene(canvas)
    const loop = createMainLoop({ onRender: scene.renderFrame })
    setStats(loop.stats) // 只在挂载时传一次引用；帧级数字从不流经 React
    return () => {
      loop.dispose()
      scene.dispose()
    }
  }, [])

  return (
    <>
      <canvas ref={canvasRef} className="block" />
      {stats && <FpsCounter stats={stats} />}
    </>
  )
}
