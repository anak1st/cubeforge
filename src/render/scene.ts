import * as THREE from 'three'
import { BLOCK_GRASS } from '@/core/blocks'
import { materialsForBlock, type TextureSet } from './textures'

/** 演示场景句柄: 绘制一帧, 切换方块, 释放资源. */
export interface DemoScene {
  /** 应用旋转角并渲染一帧. */
  render(rot: { x: number; y: number }): void
  /** 切换演示方块(按注册表 id 重建六面材质). */
  setBlock(id: number): void
  /** 移除窗口监听, 释放全部 GPU 资源. */
  dispose(): void
}

/** 创建演示场景(黑底 + 可旋转贴图方块), 初始方块默认草方块; 贴图集随场景同生命周期. */
export function createDemoScene(
  canvas: HTMLCanvasElement,
  textures: TextureSet,
  blockId: number = BLOCK_GRASS,
): DemoScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)) // 高分屏上限 2: 再高只烧性能
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

  // 环境光打底, 平行光造面与面之间的明暗差
  scene.add(new THREE.AmbientLight(0xffffff, 0.6))
  const sun = new THREE.DirectionalLight(0xffffff, 2) // r155+ 物理光照, 强度是线性倍率
  sun.position.set(5, 10, 7) // 平行光只取方向, 位置远近不影响亮度
  scene.add(sun)

  let block = materialsForBlock(blockId, textures)
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), block.materials)
  scene.add(cube)

  // 视口变化: 同步相机纵横比与绘制缓冲尺寸
  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }
  window.addEventListener('resize', onResize)

  return {
    render(rot) {
      cube.rotation.x = rot.x
      cube.rotation.y = rot.y
      renderer.render(scene, camera)
    },
    setBlock(id: number): void {
      const next = materialsForBlock(id, textures)
      cube.material = next.materials
      block.dispose()
      block = next
    },
    dispose(): void {
      window.removeEventListener('resize', onResize)
      block.dispose()
      for (const tex of Object.values(textures)) tex.texture.dispose()
      cube.geometry.dispose()
      renderer.dispose()
    },
  }
}
