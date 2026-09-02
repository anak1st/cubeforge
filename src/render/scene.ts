import * as THREE from 'three'
import { BLOCK_GRASS } from '../core/blocks'
import { materialsForBlock, type TextureSet } from './textures'

/** 演示场景控制句柄。 */
export interface DemoScene {
  /** 设置方块是否自转;渲染循环持续运行。 */
  setRunning(running: boolean): void
  /** 切换演示方块(按注册表 id 重建六面材质)。 */
  setBlock(id: number): void
  /** 停止渲染循环,移除窗口监听,释放全部 GPU 资源。 */
  dispose(): void
}

/**
 * 创建演示场景(黑底 + 双轴自转的贴图方块)并启动渲染循环,初始方块默认草方块。
 * 贴图集随场景同生命周期,dispose 时一并释放。
 */
export function createDemoScene(
  canvas: HTMLCanvasElement,
  textures: TextureSet,
  blockId: number = BLOCK_GRASS,
): DemoScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)) // 高分屏上限 2:再高只烧性能
  renderer.setSize(window.innerWidth, window.innerHeight)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)

  const camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  )
  camera.position.set(3, 3, 3)
  camera.lookAt(0, 0, 0)

  // 灯光不是"看见方块"的必需品,是"看出六个面明暗"的必需品
  scene.add(new THREE.AmbientLight(0xffffff, 0.6))
  const sun = new THREE.DirectionalLight(0xffffff, 2) // r155+ 物理光照,强度是线性倍率
  sun.position.set(5, 10, 7) // 平行光只取方向,位置远近不影响亮度
  scene.add(sun)

  let block = materialsForBlock(blockId, textures)
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), block.materials)
  scene.add(cube)

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }
  window.addEventListener('resize', onResize)

  let running = true
  let lastTime = 0
  renderer.setAnimationLoop((time) => {
    if (lastTime === 0) lastTime = time
    const dt = Math.min(time - lastTime, 50) // 页面隐藏时 rAF 停摆,恢复帧 dt 截断,自转不突进
    lastTime = time
    if (running) {
      cube.rotation.y += dt * 0.0004
      cube.rotation.x += dt * 0.00015 // 双轴慢滚:顶面、侧面、底面都能被看到
    }
    renderer.render(scene, camera) // 暂停时冻结自转但保持渲染,对齐 MC 暂停观感
  })

  return {
    setRunning(value: boolean): void {
      running = value
    },
    setBlock(id: number): void {
      const next = materialsForBlock(id, textures)
      cube.material = next.materials
      block.dispose()
      block = next
    },
    dispose(): void {
      renderer.setAnimationLoop(null)
      window.removeEventListener('resize', onResize)
      block.dispose()
      for (const tex of Object.values(textures)) tex.texture.dispose()
      cube.geometry.dispose()
      renderer.dispose()
    },
  }
}
