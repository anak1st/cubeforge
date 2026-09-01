import { describe, expect, it } from 'vitest'
import { BLOCK_AIR, BLOCK_DIRT, BLOCK_GRASS, BLOCK_STONE } from './blocks'
import { Chunk } from './chunk'
import { blockAt, generateDemoTerrain, GROUND_TOP } from './terrain'

describe('blockAt 分层映射', () => {
  it('GROUND_TOP 是草,往下 DIRT_DEPTH 层泥土,再往下是石头', () => {
    expect(blockAt(GROUND_TOP)).toBe(BLOCK_GRASS)
    expect(blockAt(GROUND_TOP - 1)).toBe(BLOCK_DIRT)
    expect(blockAt(GROUND_TOP - 2)).toBe(BLOCK_DIRT)
    expect(blockAt(GROUND_TOP - 3)).toBe(BLOCK_STONE)
    expect(blockAt(0)).toBe(BLOCK_STONE)
  })
})

describe('generateDemoTerrain 填充', () => {
  it('每列同剖面:草 → 泥土 → 石头 → 空气', () => {
    const chunk = generateDemoTerrain(new Chunk())
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        expect(chunk.get(x, GROUND_TOP, z)).toBe(BLOCK_GRASS)
        expect(chunk.get(x, GROUND_TOP - 1, z)).toBe(BLOCK_DIRT)
        expect(chunk.get(x, GROUND_TOP - 2, z)).toBe(BLOCK_DIRT)
        expect(chunk.get(x, 1, z)).toBe(BLOCK_STONE)
        expect(chunk.get(x, 0, z)).toBe(BLOCK_STONE)
        expect(chunk.get(x, GROUND_TOP + 1, z)).toBe(BLOCK_AIR)
        expect(chunk.get(x, 15, z)).toBe(BLOCK_AIR)
      }
    }
  })

  it('每个 y 层整行方块一致(无列间变异)', () => {
    const chunk = generateDemoTerrain(new Chunk())
    for (const y of [0, 1, GROUND_TOP - 1, GROUND_TOP]) {
      const expected = blockAt(y)
      for (let z = 0; z < 16; z++) {
        for (let x = 0; x < 16; x++) {
          expect(chunk.get(x, y, z)).toBe(expected)
        }
      }
    }
  })
})
