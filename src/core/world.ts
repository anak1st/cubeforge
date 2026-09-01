/**
 * World:chunk 容器 + 跨 chunk 自动寻址,调用方只面对世界坐标。
 * 坐标约定见 chunk.ts;世界坐标须为 32 位整数范围内的整数。
 */

import { BLOCK_AIR, BLOCK_COUNT } from './blocks'
import { Chunk, chunkCoord, localCoord } from './chunk'

// chunk 坐标三元组作 Map 键;可读性优先,M4 流式加载前无需换成数字键
function chunkKey(cx: number, cy: number, cz: number): string {
  return `${cx},${cy},${cz}`
}

function checkedWorld(v: number, axis: string): number {
  if (!Number.isSafeInteger(v)) {
    throw new RangeError(`世界坐标非法:${axis}=${v}(应为整数)`)
  }
  return v
}

/** 世界容器:按 chunk 坐标存取 16³ 数据块,提供跨 chunk 的方块读写 */
export class World {
  readonly #chunks = new Map<string, Chunk>()

  /** 取 chunk;不存在返回 undefined */
  getChunk(cx: number, cy: number, cz: number): Chunk | undefined {
    return this.#chunks.get(chunkKey(cx, cy, cz))
  }

  /** 取或创建 chunk(地形生成路径:生成器先 ensure 再填充) */
  ensureChunk(cx: number, cy: number, cz: number): Chunk {
    const key = chunkKey(cx, cy, cz)
    let chunk = this.#chunks.get(key)
    if (!chunk) {
      chunk = new Chunk()
      this.#chunks.set(key, chunk)
    }
    return chunk
  }

  /** 读世界坐标处的方块 id;缺失 chunk 按约定返回空气 */
  getBlock(x: number, y: number, z: number): number {
    checkedWorld(x, 'x')
    checkedWorld(y, 'y')
    checkedWorld(z, 'z')
    const chunk = this.getChunk(chunkCoord(x), chunkCoord(y), chunkCoord(z))
    if (!chunk) return BLOCK_AIR
    return chunk.get(localCoord(x), localCoord(y), localCoord(z))
  }

  /** 写世界坐标处的方块 id;id 须已注册,缺失 chunk 抛错(写入方应先 ensureChunk) */
  setBlock(x: number, y: number, z: number, id: number): void {
    checkedWorld(x, 'x')
    checkedWorld(y, 'y')
    checkedWorld(z, 'z')
    if (!Number.isInteger(id) || id < 0 || id >= BLOCK_COUNT) {
      throw new RangeError(`未注册的方块 id:${id}(应为 0..${BLOCK_COUNT - 1})`)
    }
    const chunk = this.#chunks.get(chunkKey(chunkCoord(x), chunkCoord(y), chunkCoord(z)))
    if (!chunk) {
      throw new Error(`目标 chunk 未加载,拒绝写入:(${x}, ${y}, ${z})`)
    }
    chunk.set(localCoord(x), localCoord(y), localCoord(z), id)
  }
}
