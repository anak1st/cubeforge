import * as THREE from 'three'

/** 贴图清单:语义键 → public/ 下的路径;新增方块贴图只改这里 */
const MANIFEST = {
  grassTop: 'textures/block/grass_block_top.png',
  grassSide: 'textures/block/grass_block_side.png',
  grassSideOverlay: 'textures/block/grass_block_side_overlay.png',
  dirt: 'textures/block/dirt.png',
} as const

/** 贴图语义键 */
export type TextureKey = keyof typeof MANIFEST

/** 单张贴图的加载结果:GPU 纹理 + 原始图像源(图像源供画布合成,如草侧面双层) */
export interface LoadedTexture {
  texture: THREE.Texture
  source: HTMLImageElement | HTMLCanvasElement
}

/** 加载完成的贴图集;失败键的 texture/source 为生成的紫黑棋盘 */
export type TextureSet = Record<TextureKey, LoadedTexture>

/** 把图像源升格为纹理:统一 sRGB 色彩空间 + NearestFilter 像素采样(全项目唯一出口) */
export function textureFrom(src: HTMLImageElement | HTMLCanvasElement): THREE.Texture {
  const tex = new THREE.Texture(src)
  tex.colorSpace = THREE.SRGBColorSpace // 颜色贴图必须声明 sRGB,否则 r152+ 下画面发灰
  tex.magFilter = THREE.NearestFilter // 16×16 像素风:放大保持锐利
  tex.minFilter = THREE.NearestFilter
  tex.needsUpdate = true
  return tex
}

/** 给灰度贴图染色:multiply 上色,destination-in 恢复透明区域 */
export function tinted(
  src: HTMLImageElement | HTMLCanvasElement,
  color: string,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = src.width
  canvas.height = src.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(src, 0, 0)
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(src, 0, 0)
  return canvas
}

/** 缺失贴图:16×16 紫黑棋盘(8px 象限,MC 同款),全项目单例 */
let missing: LoadedTexture | undefined

function missingTexture(): LoadedTexture {
  if (!missing) {
    const canvas = document.createElement('canvas')
    canvas.width = 16
    canvas.height = 16
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = '#f800f8'
    ctx.fillRect(0, 0, 8, 8)
    ctx.fillRect(8, 8, 8, 8)
    missing = { texture: textureFrom(canvas), source: canvas }
  }
  return missing
}

/** 加载单张图像(public/ 下的绝对路径) */
function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`材质加载失败:${path}`))
    img.src = path
  })
}

/**
 * 按清单加载全部贴图。逐张独立降级:单张失败 → 该键替换为紫黑棋盘
 * 并 console.warn,不影响其余键,永不 reject。
 */
export async function loadTextures(): Promise<TextureSet> {
  const keys = Object.keys(MANIFEST) as TextureKey[]
  const entries = await Promise.all(
    keys.map(async (key): Promise<[TextureKey, LoadedTexture]> => {
      try {
        const image = await loadImage(MANIFEST[key])
        return [key, { texture: textureFrom(image), source: image }]
      } catch (err: unknown) {
        console.warn('[cubeforge] 贴图缺失,已用紫黑棋盘替代:', MANIFEST[key], err)
        return [key, missingTexture()]
      }
    }),
  )
  return Object.fromEntries(entries) as TextureSet
}
