import { useEffect, useRef } from 'react'
import { createDemoScene } from '../render/scene'

// three 场景的 React 承载范式：<canvas> 写在 JSX 里归 React 管，three 只在 effect 里往里画。
// createDemoScene 的释放函数恰好作 effect cleanup 返回，天然兼容 StrictMode 双挂载。
export function SceneCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    return createDemoScene(canvas)
  }, [])

  return <canvas ref={canvasRef} className="block" />
}
