import * as THREE from 'three'
import { BLOCK_DIRT, BLOCK_GRASS, BLOCK_STONE } from '@/core/blocks'

// 草顶染色: 原版平原生物群系草色
const PLAINS_GREEN = '#91bd59'

/** 贴图清单: 语义键 → public/ 下的路径; 新增方块贴图只改这里 */
const MANIFEST = {
  grassTop: 'textures/block/grass_block_top.png',
  grassSide: 'textures/block/grass_block_side.png',
  grassSideOverlay: 'textures/block/grass_block_side_overlay.png',
  dirt: 'textures/block/dirt.png',
  stone: 'textures/block/stone.png',
} as const

/** 贴图语义键 */
export type TextureKey = keyof typeof MANIFEST

/** 单张贴图的加载结果: GPU 纹理 + 原始图像源(图像源供画布合成, 如草侧面双层) */
export interface LoadedTexture {
  texture: THREE.Texture
  source: HTMLImageElement | HTMLCanvasElement
}

/** 加载完成的贴图集; 失败键的 texture/source 为生成的紫黑棋盘 */
export type TextureSet = Record<TextureKey, LoadedTexture>

/** 把图像源升格为纹理: 统一 sRGB 色彩空间 + NearestFilter 像素采样(全项目唯一出口) */
export function textureFrom(src: HTMLImageElement | HTMLCanvasElement): THREE.Texture {
  const tex = new THREE.Texture(src)
  tex.colorSpace = THREE.SRGBColorSpace // 颜色贴图必须声明 sRGB, 否则 r152+ 下画面发灰
  tex.magFilter = THREE.NearestFilter // 16×16 像素风: 放大保持锐利
  tex.minFilter = THREE.NearestFilter
  tex.needsUpdate = true
  return tex
}

/** 给灰度贴图染色: multiply 上色, destination-in 恢复透明区域 */
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

/** 缺失贴图: 16×16 紫黑棋盘(8px 象限), 模块级单例 */
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
 * 按清单加载全部贴图. 逐张独立降级: 单张失败 → 该键替换为紫黑棋盘
 * 并 console.warn, 不影响其余键, 永不 reject.
 */
export async function loadTextures(): Promise<TextureSet> {
  const keys = Object.keys(MANIFEST) as TextureKey[]
  const entries = await Promise.all(
    keys.map(async (key): Promise<[TextureKey, LoadedTexture]> => {
      try {
        const image = await loadImage(MANIFEST[key])
        return [key, { texture: textureFrom(image), source: image }]
      } catch (err: unknown) {
        console.warn('[cubeforge] 贴图缺失, 已用紫黑棋盘替代:', MANIFEST[key], err)
        return [key, missingTexture()]
      }
    }),
  )
  return Object.fromEntries(entries) as TextureSet
}

/** 单个方块的外观: 每面贴图键与染色. */
interface BlockAppearance {
  top: TextureKey
  side: TextureKey
  bottom: TextureKey
  /** 顶面染色: 材质色与贴图相乘(MC 生物群系色) */
  topTint?: string
  /** 侧面灰度叠加层: 染色后叠在 side 上(草皮沿口) */
  sideOverlay?: TextureKey
}

// 方块外观映射只在本层维护, core 注册表不含资源引用; 无映射的方块渲染为紫黑棋盘
const APPEARANCE: Record<number, BlockAppearance> = {
  [BLOCK_GRASS]: {
    top: 'grassTop',
    side: 'grassSide',
    bottom: 'dirt',
    topTint: PLAINS_GREEN,
    sideOverlay: 'grassSideOverlay',
  },
  [BLOCK_DIRT]: { top: 'dirt', side: 'dirt', bottom: 'dirt' },
  [BLOCK_STONE]: { top: 'stone', side: 'stone', bottom: 'stone' },
}

/** 方块六面材质组; dispose 释放本组新建的资源, 不碰贴图集与共享棋盘. */
export interface BlockMaterials {
  /** 材质槽顺序:+x -x +y -y +z -z */
  materials: THREE.MeshLambertMaterial[]
  dispose(): void
}

/** 生成方块六面材质; 未映射方块全面紫黑棋盘. */
export function materialsForBlock(id: number, set: TextureSet): BlockMaterials {
  const app = APPEARANCE[id]
  if (!app) {
    const mat = new THREE.MeshLambertMaterial({ map: missingTexture().texture })
    return { materials: [mat, mat, mat, mat, mat, mat], dispose: () => mat.dispose() }
  }

  // 侧面 = 底图 + 染色后的草皮叠加层, 两层合成草皮沿口
  const created: THREE.Texture[] = []
  let sideMap = set[app.side].texture
  if (app.sideOverlay) {
    const canvas = document.createElement('canvas')
    canvas.width = set[app.side].source.width
    canvas.height = set[app.side].source.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(set[app.side].source, 0, 0)
    ctx.drawImage(tinted(set[app.sideOverlay].source, PLAINS_GREEN), 0, 0)
    sideMap = textureFrom(canvas)
    created.push(sideMap)
  }

  const topMat = new THREE.MeshLambertMaterial({ map: set[app.top].texture })
  if (app.topTint) topMat.color.set(app.topTint)
  const sideMat = new THREE.MeshLambertMaterial({ map: sideMap })
  const bottomMat = new THREE.MeshLambertMaterial({ map: set[app.bottom].texture })
  return {
    materials: [sideMat, sideMat, topMat, bottomMat, sideMat, sideMat],
    dispose: () => {
      created.forEach((tex) => tex.dispose())
      topMat.dispose()
      sideMat.dispose()
      bottomMat.dispose()
    },
  }
}
