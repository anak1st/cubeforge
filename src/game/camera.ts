/**
 * 飞行相机控制器(MC 方案)。
 *
 * 架构参照 Minecraft:
 * - 位置:在固定 tick 上积分(模拟帧),渲染时用 alpha 在 prevPos→pos 间插值;
 * - 视角:鼠标增量累积,每渲染帧一次性消费到 yaw/pitch(对应 MC turnPlayer 每帧调用),
 *   始终是最新朝向,不被固定 tick 量化——这是消除"转向卡顿"的关键。
 *
 * 本模块只做纯数学;Pointer Lock 与事件采集在 game/createGame。
 */
import * as THREE from 'three'

export interface FlyInput {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
  up: boolean
  down: boolean
}

export interface CameraController {
  readonly camera: THREE.PerspectiveCamera
  /** 累积一次鼠标增量视角(不立即生效,由 render 帧消费) */
  turn(dx: number, dy: number): void
  /** 固定 tick 步进:用当前朝向推进逻辑位置(模拟帧) */
  move(dtMs: number, input: Readonly<FlyInput>): void
  /** 每渲染帧:消费累积旋转;位置按 alpha 在 prevPos→pos 间插值 */
  render(alpha: number): void
  setPosition(x: number, y: number, z: number): void
  lookTowards(x: number, y: number, z: number): void
}

const PITCH_LIMIT = Math.PI / 2 - 0.001
const SENSITIVITY = 0.0022 // 弧度/像素
const FLY_SPEED = 12 // 格/秒

export function createCameraController(camera: THREE.PerspectiveCamera): CameraController {
  camera.rotation.order = 'YXZ'

  let yaw = 0
  let pitch = 0
  let pendingYaw = 0
  let pendingPitch = 0

  // 逻辑位置(tick 推进)与上一 tick 快照(供渲染插值)
  const pos = new THREE.Vector3()
  const prevPos = new THREE.Vector3()
  const dir = new THREE.Vector3()

  return {
    camera,
    turn(dx: number, dy: number): void {
      pendingYaw -= dx * SENSITIVITY
      pendingPitch -= dy * SENSITIVITY
    },
    move(dtMs: number, input: Readonly<FlyInput>): void {
      const dt = dtMs / 1000
      prevPos.copy(pos)

      // WASD 只在水平面移动(消掉俯仰分量):朝向取当前 yaw 的水平投影;上下单独由 Space/Shift 控制
      const s = Math.sin(yaw)
      const c = Math.cos(yaw)
      const fx = -s
      const fz = -c
      const rx = c
      const rz = -s

      const fb = (input.forward ? 1 : 0) - (input.back ? 1 : 0)
      const rl = (input.right ? 1 : 0) - (input.left ? 1 : 0)
      const ud = (input.up ? 1 : 0) - (input.down ? 1 : 0)

      dir.set(fx * fb + rx * rl, ud, fz * fb + rz * rl)
      if (dir.lengthSq() > 0) pos.addScaledVector(dir.normalize(), FLY_SPEED * dt)
    },
    render(alpha: number): void {
      // 每渲染帧消费鼠标增量(对应 MC turnPlayer),保证转向不被 tick 量化
      yaw += pendingYaw
      pitch = THREE.MathUtils.clamp(pitch + pendingPitch, -PITCH_LIMIT, PITCH_LIMIT)
      pendingYaw = 0
      pendingPitch = 0
      camera.rotation.set(pitch, yaw, 0)

      // 位置在固定 tick 网格上推进,渲染在上一/当前 tick 位置间插值 → 视觉连续
      camera.position.lerpVectors(prevPos, pos, alpha)
    },
    setPosition(x: number, y: number, z: number): void {
      pos.set(x, y, z)
      prevPos.copy(pos)
      camera.position.set(x, y, z)
    },
    lookTowards(x: number, y: number, z: number): void {
      const d = new THREE.Vector3(x - pos.x, y - pos.y, z - pos.z).normalize()
      pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1))
      yaw = Math.atan2(-d.x, -d.z)
      camera.rotation.set(pitch, yaw, 0)
    },
  }
}
