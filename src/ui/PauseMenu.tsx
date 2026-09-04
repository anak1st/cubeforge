import { useGame } from './hooks'
import { backToMenu, resumeGame } from '@/game/controller'
import { PixielButton } from './PixielButton'

/** 暂停菜单覆盖层; "继续"在重锁冷却期内禁用. */
export function PauseMenu() {
  const canResume = useGame((s) => s.canResume)

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
        <PixielButton onClick={resumeGame} disabled={!canResume}>
          继续
        </PixielButton>
        <PixielButton onClick={backToMenu}>返回菜单</PixielButton>
      </div>
    </div>
  )
}
