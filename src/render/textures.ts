/**
 * 图集合成:把 4 张 16×16 方块贴图按 core/mesher 的 tile 序号拼成 2×2 CanvasTexture。
 * 草顶/草侧在 client 侧染原版平原绿(灰度贴图 × 色值,对齐 MC colormap 机制,见 docs/refs/minecraft.md §8)。
 */
import * as THREE from 'three'
import { ATLAS_COLS, ATLAS_ROWS } from '../core/mesher'

export const PLAINS_GREEN = '#91bd59'

type ImageResources = {
  top: HTMLImageElement
  side: HTMLImageElement
  sideOverlay: HTMLImageElement
  dirt: HTMLImageElement
  stone: HTMLImageElement
}

function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`材质加载失败:${path}`))
    img.src = path
  })
}

/** 灰度叠加层染色:multiply 上色,再 destination-in 恢复透明区域(复用自原演示场景) */
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

function texFromCanvas(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace // 颜色贴图须 sRGB,否则画面发灰
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter // 不用 mipmap,避免 2×2 图集跨 tile 采样串色
  tex.needsUpdate = true
  return tex
}

/** 组装草侧叠加层(底图 + 染绿草皮),缩放到 tile 尺寸 */
function grassSide(res: ImageResources, px: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(res.side, 0, 0, px, px)
  ctx.drawImage(tinted(res.sideOverlay, PLAINS_GREEN), 0, 0, px, px)
  return canvas
}

/** 图集 canvas 尺寸,各 tile 位置由 tile 序号换算(与 core/mesher.tileUv 同格序) */
export function atlasCanvas(res: ImageResources, px: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = px * ATLAS_COLS
  canvas.height = px * ATLAS_ROWS
  const ctx = canvas.getContext('2d')!

  // tile 序号 → canvas 像素位置(col 向右,row 向上:canvas y 越大越往下)
  const place = (tile: number, img: CanvasImageSource): void => {
    const col = tile % ATLAS_COLS
    const row = Math.floor(tile / ATLAS_COLS)
    const dx = col * px
    const dy = px * ATLAS_ROWS - (row + 1) * px
    ctx.drawImage(img, dx, dy, px, px)
  }

  place(0, tinted(res.top, PLAINS_GREEN)) // 草顶
  place(1, grassSide(res, px)) // 草侧
  place(2, res.dirt) // 泥土
  place(3, res.stone) // 石头
  return canvas
}

/** 图集 tile 边长(源贴图原始 16×16) */
const TILE_PX = 16

/** 加载 4 张源图并合成图集(异步:贴图就绪前 mesh 不进场景) */
export async function buildGrassAtlas(): Promise<{ texture: THREE.CanvasTexture; dispose(): void }> {
  const [top, side, sideOverlay, dirt, stone] = await Promise.all([
    loadImage('/textures/block/grass_block_top.png'),
    loadImage('/textures/block/grass_block_side.png'),
    loadImage('/textures/block/grass_block_side_overlay.png'),
    loadImage('/textures/block/dirt.png'),
    loadImage('/textures/block/stone.png'),
  ])
  return { texture: texFromCanvas(atlasCanvas({ top, side, sideOverlay, dirt, stone }, TILE_PX)), dispose: () => {} }
}
