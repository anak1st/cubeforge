/**
 * 16³ 数据块:扁平 TypedArray 存储,内存连续,便于扫描(mesher)、序列化(存档)与复制。
 * 尺寸必须是 2 的幂——坐标换算依赖位运算(见 chunkCoord/localCoord)。
 */

export const CHUNK_SIZE = 16
export const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE

/** 世界坐标 → chunk 坐标。算术右移对负数同样正确:-1 >> 4 === -1(仅限 32 位整数范围)。 */
export function chunkCoord(world: number): number {
  return world >> 4
}

/** 世界坐标 → chunk 内局部坐标(0..15):-1 & 15 === 15,取模做不到这一点。 */
export function localCoord(world: number): number {
  return world & 15
}

/**
 * 局部坐标 → 数组下标。约定 x 最快、z 最慢(与 Luanti VoxelArea 一致):
 * i = (z·16 + y)·16 + x。纯数学,不做校验——边界检查在 Chunk.get/set。
 */
export function localIndex(x: number, y: number, z: number): number {
  return (z * CHUNK_SIZE + y) * CHUNK_SIZE + x
}

// (v & 15) !== v 一并拦下越界数与非整数(含 NaN),单次位运算完成校验
function checkedLocal(v: number, axis: string): number {
  if ((v & 15) !== v) {
    throw new RangeError(`chunk 局部坐标非法:${axis}=${v}(应为 0..${CHUNK_SIZE - 1} 的整数)`)
  }
  return v
}

/** 16³ 方块的数据块:id 表 + 光照参数位(两个平坦数组,下标经 localIndex 换算) */
export class Chunk {
  readonly ids = new Uint16Array(CHUNK_VOLUME)
  /** param1 预留(M6):低 4 位夜间光、高 4 位白天光;本里程碑恒 0 */
  readonly light = new Uint8Array(CHUNK_VOLUME)

  /** 读局部坐标处的方块 id */
  get(x: number, y: number, z: number): number {
    return this.ids[localIndex(checkedLocal(x, 'x'), checkedLocal(y, 'y'), checkedLocal(z, 'z'))]
  }

  /** 写局部坐标处的方块 id;id 须为 0..65535 的整数 */
  set(x: number, y: number, z: number, id: number): void {
    if (!Number.isInteger(id) || id < 0 || id > 0xffff) {
      throw new RangeError(`方块 id 非法:${id}(应为 0..65535 的整数)`)
    }
    this.ids[localIndex(checkedLocal(x, 'x'), checkedLocal(y, 'y'), checkedLocal(z, 'z'))] = id
  }
}
