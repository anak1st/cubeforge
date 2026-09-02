import { useAppStore } from './store'
import { MenuButton } from './MenuButton'

/** 开始屏幕:标题 + 开始游戏按钮;点击把应用状态切换到 playing。 */
export function StartMenu() {
  const start = useAppStore((s) => s.start)

  return (
    <div className="flex h-full flex-col items-center justify-center gap-10 bg-black">
      <h1
        className="text-5xl font-bold tracking-[0.3em] text-neutral-100 select-none"
        style={{ textShadow: '3px 3px 0 rgba(0, 0, 0, 0.8)' }}
      >
        cubeforge
      </h1>
      <MenuButton onClick={start} autoFocus>
        开始游戏
      </MenuButton>
    </div>
  )
}
