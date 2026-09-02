import type { ReactNode, Ref } from 'react'

/** MenuButton 的属性。 */
interface MenuButtonProps {
  children: ReactNode
  onClick: () => void
  autoFocus?: boolean
  disabled?: boolean
  ref?: Ref<HTMLButtonElement>
}

/** 像素风菜单按钮：统一宽度、明暗内嵌边框、按压反馈与禁用态，供各菜单共用。 */
export function MenuButton({ children, onClick, autoFocus, disabled, ref }: MenuButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      autoFocus={autoFocus}
      disabled={disabled}
      ref={ref}
      className="
        w-72 border-2 border-black bg-neutral-600
        px-6 py-2.5 text-lg font-semibold tracking-wider text-neutral-100
        select-none
        hover:bg-neutral-500
        focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white
        active:translate-y-0.5
        disabled:pointer-events-none disabled:bg-neutral-800 disabled:text-neutral-500
      "
      style={
        disabled
          ? { boxShadow: 'none', textShadow: 'none' }
          : {
              textShadow: '2px 2px 0 rgba(0, 0, 0, 0.6)',
              boxShadow: 'inset 0 2px 0 rgba(255, 255, 255, 0.22), inset 0 -4px 0 rgba(0, 0, 0, 0.4)',
            }
      }
    >
      {children}
    </button>
  )
}
