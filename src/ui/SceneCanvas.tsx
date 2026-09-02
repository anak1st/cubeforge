import { useEffect, useRef } from 'react'
import { BLOCK_DIRT, BLOCK_GRASS, BLOCK_STONE } from '../core/blocks'
import { createDemoScene, type DemoScene } from '../render/scene'
import { loadTextures } from '../render/textures'
import { requestLock, setLockTarget } from './pointer-lock'
import { useAppStore } from './store'

// 演示方块的切换键(仅 playing 态生效);M5 输入层建立后迁入 game 层
const DEMO_KEYS: Record<string, number> = {
  Digit1: BLOCK_GRASS,
  Digit2: BLOCK_DIRT,
  Digit3: BLOCK_STONE,
}

/**
 * 游戏画面承载组件:挂载时请求指针锁并按需加载贴图,就绪后创建演示场景,
 * 按应用状态控制场景运行(playing)或冻结(paused),卸载时释放资源。
 */
export function SceneCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<DemoScene | null>(null)
  const appState = useAppStore((s) => s.appState)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    setLockTarget(canvas)
    requestLock().catch(() => useAppStore.getState().pause())

    const onKey = (e: KeyboardEvent): void => {
      if (document.pointerLockElement !== canvas) return
      const id = DEMO_KEYS[e.code]
      if (id !== undefined) sceneRef.current?.setBlock(id)
    }
    window.addEventListener('keydown', onKey)

    let disposed = false
    void loadTextures().then((textures) => {
      if (disposed) return // 卸载/StrictMode 双挂载竞态:晚到的结果直接丢弃
      const scene = createDemoScene(canvas, textures)
      sceneRef.current = scene
      // 加载期间应用状态可能已变化,场景就绪时对齐一次
      scene.setRunning(useAppStore.getState().appState === 'playing')
    })

    return () => {
      disposed = true
      window.removeEventListener('keydown', onKey)
      setLockTarget(null)
      sceneRef.current?.dispose()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    sceneRef.current?.setRunning(appState === 'playing')
  }, [appState])

  return <canvas ref={canvasRef} className="block" />
}
