import { useEffect, useRef } from 'react'
import { createDemoScene, type DemoScene } from '../render/scene'
import { requestLock, setLockTarget } from './pointer-lock'
import { useAppStore } from './store'

/**
 * 游戏画面承载组件:创建演示场景并启动渲染,挂载时请求指针锁,
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
    const scene = createDemoScene(canvas)
    sceneRef.current = scene
    requestLock().catch(() => useAppStore.getState().pause())
    return () => {
      sceneRef.current = null
      setLockTarget(null)
      scene.dispose()
    }
  }, [])

  useEffect(() => {
    sceneRef.current?.setRunning(appState === 'playing')
  }, [appState])

  return <canvas ref={canvasRef} className="block" />
}
