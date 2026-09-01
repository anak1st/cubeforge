import { useCallback, useState } from 'react'
import type { Game, Phase } from '../game/game'
import { FpsCounter } from './FpsCounter'
import { GameView } from './GameView'
import { PauseMenu } from './PauseMenu'
import { StartMenu } from './StartMenu'

// 页面壳:React 拥有画布与悬浮菜单。相位(React state)驱动菜单显隐,game 句柄经回调持有以响应按钮。
function App() {
  const [phase, setPhase] = useState<Phase>('start')
  const [game, setGame] = useState<Game | null>(null)

  const onReady = useCallback((g: Game) => setGame(g), [])

  return (
    <main className="relative h-full overflow-hidden bg-black">
      <GameView onPhase={setPhase} onReady={onReady} />
      {phase === 'start' && <StartMenu onStart={() => game?.start()} />}
      {phase === 'paused' && <PauseMenu onResume={() => game?.resume()} onMenu={() => game?.stop()} />}
      <h1 className="pointer-events-none absolute left-4 top-3 text-sm font-medium tracking-widest text-neutral-500 select-none">
        cubeforge
      </h1>
      <FpsCounter />
    </main>
  )
}

export default App
