// 当前锁目标,由 SceneCanvas 挂载/卸载时注册与清除
let target: HTMLElement | null = null

/** 注册或清除指针锁的请求目标。 */
export function setLockTarget(el: HTMLElement | null): void {
  target = el
}

/** 请求指针锁定:锁定成功后 resolve;目标未注册或被浏览器拒绝时 reject。 */
export async function requestLock(): Promise<void> {
  if (!target) throw new Error('锁定目标未注册')
  // Chrome 在 ESC 退锁后约 1.25s 内拒绝重锁
  await target.requestPointerLock()
}
