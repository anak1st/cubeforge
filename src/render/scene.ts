import * as THREE from 'three'

/**
 * 在给定 canvas 上创建演示场景：黑底 + 单个自转方块（docs/plan.md M1 的临时展示物）。
 * 返回释放函数：回收全部 GPU 资源与监听器；canvas 本身归 React 所有，此处不碰 DOM。
 */
export function createDemoScene(canvas: HTMLCanvasElement): () => void {
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

  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const material = new THREE.MeshLambertMaterial({ color: 0x44aa44 })
  const cube = new THREE.Mesh(geometry, material)
  scene.add(cube)

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }
  window.addEventListener('resize', onResize)

  renderer.setAnimationLoop((time) => {
    cube.rotation.y = time * 0.0004 // time 为毫秒；缓慢自转证明是实时 3D 而非贴图
    renderer.render(scene, camera)
  })

  return () => {
    renderer.setAnimationLoop(null)
    window.removeEventListener('resize', onResize)
    geometry.dispose()
    material.dispose()
    renderer.dispose()
  }
}
