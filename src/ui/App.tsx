import { FpsCounter } from './FpsCounter'
import { GameView } from './GameView'

// 占位首页：React 拥有页面壳——画布、标题、角标是平级兄弟；M7 的菜单也照此加入（docs/plan.md）。
function App() {
  return (
    <main className="relative h-full overflow-hidden bg-black">
      <GameView />
      <h1 className="absolute left-4 top-3 text-sm font-medium tracking-widest text-neutral-500 select-none">
        cubeforge
      </h1>
      <FpsCounter />
    </main>
  )
}

export default App
