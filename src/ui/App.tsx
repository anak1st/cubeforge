import { SceneCanvas } from './SceneCanvas'

// 占位首页：黑底演示场景 + 标题角标。M7 将替换为正式主菜单（docs/plan.md）。
function App() {
  return (
    <main className="relative h-full overflow-hidden bg-black">
      <SceneCanvas />
      <h1 className="absolute left-4 top-3 text-sm font-medium tracking-widest text-neutral-500 select-none">
        cubeforge
      </h1>
    </main>
  )
}

export default App
