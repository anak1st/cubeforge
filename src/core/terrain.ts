/**
 * 演示地形生成:把一个空 Chunk 填成分层小岛(纯逻辑,无随机)。
 * 本切片不做高度图扰动——flat 分层即可,侧面能直观看到草/泥/石三色。
 * 后续 M3/M4 的真实生成器在此扩展(generatorVersion 见关键决策记录)。
 */

import { BLOCK_DIRT, BLOCK_GRASS, BLOCK_STONE } from './blocks'
import { CHUNK_SIZE, type Chunk } from './chunk'

/** 层顶面(草)的世界 Y。y ≥ 此值 → 空气;y 依次往下 → 草/泥/石。 */
export const GROUND_TOP = 4
export const DIRT_DEPTH = 2 // 草顶之下连铺几层泥土

/** 把单个块的 id 写入 chunk(chunk 原点即世界原点,世界 y = 局部 y) */
export function generateDemoTerrain(chunk: Chunk): Chunk {
  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let y = 0; y <= GROUND_TOP; y++) {
        chunk.set(x, y, z, blockAt(y))
      }
    }
  }
  return chunk
}

/** 世界 y → 方块 id:≥GROUND_TOP 草,再往下 DIRT_DEPTH 层泥土,再往下石头 */
export function blockAt(y: number): number {
  if (y === GROUND_TOP) return BLOCK_GRASS
  if (y >= GROUND_TOP - DIRT_DEPTH) return BLOCK_DIRT
  return BLOCK_STONE
}
