import { describe, expect, it } from 'vitest'
import {
  BLOCK_AIR,
  BLOCK_DIRT,
  BLOCK_GRASS,
  BLOCK_LEAVES,
  BLOCK_SAND,
  BLOCK_STONE,
  BLOCK_WATER,
} from './blocks'
import { chunkCoord } from './chunk'
import { World } from './world'

describe('World 跨 chunk 寻址', () => {
  it('空世界读取返回约定值 air(缺失 chunk)', () => {
    const world = new World()
    expect(world.getBlock(0, 0, 0)).toBe(BLOCK_AIR)
    expect(world.getBlock(-123, 45, -678)).toBe(BLOCK_AIR)
  })

  it('缺失 chunk 上 setBlock 抛错而非静默丢弃', () => {
    const world = new World()
    expect(() => world.setBlock(0, 0, 0, BLOCK_STONE)).toThrow(/未加载/)
  })

  it('ensureChunk 后写入,同坐标读回一致', () => {
    const world = new World()
    world.ensureChunk(0, 0, 0)
    world.setBlock(5, 6, 7, BLOCK_STONE)
    expect(world.getBlock(5, 6, 7)).toBe(BLOCK_STONE)
  })

  it('x=15 与 x=16 相邻但属于不同 chunk,互不覆盖', () => {
    const world = new World()
    world.ensureChunk(0, 0, 0)
    world.ensureChunk(1, 0, 0)
    world.setBlock(15, 0, 0, BLOCK_DIRT)
    world.setBlock(16, 0, 0, BLOCK_GRASS)
    expect(world.getBlock(15, 0, 0)).toBe(BLOCK_DIRT)
    expect(world.getBlock(16, 0, 0)).toBe(BLOCK_GRASS)
    expect(world.getChunk(0, 0, 0)!.get(15, 0, 0)).toBe(BLOCK_DIRT)
    expect(world.getChunk(1, 0, 0)!.get(0, 0, 0)).toBe(BLOCK_GRASS)
  })

  it('负数世界坐标落到负数 chunk 的正确局部格', () => {
    const world = new World()
    world.ensureChunk(-1, -1, -1)
    // (-1,…,-1) 与 (-16,…,-16) 同属 chunk(-1,-1,-1),分别是局部 (15,15,15) 与 (0,0,0)
    world.setBlock(-1, -1, -1, BLOCK_STONE)
    world.setBlock(-16, -16, -16, BLOCK_DIRT)
    expect(world.getBlock(-1, -1, -1)).toBe(BLOCK_STONE)
    expect(world.getBlock(-16, -16, -16)).toBe(BLOCK_DIRT)
    expect(world.getChunk(-1, -1, -1)!.get(15, 15, 15)).toBe(BLOCK_STONE)
    expect(world.getChunk(-1, -1, -1)!.get(0, 0, 0)).toBe(BLOCK_DIRT)
    // (-17,…) 落在 chunk(-2,-1,-1),未创建 → air
    expect(world.getBlock(-17, -1, -1)).toBe(BLOCK_AIR)
  })

  it('三轴同时跨界的 8 个 chunk 互不串扰', () => {
    const world = new World()
    for (const cx of [-1, 0]) {
      for (const cy of [-1, 0]) {
        for (const cz of [-1, 0]) world.ensureChunk(cx, cy, cz)
      }
    }
    const corners: ReadonlyArray<readonly [number, number, number, number]> = [
      [-1, -1, -1, BLOCK_STONE],
      [15, -1, -1, BLOCK_DIRT],
      [-1, 15, -1, BLOCK_GRASS],
      [-1, -1, 15, BLOCK_SAND],
      [15, 15, -1, BLOCK_LEAVES],
      [15, -1, 15, BLOCK_WATER],
      [-1, 15, 15, BLOCK_STONE],
      [15, 15, 15, BLOCK_DIRT],
    ]
    for (const [x, y, z, id] of corners) world.setBlock(x, y, z, id)
    for (const [x, y, z, id] of corners) {
      expect(world.getBlock(x, y, z)).toBe(id)
    }
    // 8 个角之外的格仍未被波及
    expect(world.getBlock(14, 15, 15)).toBe(BLOCK_AIR)
    expect(world.getBlock(0, 0, 0)).toBe(BLOCK_AIR)
  })

  it('getChunk 与 getBlock 寻址同一 chunk', () => {
    const world = new World()
    const chunk = world.ensureChunk(chunkCoord(100), 0, chunkCoord(-33))
    expect(world.getChunk(6, 0, -3)).toBe(chunk)
    world.setBlock(100, 0, -33, BLOCK_STONE)
    expect(chunk.get(4, 0, 15)).toBe(BLOCK_STONE)
  })

  it('非法输入抛错:非整数坐标、NaN、未注册 id', () => {
    const world = new World()
    world.ensureChunk(0, 0, 0)
    expect(() => world.getBlock(1.5, 0, 0)).toThrow(RangeError)
    expect(() => world.setBlock(0, Number.NaN, 0, BLOCK_STONE)).toThrow(RangeError)
    expect(() => world.setBlock(0, 0, 0, 999)).toThrow(RangeError)
    expect(() => world.setBlock(0, 0, 0, -1)).toThrow(RangeError)
  })
})
