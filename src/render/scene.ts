import * as THREE from 'three'
import { textureFrom, tinted, type TextureSet } from './textures'

// 原版草的颜色是生物群系色表在平原的采样值;M6 生物群系落地后再改为 colormap 采样
const PLAINS_GREEN = '#91bd59'

/** 演示场景控制句柄。 */
export interface DemoScene {
  /** 设置方块是否自转;渲染循环持续运行。 */
  setRunning(running: boolean): void
  /** 停止渲染循环,移除窗口监听,释放全部 GPU 资源。 */
  dispose(): void
}

/**
 * 创建演示场景(黑底 + 双轴自转的原版贴图草方块)并启动渲染循环。
 * 草方块三材质:顶面 = 贴图 × 平原色,侧面 = 底图 + 染色草皮层合成,底面 = dirt。
 * 贴图集随场景同生命周期,dispose 时一并释放。
 */
export function createDemoScene(canvas: HTMLCanvasElement, textures: TextureSet): DemoScene {
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

  // 侧面 = 底图 + 染色后的草皮叠加层(复刻原版 grass_block 模型的两层结构)
  const sideCanvas = document.createElement('canvas')
  sideCanvas.width = textures.grassSide.source.width
  sideCanvas.height = textures.grassSide.source.height
  const sideCtx = sideCanvas.getContext('2d')!
  sideCtx.drawImage(textures.grassSide.source, 0, 0)
  sideCtx.drawImage(tinted(textures.grassSideOverlay.source, PLAINS_GREEN), 0, 0)

  // BoxGeometry 材质槽顺序:+x -x +y -y +z -z
  const topMap = textures.grassTop.texture
  const sideMap = textureFrom(sideCanvas)
  const bottomMap = textures.dirt.texture
  const topMat = new THREE.MeshLambertMaterial({
    map: topMap,
    color: PLAINS_GREEN, // 材质色与贴图相乘 = 顶面染色
  })
  const sideMat = new THREE.MeshLambertMaterial({ map: sideMap })
  const bottomMat = new THREE.MeshLambertMaterial({ map: bottomMap })

  const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [
    sideMat,
    sideMat,
    topMat,
    bottomMat,
    sideMat,
    sideMat,
  ])
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
    dispose(): void {
      renderer.setAnimationLoop(null)
      window.removeEventListener('resize', onResize)
      topMap.dispose()
      sideMap.dispose()
      bottomMap.dispose()
      topMat.dispose()
      sideMat.dispose()
      bottomMat.dispose()
      cube.geometry.dispose()
      renderer.dispose()
    },
  }
}
