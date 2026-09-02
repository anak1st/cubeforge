import { create } from 'zustand'

/** 应用状态:menu = 开始屏幕,playing = 游戏运行中,paused = 已暂停。 */
export type AppState = 'menu' | 'playing' | 'paused'

/** 应用状态 store:当前应用状态与三个切换动作。 */
interface AppStore {
  appState: AppState
  /** 切换到 playing。 */
  start: () => void
  /** 切换到 paused。 */
  pause: () => void
  /** 切换回 menu。 */
  backToMenu: () => void
}

/** 全局应用状态 store;组件以 useAppStore((s) => s.xxx) 订阅。 */
export const useAppStore = create<AppStore>()((set) => ({
  appState: 'menu',
  start: () => set({ appState: 'playing' }),
  pause: () => set({ appState: 'paused' }),
  backToMenu: () => set({ appState: 'menu' }),
}))
