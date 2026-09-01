import { useEffect, useRef } from 'react'
import { stats } from '../game/stats'

// FPS 角标：500ms 拉取全局白板写 DOM；数字不进 React state（AGENTS.md 约定）。
export function FpsCounter() {
  const valueRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = valueRef.current
    if (!el) return
    const timer = window.setInterval(() => {
      el.textContent = String(stats.fps)
    }, 500)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="absolute right-4 top-3 text-sm font-medium text-neutral-500 tabular-nums select-none">
      <span ref={valueRef}>--</span> FPS
    </div>
  )
}
