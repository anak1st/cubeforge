import { useEffect, useRef, useState } from 'react'
import { useAppStore } from './store'
import { MenuButton } from './MenuButton'
import { requestLock } from './pointer-lock'

// Chrome 在 ESC 退锁后约 1.25s 内强制拒绝一切重锁请求(防锁死陷阱),冷却结束前禁用"继续"
const LOCK_COOLDOWN_MS = 1250

/** 暂停菜单覆盖层:提供"继续"与"返回菜单";出现后先禁用"继续",重锁冷却结束自动恢复并聚焦。 */
export function PauseMenu() {
  const backToMenu = useAppStore((s) => s.backToMenu)
  const [cooling, setCooling] = useState(true)
  const [hint, setHint] = useState<string | null>(null)
  const resumeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setCooling(false)
      resumeRef.current?.focus()
    }, LOCK_COOLDOWN_MS)
    return () => clearTimeout(timer)
  }, [])

  const resume = (): void => {
    setHint(null)
    requestLock().catch(() => setHint('请稍候再试'))
  }

  return (
    <div
      className="
        absolute inset-0 z-10
        flex flex-col items-center justify-center gap-8
        bg-black/50 backdrop-blur-sm
      "
    >
      <h2
        className="text-3xl font-bold tracking-[0.3em] text-neutral-100 select-none"
        style={{ textShadow: '3px 3px 0 rgba(0, 0, 0, 0.8)' }}
      >
        已暂停
      </h2>
      <div className="flex flex-col gap-3">
        <MenuButton ref={resumeRef} onClick={resume} disabled={cooling}>
          继续
        </MenuButton>
        <MenuButton onClick={backToMenu}>返回菜单</MenuButton>
      </div>
      {hint && <p className="text-sm text-amber-300 select-none">{hint}</p>}
    </div>
  )
}
