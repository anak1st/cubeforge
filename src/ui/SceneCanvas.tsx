import { useEffect, useRef } from 'react'
import { createDemoScene, type DemoScene } from '../render/scene'
import { loadTextures } from '../render/textures'
import { requestLock, setLockTarget } from './pointer-lock'
import { useAppStore } from './store'

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
