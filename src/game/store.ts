import { createStore } from 'zustand/vanilla'

/** 游戏阶段: menu = 开始屏幕, playing = 游戏中, paused = 已暂停. */
export type Phase = 'menu' | 'playing' | 'paused'

/** 全局游戏状态. */
export interface GameState {
  phase: Phase
  /** 演示方块的旋转角; 世界状态归 store, 渲染只读取. */
  rot: { x: number; y: number }
  /** "继续"是否可点: 用户 ESC 退锁后的浏览器重锁冷却期内为 false. */
  canResume: boolean
}

/** 全局唯一游戏 store (zustand vanilla, 不依赖 React). */
export const gameStore = createStore<GameState>()(() => ({
  phase: 'menu',
  rot: { x: 0, y: 0 },
  canResume: true,
}))
