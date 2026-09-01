import { useEffect, useRef } from 'react'
import { createGame, type Game, type Phase } from '../game/game'

interface GameViewProps {
  onPhase: (phase: Phase) => void
  onReady: (game: Game) => void
}

// 游戏画布:React 拥有 <canvas>,game 层拿元素做命令式装配;相位经回调上报,游戏句柄交给 App 驱动菜单。
export function GameView({ onPhase, onReady }: GameViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const game = createGame(canvas, { onPhase })
    onReady(game)
    return () => game.dispose()
  }, [onPhase, onReady])

  return <canvas ref={canvasRef} className="block" />
}
