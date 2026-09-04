import { useGame } from './hooks'
import { PauseMenu } from './PauseMenu'
import { SceneCanvas } from './SceneCanvas'
import { StartMenu } from './StartMenu'

/** 页面壳: menu 渲染开始屏幕; playing/paused 渲染游戏画布, paused 叠加暂停菜单. */
function App() {
  const phase = useGame((s) => s.phase)

  return (
    <main className="relative h-full overflow-hidden bg-black">
      {phase === 'menu' ? (
        <StartMenu />
      ) : (
        <>
          <SceneCanvas />
          {phase === 'paused' && <PauseMenu />}
        </>
      )}
    </main>
  )
}

export default App
