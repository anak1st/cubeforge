/**
 * 网格化:把 chunk 数据 → 顶点/索引数组(纯逻辑,不碰 three)。
 * 参照 MC SectionCompiler(src §7):逐方块 → 邻接面剔除 → 产出网格;透明方块只对不透明邻居剔面。
 * 邻居查询交给调用方 getBlock(可跨 chunk、可判越界=空气),本函数只做几何与剔除。
 */

import { BLOCK_AIR, canOcclude } from './blocks'
import { CHUNK_SIZE } from './chunk'

/** 网格产物的原始缓冲:position/normal 每顶点 3 分量,uv 2 分量,index 每面 6(2 三角) */
export interface MeshData {
  readonly positions: Float32Array
  readonly normals: Float32Array
  readonly uvs: Float32Array
  readonly indices: Uint32Array
}

/** 六个面的外向法向(顺序 = +x -x +y -y +z -z,与 three BoxGeometry 材质槽一致) */
const FACES: ReadonlyArray<{
  readonly normal: readonly [number, number, number]
  readonly corners: ReadonlyArray<readonly [number, number, number]>
  readonly uAxis: number
  readonly vAxis: number
}> = [
  { normal: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], uAxis: 2, vAxis: 1 }, // +x
  { normal: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], uAxis: 2, vAxis: 1 }, // -x
  { normal: [0, 1, 0], corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], uAxis: 0, vAxis: 2 }, // +y
  { normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], uAxis: 0, vAxis: 2 }, // -y
  { normal: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], uAxis: 0, vAxis: 1 }, // +z
  { normal: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], uAxis: 0, vAxis: 1 }, // -z
]

const TOP = 2 // +y
const BOTTOM = 3 // -y

/** 图集规格:2×2,四格依次为 草顶/草侧/泥土/石头。渲染层必须按此格序合成贴图。 */
export const TILE_GRASS_TOP = 0
export const TILE_GRASS_SIDE = 1
export const TILE_DIRT = 2
export const TILE_STONE = 3
export const ATLAS_COLS = 2
export const ATLAS_ROWS = 2
export const TILE_W = 1 / ATLAS_COLS
export const TILE_H = 1 / ATLAS_ROWS

/** 方块某面的图集格子:`{u0, v0}` 是该格左下角 UV 坐标(WebGL 约定 v 向上)。 */
export function tileUv(tile: number): { u0: number; v0: number } {
  const col = tile % ATLAS_COLS
  const row = Math.floor(tile / ATLAS_COLS)
  return { u0: col * TILE_W, v0: row * TILE_H }
}

/** 方块 + 面(下标 0..5) → 图集格子;未注册组合返回 -1(调用方应跳过) */
export function tileFor(blockId: number, face: number): number {
  switch (blockId) {
    case 3: // grass
      return face === TOP ? TILE_GRASS_TOP : face === BOTTOM ? TILE_DIRT : TILE_GRASS_SIDE
    case 2: // dirt
      return TILE_DIRT
    case 1: // stone
      return TILE_STONE
    default:
      return -1
  }
}

/**
 * 把 16³ chunk 网格化。origin 是该 chunk 的世界原点:局部坐标 (x,y,z) → 世界 (origin[0]+x, …)。
 * 默认 [0,0,0](本切片单 chunk 置于原点)。
 * getBlock 收到的是世界坐标,由调用方决定越界(应为空气)与跨 chunk 查询。
 */
export function buildChunkMesh(
  getBlock: (x: number, y: number, z: number) => number,
  origin: readonly [number, number, number] = [0, 0, 0],
): MeshData {
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const idx: number[] = []

  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const wx = origin[0] + x
        const wy = origin[1] + y
        const wz = origin[2] + z
        const id = getBlock(wx, wy, wz)
        if (id === BLOCK_AIR) continue

        for (let f = 0; f < 6; f++) {
          const face = FACES[f]
          const nb = getBlock(wx + face.normal[0], wy + face.normal[1], wz + face.normal[2])
          if (canOcclude(nb)) continue // 不透明(遮挡)邻居遮住本面

          const tile = tileFor(id, f)
          if (tile < 0) continue

          const base = pos.length / 3
          for (const corner of face.corners) {
            pos.push(wx + corner[0], wy + corner[1], wz + corner[2])
            nor.push(face.normal[0], face.normal[1], face.normal[2])
            const a = corner[face.uAxis]
            const b = corner[face.vAxis]
            uv.push(tileUv(tile).u0 + a * TILE_W, tileUv(tile).v0 + b * TILE_H)
          }
          idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
        }
      }
    }
  }

  return {
    positions: new Float32Array(pos),
    normals: new Float32Array(nor),
    uvs: new Float32Array(uv),
    indices: new Uint32Array(idx),
  }
}
