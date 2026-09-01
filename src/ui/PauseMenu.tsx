// 暂停菜单:ESC(浏览器退锁)时浮现,可继续游戏或返回开始菜单。
export function PauseMenu({ onResume, onMenu }: { onResume: () => void; onMenu: () => void }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-8 bg-black/50">
      <h2 className="text-3xl font-bold tracking-widest text-neutral-100 select-none">已暂停</h2>
      <div className="flex flex-col gap-3">
        <button
          onClick={onResume}
          className="rounded bg-neutral-200 px-8 py-3 text-lg font-semibold text-neutral-900 hover:bg-white active:scale-95"
        >
          继续
        </button>
        <button
          onClick={onMenu}
          className="rounded bg-neutral-700 px-8 py-3 text-lg font-semibold text-neutral-100 hover:bg-neutral-600 active:scale-95"
        >
          返回菜单
        </button>
      </div>
    </div>
  )
}
