import type { ReactNode } from 'react'

/** PixielButton 的属性。 */
interface PixielButtonProps {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}

/** 像素风菜单按钮：统一宽度、明暗内嵌边框、按压反馈与禁用态，供各菜单共用。 */
export function PixielButton({ children, onClick, disabled }: PixielButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="
        pixel-text flex h-[50px] w-72 items-center justify-center
        border-2 border-black bg-neutral-600 px-6 text-[18px] text-neutral-100
        select-none
        hover:bg-neutral-500
        focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white
        active:translate-y-0.5
        disabled:pointer-events-none disabled:bg-neutral-800 disabled:text-neutral-500
      "
      style={
        disabled
          ? { boxShadow: 'none' }
          : {
              boxShadow: 'inset 0 2px 0 rgba(255, 255, 255, 0.22), inset 0 -4px 0 rgba(0, 0, 0, 0.4)',
            }
      }
    >
      {children}
    </button>
  )
}
