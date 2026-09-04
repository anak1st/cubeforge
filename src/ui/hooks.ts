import { useStore } from 'zustand'
import { gameStore, type GameState } from '@/game/store'

/** React 订阅游戏状态的唯一入口: useGame((s) => s.phase); selector 结果不变则不重渲染. */
export function useGame<T>(selector: (state: GameState) => T): T {
  return useStore(gameStore, selector)
}
