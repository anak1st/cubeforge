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
  isSolid,
  isTransparent,
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

  it('属性抽查:石头实心不透明,树叶实心但透明,水非固体', () => {
    expect(isSolid(BLOCK_STONE)).toBe(true)
    expect(isTransparent(BLOCK_STONE)).toBe(false)
    expect(isSolid(BLOCK_LEAVES)).toBe(true)
    expect(isTransparent(BLOCK_LEAVES)).toBe(true)
    expect(isSolid(BLOCK_WATER)).toBe(false)
    expect(isTransparent(BLOCK_WATER)).toBe(true)
  })

  it('未注册的 id / 名字查询抛错', () => {
    expect(() => blockName(BLOCK_COUNT)).toThrow(RangeError)
    expect(() => blockName(-1)).toThrow(RangeError)
    expect(() => blockName(1.5)).toThrow(RangeError)
    expect(() => blockId('gold')).toThrow(RangeError)
  })
})
