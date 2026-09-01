import { describe, expect, it } from 'vitest'
import { BLOCK_AIR, BLOCK_DIRT, BLOCK_GRASS, BLOCK_LEAVES, BLOCK_STONE } from './blocks'
import {
  buildChunkMesh,
  tileFor,
  TILE_DIRT,
  TILE_GRASS_SIDE,
  TILE_GRASS_TOP,
  TILE_STONE,
  type MeshData,
} from './mesher'

type Getter = (x: number, y: number, z: number) => number

/** 用坐标 → id 的 Map 构造 getBlock,缺省返回空气(等价于"越界=空气") */
function getter(blocks: ReadonlyMap<string, number>): Getter {
  return (x, y, z) => blocks.get(`${x},${y},${z}`) ?? BLOCK_AIR
}
function put(m: Map<string, number>, x: number, y: number, z: number, id: number): void {
  m.set(`${x},${y},${z}`, id)
}

/** 统计网格里法向为 (nx,ny,nz) 的面数 */
function countFaces(data: MeshData, nx: number, ny: number, nz: number): number {
  let n = 0
  for (let i = 0; i < data.positions.length; i += 12) {
    if (data.normals[i] === nx && data.normals[i + 1] === ny && data.normals[i + 2] === nz) n++
  }
  return n
}

/** 收集网格所有顶点(每顶点 3 坐标),用于判定某平面是否有面 */
function vertices(data: MeshData): ReadonlyArray<[number, number, number]> {
  const out: Array<[number, number, number]> = []
  for (let i = 0; i < data.positions.length; i += 3) {
    out.push([data.positions[i], data.positions[i + 1], data.positions[i + 2]])
  }
  return out
}

describe('tileFor 图集格子映射', () => {
  it('grass:顶面草顶、底面泥土、侧面草侧', () => {
    expect(tileFor(BLOCK_GRASS, 2)).toBe(TILE_GRASS_TOP) // +y
    expect(tileFor(BLOCK_GRASS, 3)).toBe(TILE_DIRT) // -y
    expect(tileFor(BLOCK_GRASS, 0)).toBe(TILE_GRASS_SIDE)
    expect(tileFor(BLOCK_GRASS, 5)).toBe(TILE_GRASS_SIDE)
  })
  it('dirt/stone 六面同格;air 与未注册 face 返回 -1', () => {
    for (let f = 0; f < 6; f++) {
      expect(tileFor(BLOCK_DIRT, f)).toBe(TILE_DIRT)
      expect(tileFor(BLOCK_STONE, f)).toBe(TILE_STONE)
    }
    expect(tileFor(BLOCK_AIR, 0)).toBe(-1)
  })
})

describe('buildChunkMesh 面剔除', () => {
  it('空 chunk 不产生任何面', () => {
    const data = buildChunkMesh(getter(new Map()))
    expect(data.indices.length).toBe(0)
    expect(data.positions.length).toBe(0)
  })

  it('单个 stone 方块恰好 6 面(空气邻居全不剔除)', () => {
    const m = new Map<string, number>()
    put(m, 0, 0, 0, BLOCK_STONE)
    const data = buildChunkMesh(getter(m))
    expect(data.indices.length / 6).toBe(6)
    expect(countFaces(data, 1, 0, 0)).toBe(1)
    expect(countFaces(data, -1, 0, 0)).toBe(1)
    expect(countFaces(data, 0, 1, 0)).toBe(1)
    expect(countFaces(data, 0, -1, 0)).toBe(1)
    expect(countFaces(data, 0, 0, 1)).toBe(1)
    expect(countFaces(data, 0, 0, -1)).toBe(1)
  })

  it('两相邻 stone 共享面被剔除:共 10 面,+x 与 -x 各只剩 1 而非 2', () => {
    const m = new Map<string, number>()
    put(m, 0, 0, 0, BLOCK_STONE)
    put(m, 1, 0, 0, BLOCK_STONE)
    const data = buildChunkMesh(getter(m))
    expect(data.indices.length / 6).toBe(10)
    expect(countFaces(data, 1, 0, 0)).toBe(1)
    expect(countFaces(data, -1, 0, 0)).toBe(1)
  })

  it('透明邻居(leaves)不剔除 stone 的面,x=1 保留顶点', () => {
    const m = new Map<string, number>()
    put(m, 0, 0, 0, BLOCK_STONE)
    put(m, 1, 0, 0, BLOCK_LEAVES)
    const data = buildChunkMesh(getter(m))
    expect(vertices(data).some(([x]) => x === 1)).toBe(true)
  })
})

describe('buildChunkMesh 法线与 uv', () => {
  it('grass 方块:+y 面法线朝上且 uv 落在草顶格(左下 0..0.5)', () => {
    const m = new Map<string, number>()
    put(m, 0, 0, 0, BLOCK_GRASS)
    const data = buildChunkMesh(getter(m))
    let topFaces = 0
    for (let i = 0; i < data.positions.length; i += 12) {
      if (data.normals[i] === 0 && data.normals[i + 1] === 1 && data.normals[i + 2] === 0) {
        topFaces++
        // 该面 4 顶点的 uv(u,v) 应全在草顶格 [0,0.5]×[0,0.5]
        for (let k = 0; k < 4; k++) {
          const u = data.uvs[i / 3 * 2 + k * 2]
          const v = data.uvs[i / 3 * 2 + k * 2 + 1]
          expect(u).toBeGreaterThanOrEqual(0)
          expect(u).toBeLessThanOrEqual(0.5)
          expect(v).toBeGreaterThanOrEqual(0)
          expect(v).toBeLessThanOrEqual(0.5)
        }
      }
    }
    expect(topFaces).toBe(1)
  })

  it('grass 侧面 uv 落在草侧格(u ≥ 0.5)且朝向正确的面', () => {
    const m = new Map<string, number>()
    put(m, 0, 0, 0, BLOCK_GRASS)
    const data = buildChunkMesh(getter(m))
    // +x 面(法向 1,0,0)的 uv u 应 ≥ 0.5(草侧在右列)
    let found = false
    for (let i = 0; i < data.positions.length; i += 12) {
      if (data.normals[i] === 1 && data.normals[i + 1] === 0 && data.normals[i + 2] === 0) {
        const u0 = data.uvs[(i / 3) * 2]
        expect(u0).toBeGreaterThanOrEqual(0.5)
        found = true
      }
    }
    expect(found).toBe(true)
  })
})
