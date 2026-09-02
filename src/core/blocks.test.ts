import { describe, expect, it } from 'vitest'
import {
  BLOCK_AIR,
  BLOCK_DEFS,
  BLOCK_LEAVES,
  BLOCK_STONE,
  BLOCK_WATER,
  blockId,
  blockName,
  canOcclude,
  hasCollision,
} from './blocks'

// 每个用例对应一个真实故障模式;恒真断言与"实现正确则必然通过"的用例不写。

describe('方块注册表', () => {
  it('0 号恒为 air——世界数据以 0 表示未放置,重排注册表会破坏该约定', () => {
    expect(BLOCK_DEFS[BLOCK_AIR].name).toBe('air')
    expect(blockName(0)).toBe('air')
  })

  it('方块名唯一——重名会让名字→id 表静默覆盖,查名拿到错误 id', () => {
    const names = BLOCK_DEFS.map((def) => def.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('destroyTime 对齐 MC 官方注册值(Blocks.java)——挖掘进度分母以此为准', () => {
    const byName = new Map(BLOCK_DEFS.map((def) => [def.name, def.destroyTime]))
    expect(byName.get('stone')).toBe(1.5)
    expect(byName.get('grass')).toBe(0.6)
    expect(byName.get('dirt')).toBe(0.5)
    expect(byName.get('leaves')).toBe(0.2)
    expect(byName.get('water')).toBeLessThan(0) // 流体按不可破坏处理
  })

  it('布尔组合语义抽查——树叶"碰撞但不遮挡"(M3 剔面)、水"全否"(M5 物理)是最易错的两个组合', () => {
    expect(hasCollision(BLOCK_STONE) && canOcclude(BLOCK_STONE)).toBe(true)
    expect(hasCollision(BLOCK_LEAVES)).toBe(true)
    expect(canOcclude(BLOCK_LEAVES)).toBe(false)
    expect(hasCollision(BLOCK_WATER)).toBe(false)
    expect(canOcclude(BLOCK_WATER)).toBe(false)
  })

  it('未注册的 id / 名字查询抛错——真实故障是把别的变量错传进查表 API,契约是抛错而非静默错值', () => {
    expect(() => blockName(BLOCK_DEFS.length)).toThrow(RangeError)
    expect(() => blockName(-1)).toThrow(RangeError)
    expect(() => blockId('gold')).toThrow(RangeError) // 代码里手滑写错方块名
  })
})
