// 开始菜单:悬浮在画布之上,点击"开始游戏"进入世界并锁定指针。
export function StartMenu({ onStart }: { onStart: () => void }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-black/70">
      <h2 className="text-4xl font-bold tracking-widest text-neutral-100 select-none">cubeforge</h2>
      <button
        onClick={onStart}
        className="rounded bg-neutral-200 px-8 py-3 text-lg font-semibold text-neutral-900 hover:bg-white active:scale-95"
      >
        开始游戏
      </button>
      <p className="text-xs text-neutral-400 select-none">WASD 移动 · 空格上升 · Shift 下降 · ESC 暂停</p>
    </div>
  )
}
