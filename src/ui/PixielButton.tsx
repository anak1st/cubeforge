import type { ReactNode } from 'react'

/** PixielButton 的属性。 */
interface PixielButtonProps {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}

// 斜面对比度取自原版 widgets 贴图(面 #707070、上/左 #aaaaaa、下/右 #565656 的明暗差);
// 禁用态底色深(#2d2d2d),同一组 alpha 会看不清,换高光更弱、暗边更强的一组
const BEVEL = {
  enabled:
    'inset 0 2px 0 rgba(255, 255, 255, 0.4), inset 2px 0 0 rgba(255, 255, 255, 0.4), inset 0 -2px 0 rgba(0, 0, 0, 0.25), inset -2px 0 0 rgba(0, 0, 0, 0.25)',
  disabled:
    'inset 0 2px 0 rgba(255, 255, 255, 0.22), inset 2px 0 0 rgba(255, 255, 255, 0.22), inset 0 -2px 0 rgba(0, 0, 0, 0.5), inset -2px 0 0 rgba(0, 0, 0, 0.5)',
}

/** MC 风格菜单按钮：黑描边、上/左亮下/右暗的四边斜面、悬停白描边;原版按下无视觉位移故不做按压变形。 */
export function PixielButton({ children, onClick, disabled }: PixielButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="
        pixel-text flex h-[50px] w-[400px] items-center justify-center
        border-2 border-black bg-[#707070] px-6 text-[24px] text-white
        select-none
        hover:border-white hover:bg-[#767676]
        focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white
        disabled:pointer-events-none disabled:bg-[#2d2d2d] disabled:text-neutral-400
      "
      style={{ boxShadow: disabled ? BEVEL.disabled : BEVEL.enabled }}
    >
      {children}
    </button>
  )
}
