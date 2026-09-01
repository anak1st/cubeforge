/**
 * 世界场景:在给定 canvas 上建起 renderer/scene/camera/灯光与单个 chunk 网格。
 * 相机归 game/CameraController 驱动;本模块只负责 three 装配与渲染,canvas 归 React 所属,不碰 DOM 事件。
 */
import * as THREE from 'three'
import { buildChunkMesh } from '../core/mesher'
import { buildChunkGeometry } from './chunkMesh'
import { buildGrassAtlas } from './textures'

export interface WorldScene {
  camera: THREE.PerspectiveCamera
  renderFrame(timeMs: number): void
  dispose(): void
}

/**
 * @param getBlock 世界坐标 → 方块 id(Core 世界访问器,越界返回空气),供网格化采样。
 */
export function createWorldScene(
  canvas: HTMLCanvasElement,
  getBlock: (x: number, y: number, z: number) => number,
): WorldScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x87ceeb) // 天空淡蓝
  scene.fog = new THREE.Fog(0x87ceeb, 40, 90)

  const camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  )
  camera.position.set(7.5, 14, 26)
  camera.lookAt(7.5, 3, 7.5)

  // 灯光:环境光保底,平行光带明暗;强度用 r155+ 物理光照的线性倍率
  scene.add(new THREE.AmbientLight(0xffffff, 0.6))
  const sun = new THREE.DirectionalLight(0xffffff, 2)
  sun.position.set(12, 20, 10)
  scene.add(sun)

  const disposables: { dispose(): void }[] = []
  let disposed = false
  let mesh: THREE.Mesh | undefined

  // 图集异步合成,就绪后把 chunk 网格装进场景(网格生成是纯函数,core 侧)
  void buildGrassAtlas()
    .then(({ texture }) => {
      if (disposed) {
        texture.dispose()
        return
      }
      const geometry = buildChunkGeometry(buildChunkMesh(getBlock))
      const material = new THREE.MeshLambertMaterial({ map: texture })
      mesh = new THREE.Mesh(geometry, material)
      disposables.push(geometry, material, texture)
      scene.add(mesh)
    })
    .catch((err: unknown) => {
      console.error('[cubeforge]', err)
    })

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }
  window.addEventListener('resize', onResize)

  return {
    camera,
    renderFrame(): void {
      renderer.render(scene, camera)
    },
    dispose() {
      disposed = true
      window.removeEventListener('resize', onResize)
      if (mesh) scene.remove(mesh)
      for (const d of disposables) d.dispose()
      renderer.dispose()
    },
  }
}
