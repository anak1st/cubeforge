/**
 * 方块注册表:id 即数组下标,0 恒为空气(参考 Luanti NodeDefManager,docs/refs/luanti.md §5.1)。
 * 世界数据里只存 id;名字与属性经本模块查表,热点路径是纯数组下标访问。
 */

/** 方块定义:数据驱动的方块属性,注册后不可变 */
export interface BlockDef {
  readonly name: string
  /** 参与碰撞(M5 物理) */
  readonly solid: boolean
  /** 邻面剔除(M3 网格)与透光(M6 光照)的依据 */
  readonly transparent: boolean
  /** 徒手挖掘秒数(M5);负数表示不可挖掘 */
  readonly hardness: number
}

export const BLOCK_AIR = 0
export const BLOCK_STONE = 1
export const BLOCK_DIRT = 2
export const BLOCK_GRASS = 3
export const BLOCK_SAND = 4
export const BLOCK_LEAVES = 5
export const BLOCK_WATER = 6

// 注册顺序即 id;0 必须是 air(未加载/空区域的约定值,见 world.ts)
const DEFS: readonly BlockDef[] = [
  { name: 'air', solid: false, transparent: true, hardness: 0 },
  { name: 'stone', solid: true, transparent: false, hardness: 1.5 },
  { name: 'dirt', solid: true, transparent: false, hardness: 0.75 },
  { name: 'grass', solid: true, transparent: false, hardness: 0.9 },
  { name: 'sand', solid: true, transparent: false, hardness: 0.75 },
  { name: 'leaves', solid: true, transparent: true, hardness: 0.3 },
  { name: 'water', solid: false, transparent: true, hardness: -1 },
]

export const BLOCK_DEFS = DEFS
export const BLOCK_COUNT = DEFS.length

const SOLID = new Uint8Array(BLOCK_COUNT)
const TRANSPARENT = new Uint8Array(BLOCK_COUNT)
const ID_BY_NAME = new Map<string, number>()
DEFS.forEach((def, id) => {
  SOLID[id] = def.solid ? 1 : 0
  TRANSPARENT[id] = def.transparent ? 1 : 0
  ID_BY_NAME.set(def.name, id)
})

/** 查方块是否参与碰撞;未注册 id 返回 false */
export function isSolid(id: number): boolean {
  return SOLID[id] === 1
}

/** 查方块是否透明;未注册 id 返回 true(按可透视处理,避免渲染侧黑块) */
export function isTransparent(id: number): boolean {
  return TRANSPARENT[id] !== 0
}

/** 查方块名;未注册 id 抛错(暴露 bug 而非静默错值) */
export function blockName(id: number): string {
  if (!Number.isInteger(id) || id < 0 || id >= BLOCK_COUNT) {
    throw new RangeError(`未注册的方块 id:${id}(应为 0..${BLOCK_COUNT - 1})`)
  }
  return DEFS[id].name
}

/** 按名查 id;未注册名字抛错 */
export function blockId(name: string): number {
  const id = ID_BY_NAME.get(name)
  if (id === undefined) throw new RangeError(`未注册的方块名:${name}`)
  return id
}
