import { useEffect } from 'react'
import { useAppStore } from './store'
import { PauseMenu } from './PauseMenu'
import { SceneCanvas } from './SceneCanvas'
import { StartMenu } from './StartMenu'

/**
 * 页面壳:menu 渲染开始屏幕;playing/paused 渲染游戏画布,
 * paused 时叠加暂停菜单;pointerlockchange 事件驱动状态迁移。
 */
function App() {
  const appState = useAppStore((s) => s.appState)

  useEffect(() => {
    const onLockChange = (): void => {
      const store = useAppStore.getState()
      if (document.pointerLockElement) store.start()
      else store.pause() // 解锁只可能源自 playing 期持有的锁(ESC/切页签)
    }
    document.addEventListener('pointerlockchange', onLockChange)
    return () => document.removeEventListener('pointerlockchange', onLockChange)
  }, [])

  return (
    <main className="relative h-full overflow-hidden bg-black">
      {appState === 'menu' ? (
        <StartMenu />
      ) : (
        <>
          <SceneCanvas />
          {appState === 'paused' && <PauseMenu />}
        </>
      )}
    </main>
  )
}

export default App
