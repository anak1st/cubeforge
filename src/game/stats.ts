/** 全局帧统计白板：主循环每帧就地写入，任何层可低频拉取（全页唯一主循环，寄存器天然单份）。 */
export interface GameStats {
  fps: number // 渲染帧率：帧长 EMA 换算，刻意平滑——瞬时尖峰看 frameMs 或 DevTools
  frameMs: number // 上一帧真实帧长（未平滑，调尖峰用）
  tps: number // 逻辑 tick 率；固定步长累加器（M1）接入前恒为 0
}

export const stats: GameStats = { fps: 0, frameMs: 0, tps: 0 }
