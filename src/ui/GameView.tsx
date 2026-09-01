import { useEffect, useRef } from 'react'
import { createGame } from '../game/game'

// 游戏画布：React 拥有 <canvas>，game 层拿元素做命令式装配，effect cleanup 负责销毁。
export function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const game = createGame(canvas)
    return () => game.dispose()
  }, [])

  return <canvas ref={canvasRef} className="block" />
}
