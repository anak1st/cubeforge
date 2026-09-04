import { useEffect, useRef } from 'react'
import { attachCanvas, detachCanvas } from '@/game/controller'

/** 游戏画布承载组件. */
export function SceneCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    attachCanvas(canvas)
    return () => detachCanvas()
  }, [])

  return <canvas ref={canvasRef} className="block" />
}
