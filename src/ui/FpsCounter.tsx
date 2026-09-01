import { useEffect, useRef } from 'react'
import type { GameStats } from '../game/loop'

// FPS 角标：拉取主循环的 GameStats，500ms 写一次 DOM。数字不进 React state（AGENTS.md 约定）。
export function FpsCounter({ stats }: { stats: GameStats }) {
  const valueRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = valueRef.current
    if (!el) return
    const timer = window.setInterval(() => {
      el.textContent = String(stats.fps)
    }, 500)
    return () => window.clearInterval(timer)
  }, [stats])

  return (
    <div className="absolute right-4 top-3 text-sm font-medium text-neutral-500 tabular-nums select-none">
      <span ref={valueRef}>--</span> FPS
    </div>
  )
}
