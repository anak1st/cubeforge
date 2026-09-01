import * as THREE from 'three'

// 原版草的颜色来自生物群系色表（colormap/grass.png）的平原采样值：灰度贴图 × 该色
const PLAINS_GREEN = '#91bd59'

function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`材质加载失败：${path}`))
    img.src = path
  })
}

function texFromImage(img: HTMLImageElement | HTMLCanvasElement): THREE.Texture {
  const tex = new THREE.Texture(img)
  tex.colorSpace = THREE.SRGBColorSpace // 颜色贴图必须声明 sRGB，否则 r152+ 下画面发灰
  tex.magFilter = THREE.NearestFilter // 16×16 像素风：放大保持锐利
  tex.minFilter = THREE.NearestFilter
  tex.needsUpdate = true
  return tex
}

// 给灰度叠加层染色：multiply 上色，destination-in 恢复透明区域
function tinted(img: HTMLImageElement, color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(img, 0, 0)
  return canvas
}

/** 演示场景的对外面：renderFrame 交由 game 层主循环驱动；dispose 回收全部 GPU 资源与监听器 */
export interface DemoScene {
  renderFrame(timeMs: number): void
  dispose(): void
}

/**
 * 在给定 canvas 上创建演示场景：黑底 + 自转的原版贴图草方块。
 * 场景不持有循环——canvas 本身归 React 所有，此处不碰 DOM。
 */
export function createDemoScene(canvas: HTMLCanvasElement): DemoScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)) // 高分屏上限 2：再高只烧性能
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

  // 灯光不是"看见方块"的必需品，是"看出六个面明暗"的必需品
  scene.add(new THREE.AmbientLight(0xffffff, 0.6))
  const sun = new THREE.DirectionalLight(0xffffff, 2) // r155+ 物理光照，强度是线性倍率
  sun.position.set(5, 10, 7) // 平行光只取方向，位置远近不影响亮度
  scene.add(sun)

  const disposables: { dispose(): void }[] = []
  let disposed = false
  let cube: THREE.Mesh | undefined

  // 贴图异步加载，就绪后再把方块加进场景（public/ 下的绝对路径）
  void Promise.all([
    loadImage('/textures/block/grass_block_top.png'),
    loadImage('/textures/block/grass_block_side.png'),
    loadImage('/textures/block/grass_block_side_overlay.png'),
    loadImage('/textures/block/dirt.png'),
  ])
    .then(([topImg, sideImg, overlayImg, dirtImg]) => {
      if (disposed) return

      // 侧面 = 底图 + 染色后的草皮叠加层（复刻原版 grass_block 模型的两层结构）
      const sideCanvas = document.createElement('canvas')
      sideCanvas.width = sideImg.width
      sideCanvas.height = sideImg.height
      const ctx = sideCanvas.getContext('2d')!
      ctx.drawImage(sideImg, 0, 0)
      ctx.drawImage(tinted(overlayImg, PLAINS_GREEN), 0, 0)

      // BoxGeometry 材质槽顺序：+x -x +y -y +z -z
      const topMap = texFromImage(topImg)
      const sideMap = texFromImage(sideCanvas)
      const bottomMap = texFromImage(dirtImg)
      const topMat = new THREE.MeshLambertMaterial({
        map: topMap,
        color: PLAINS_GREEN, // 材质色与贴图相乘 = 顶面染色
      })
      const sideMat = new THREE.MeshLambertMaterial({ map: sideMap })
      const bottomMat = new THREE.MeshLambertMaterial({ map: bottomMap })

      cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [
        sideMat,
        sideMat,
        topMat,
        bottomMat,
        sideMat,
        sideMat,
      ])
      disposables.push(topMap, sideMap, bottomMap, topMat, sideMat, bottomMat, cube.geometry)
      scene.add(cube)
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
    // 缓慢翻滚：顶面、侧面、底面都能被看到
    renderFrame(time: number): void {
      if (cube) {
        cube.rotation.y = time * 0.0004
        cube.rotation.x = time * 0.00015
      }
      renderer.render(scene, camera)
    },
    dispose() {
      disposed = true
      window.removeEventListener('resize', onResize)
      for (const d of disposables) d.dispose()
      renderer.dispose()
    },
  }
}
