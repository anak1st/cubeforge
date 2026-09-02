import { useAppStore } from './store'
import { PixielButton } from './PixielButton'

/** 开始屏幕:标题 + 开始游戏按钮;点击把应用状态切换到 playing。 */
export function StartMenu() {
  const start = useAppStore((s) => s.start)

  return (
    <div className="flex h-full flex-col items-center justify-center gap-10 bg-black">
      <h1 className="pixel-text text-[70px] text-neutral-100 select-none">cubeforge</h1>
      <PixielButton onClick={start}>
        开始游戏
      </PixielButton>
    </div>
  )
}
