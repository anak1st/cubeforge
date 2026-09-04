import { startGame } from '@/game/controller'
import { PixielButton } from './PixielButton'

/** 开始屏幕: 泥土平铺底 + 标题 + 开始游戏按钮. */
export function StartMenu() {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-10 select-none"
      style={{
        // 原版设置页式暗色泥土底: 16px 贴图 4 倍平铺压暗到约 30% 亮度
        backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url(/textures/block/dirt.png)',
        backgroundSize: '64px 64px',
        imageRendering: 'pixelated',
      }}
    >
      <h1 className="pixel-text text-[72px] text-white">cubeforge</h1>
      <PixielButton onClick={startGame}>
        开始游戏
      </PixielButton>
    </div>
  )
}
