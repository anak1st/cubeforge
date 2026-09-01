import { describe, expect, it } from 'vitest'
import { CHUNK_SIZE, CHUNK_VOLUME, Chunk, chunkCoord, localCoord, localIndex } from './chunk'

describe('三级坐标换算', () => {
  it('chunk 坐标 × 16 + 局部坐标往返等于原世界坐标(含负数)', () => {
    for (let x = -64; x <= 64; x++) {
      expect(chunkCoord(x) * CHUNK_SIZE + localCoord(x)).toBe(x)
    }
  })

  it('负数坐标落到正确的 chunk 与局部格(位运算语义)', () => {
    expect(chunkCoord(-1)).toBe(-1)
    expect(localCoord(-1)).toBe(15)
    expect(chunkCoord(-16)).toBe(-1)
    expect(localCoord(-16)).toBe(0)
    expect(chunkCoord(-17)).toBe(-2)
    expect(localCoord(-17)).toBe(15)
  })

  it('localIndex 已知值:x 最快、y 其次、z 最慢', () => {
    expect(localIndex(0, 0, 0)).toBe(0)
    expect(localIndex(1, 0, 0)).toBe(1)
    expect(localIndex(0, 1, 0)).toBe(CHUNK_SIZE)
    expect(localIndex(0, 0, 1)).toBe(CHUNK_SIZE * CHUNK_SIZE)
    expect(localIndex(15, 15, 15)).toBe(CHUNK_VOLUME - 1)
  })
})

describe('Chunk 存储', () => {
  it('新建 chunk 的 id 与 light 均为 16³ 全 0', () => {
    const chunk = new Chunk()
    expect(chunk.ids.length).toBe(4096)
    expect(chunk.light.length).toBe(4096)
    for (let i = 0; i < CHUNK_VOLUME; i++) {
      expect(chunk.ids[i]).toBe(0)
      expect(chunk.light[i]).toBe(0)
    }
  })

  it('set 后 get 一致,且不串扰相邻格', () => {
    const chunk = new Chunk()
    chunk.set(3, 5, 7, 42)
    expect(chunk.get(3, 5, 7)).toBe(42)
    expect(chunk.get(3, 5, 8)).toBe(0)
    expect(chunk.get(3, 6, 7)).toBe(0)
    expect(chunk.get(4, 5, 7)).toBe(0)
    expect(chunk.get(2, 5, 7)).toBe(0)
  })

  it('局部坐标越界 / 非整数读写抛 RangeError', () => {
    const chunk = new Chunk()
    for (const v of [-1, 16, 1.5, Number.NaN]) {
      expect(() => chunk.get(v, 0, 0)).toThrow(RangeError)
      expect(() => chunk.get(0, v, 0)).toThrow(RangeError)
      expect(() => chunk.get(0, 0, v)).toThrow(RangeError)
      expect(() => chunk.set(v, 0, 0, 1)).toThrow(RangeError)
    }
  })

  it('id 超出 u16 范围抛错,边界值 65535 可写', () => {
    const chunk = new Chunk()
    expect(() => chunk.set(0, 0, 0, -1)).toThrow(RangeError)
    expect(() => chunk.set(0, 0, 0, 65536)).toThrow(RangeError)
    expect(() => chunk.set(0, 0, 0, 0.5)).toThrow(RangeError)
    chunk.set(0, 0, 0, 65535)
    expect(chunk.get(0, 0, 0)).toBe(65535)
  })
})
