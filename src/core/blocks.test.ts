import { describe, expect, it } from 'vitest'
import {
  BLOCK_AIR,
  BLOCK_COUNT,
  BLOCK_DEFS,
  BLOCK_LEAVES,
  BLOCK_STONE,
  BLOCK_WATER,
  blockId,
  blockName,
  canOcclude,
  hasCollision,
} from './blocks'

describe('方块注册表', () => {
  it('0 号恒为 air,七个占位方块全部注册', () => {
    expect(blockName(BLOCK_AIR)).toBe('air')
    for (const name of ['air', 'stone', 'dirt', 'grass', 'sand', 'leaves', 'water']) {
      expect(blockId(name)).toBeGreaterThanOrEqual(0)
    }
    expect(BLOCK_DEFS.length).toBeGreaterThanOrEqual(7)
  })

  it('id ↔ 名字双向映射往返一致', () => {
    for (let id = 0; id < BLOCK_COUNT; id++) {
      expect(blockId(blockName(id))).toBe(id)
    }
  })

  it('方块名唯一', () => {
    const names = BLOCK_DEFS.map((def) => def.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('属性抽查:石头碰撞且遮挡,树叶碰撞但不遮挡,水既不碰撞也不遮挡', () => {
    expect(hasCollision(BLOCK_STONE)).toBe(true)
    expect(canOcclude(BLOCK_STONE)).toBe(true)
    expect(hasCollision(BLOCK_LEAVES)).toBe(true)
    expect(canOcclude(BLOCK_LEAVES)).toBe(false)
    expect(hasCollision(BLOCK_WATER)).toBe(false)
    expect(canOcclude(BLOCK_WATER)).toBe(false)
  })

  it('destroyTime 对齐 MC 官方注册值,不可破坏为负', () => {
    const byId = new Map(BLOCK_DEFS.map((d) => [d.name, d.destroyTime]))
    expect(byId.get('stone')).toBe(1.5)
    expect(byId.get('grass')).toBe(0.6)
    expect(byId.get('dirt')).toBe(0.5)
    expect(byId.get('sand')).toBe(0.5)
    expect(byId.get('leaves')).toBe(0.2)
    expect(byId.get('water')).toBeLessThan(0) // MC 水为流体,我们用负数标记不可破坏
  })

  it('未注册的 id / 名字查询抛错', () => {
    expect(() => blockName(BLOCK_COUNT)).toThrow(RangeError)
    expect(() => blockName(-1)).toThrow(RangeError)
    expect(() => blockName(1.5)).toThrow(RangeError)
    expect(() => blockId('gold')).toThrow(RangeError)
  })
})
