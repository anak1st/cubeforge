/**
 * 方块注册表: id 即数组下标, 0 恒为空气; 世界数据只存 id, 名字与属性经本模块查表.
 * 字段命名与数值对齐 MC 官方: stone 1.5 / grass 0.6 / dirt 0.5 / sand 0.5 / leaves 0.2.
 */

/** 方块定义: 数据驱动的方块属性, 注册后不可变. */
export interface BlockProperties {
  readonly name: string
  /** 是否参与碰撞. */
  readonly hasCollision: boolean
  /** 是否遮挡相邻面 (面剔除与透光的依据). */
  readonly canOcclude: boolean
  /** 硬度, 挖掘进度的分母; 负数 = 不可破坏. */
  readonly destroyTime: number
}

export const BLOCK_AIR = 0
export const BLOCK_STONE = 1
export const BLOCK_DIRT = 2
export const BLOCK_GRASS = 3
export const BLOCK_SAND = 4
export const BLOCK_LEAVES = 5
export const BLOCK_WATER = 6

// 注册顺序即 id; 0 必须是 air (未加载/空区域的约定值)
const DEFS: readonly BlockProperties[] = [
  { name: 'air', hasCollision: false, canOcclude: false, destroyTime: 0 },
  { name: 'stone', hasCollision: true, canOcclude: true, destroyTime: 1.5 },
  { name: 'dirt', hasCollision: true, canOcclude: true, destroyTime: 0.5 },
  { name: 'grass', hasCollision: true, canOcclude: true, destroyTime: 0.6 },
  { name: 'sand', hasCollision: true, canOcclude: true, destroyTime: 0.5 },
  { name: 'leaves', hasCollision: true, canOcclude: false, destroyTime: 0.2 },
  { name: 'water', hasCollision: false, canOcclude: false, destroyTime: -1 },
]

export const BLOCK_DEFS = DEFS
export const BLOCK_COUNT = DEFS.length

const COLLIDABLE = new Uint8Array(BLOCK_COUNT)
const OCCLUDES = new Uint8Array(BLOCK_COUNT)
const ID_BY_NAME = new Map<string, number>()
DEFS.forEach((def, id) => {
  COLLIDABLE[id] = def.hasCollision ? 1 : 0
  OCCLUDES[id] = def.canOcclude ? 1 : 0
  ID_BY_NAME.set(def.name, id)
})

/** 查方块是否参与碰撞; 未注册 id 返回 false. */
export function hasCollision(id: number): boolean {
  return COLLIDABLE[id] === 1
}

/** 查方块是否遮挡相邻面; 未注册 id 返回 false. */
export function canOcclude(id: number): boolean {
  return OCCLUDES[id] === 1
}

/** 查方块名; 未注册 id 抛错 (暴露 bug 而非静默错值). */
export function blockName(id: number): string {
  if (!Number.isInteger(id) || id < 0 || id >= BLOCK_COUNT) {
    throw new RangeError(`未注册的方块 id: ${id} (应为 0..${BLOCK_COUNT - 1})`)
  }
  return DEFS[id].name
}

/** 按名查 id; 未注册名字抛错. */
export function blockId(name: string): number {
  const id = ID_BY_NAME.get(name)
  if (id === undefined) throw new RangeError(`未注册的方块名: ${name}`)
  return id
}
