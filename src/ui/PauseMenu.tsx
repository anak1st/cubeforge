import { useEffect, useState } from 'react'
import { useAppStore } from './store'
import { PixielButton } from './PixielButton'
import { requestLock } from '../game/pointer-lock'

// Chrome 在 ESC 退锁后约 1.25s 内强制拒绝一切重锁请求(防锁死陷阱),冷却结束前禁用"继续"
const LOCK_COOLDOWN_MS = 1250

/** 暂停菜单覆盖层:提供"继续"与"返回菜单";出现后先禁用"继续",重锁冷却结束自动恢复。 */
export function PauseMenu() {
  const backToMenu = useAppStore((s) => s.backToMenu)
  const [cooling, setCooling] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setCooling(false), LOCK_COOLDOWN_MS)
    return () => clearTimeout(timer)
  }, [])

  const resume = (): void => {
    requestLock().catch((err) => console.error('指针锁定失败', err))
  }

  return (
    <div
      className="
        absolute inset-0 z-10
        flex flex-col items-center justify-center gap-8
        bg-black/50 backdrop-blur-md
      "
    >
      <h2 className="pixel-text text-4xl text-white select-none">已暂停</h2>
      <div className="flex flex-col gap-3">
        <PixielButton onClick={resume} disabled={cooling}>
          继续
        </PixielButton>
        <PixielButton onClick={backToMenu}>返回菜单</PixielButton>
      </div>
    </div>
  )
}
