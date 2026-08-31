# three.js 用法笔记（官方文档导读）

> 面向 M1（场景/相机/调试面板）的前置学习，基于已锁定的 **three r185**（WebGLRenderer 路线）。
> 每节末尾给出官方文档出处；所有内容只需要已安装的 `three` 包，**零新增依赖**。
> 每节按"问题 → three 的做法 → cubeforge 怎么用"组织。

---

## 0. 心智模型：五个角色

| 角色 | 类 | 职责 | 类比 |
|---|---|---|---|
| 场景 | `THREE.Scene` | 世界容器：物体树、背景色、雾 | 游戏世界 |
| 相机 | `THREE.PerspectiveCamera` | 决定"从哪看、看多大范围" | 视锥体 |
| 渲染器 | `THREE.WebGLRenderer` | 把场景按相机画进 `<canvas>` | GPU 提交 |
| 几何 | `THREE.BoxGeometry` 等 | 形状（顶点/面数据） | mesh 数据 |
| 材质 | `MeshLambertMaterial` 等 | 外观（颜色、受光方式） | shader 选择 |

**物体 = Mesh = Geometry + Material**，`scene.add(mesh)` 后才进入世界。
关键区别：`MeshBasicMaterial` **不受光**（永远全亮）；`MeshLambertMaterial` / `MeshStandardMaterial` 受光。想看到明暗立体感，必须用受光材质 + 场景里有灯。

---

## 1. 最小可运行骨架（约 50 行，可直接跑）

下面就是"屏幕里出现 8×8×8 彩色方块阵"的全部代码——plan.md M1 的临时展示物，官方 [Creating a scene](https://threejs.org/manual/#en/creating-a-scene) 教程的体素版：

```ts
import * as THREE from "three";

// 渲染器：一个页面一个就够
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 高分屏上限取 2：再高只是烧性能
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 场景：背景色 + 雾。雾色必须与背景色相同，远处才像"融进天空"
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 20, 60);

// 相机：透视投影 (fov, aspect, near, far)，单位都是世界坐标
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);

// 灯光：环境光打底 + 平行光(太阳)制造面明暗。没有灯，受光材质一片黑
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.0);
sun.position.set(10, 20, 6); // 平行光只用方向(position 指向原点)，位置远近不影响亮度
scene.add(sun);

// 8×8×8 方块阵：一个 InstancedMesh 装 512 个实例，整阵只花 1 次 draw call
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshLambertMaterial(); // 受光材质里最便宜的一种
const cubes = new THREE.InstancedMesh(geometry, material, 8 ** 3);
{
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  let i = 0;
  for (let x = 0; x < 8; x++)
    for (let y = 0; y < 8; y++)
      for (let z = 0; z < 8; z++) {
        matrix.makeTranslation(x - 3.5, y, z - 3.5); // 阵列中心移到原点，旋转不会绕角打转
        cubes.setMatrixAt(i, matrix);
        cubes.setColorAt(i, color.setHSL(((x + y + z) % 8) / 8, 0.6, 0.55));
        i++;
      }
}
scene.add(cubes);

camera.position.set(20, 14, 20);
camera.lookAt(0, 3.5, 0);

// 渲染循环：官方推荐 setAnimationLoop 而非裸 requestAnimationFrame
renderer.setAnimationLoop((time) => {
  cubes.rotation.y = time * 0.0003; // time 单位是毫秒
  camera.position.x = Math.cos(time * 0.0005) * 22;
  camera.position.z = Math.sin(time * 0.0005) * 22;
  camera.lookAt(0, 3.5, 0);
  renderer.render(scene, camera); // 每帧必须调用，漏了就是黑屏
});

// 窗口缩放：改 aspect → 更新投影矩阵 → 改画布尺寸，三步缺一不可
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
```

> 出处：[Creating a scene](https://threejs.org/manual/#en/creating-a-scene) · [WebGLRenderer API](https://threejs.org/docs/#api/en/renderers/WebGLRenderer)

---

## 2. 渲染循环与"固定步长"的关系

- `renderer.setAnimationLoop(tick)` ≈ 帮你包好的 `requestAnimationFrame`（页面隐藏时自动停，兼容未来 XR）；`tick` 收到毫秒级时间戳。
- `tick` 里只做两件事：**更新状态 → `renderer.render(scene, camera)`**。
- plan.md 要求"逻辑 60Hz 固定步长累加器（渲染不锁）"——**three 不管这件事**。做法：`tick` 内自己累计 `deltaTime`，攒满 1/60 秒就跑一次逻辑帧（可跑多次），渲染每 tick 一次。这块在 `game/loop.ts` 自写，约 50 行。

> 出处：[WebGLRenderer.setAnimationLoop](https://threejs.org/docs/#api/en/renderers/WebGLRenderer)

---

## 3. 相机与响应式（resize）

- `PerspectiveCamera(fov, aspect, near, far)`：fov 垂直视场角（度）；aspect = 宽/高；near/far 裁剪面（体素游戏建议 near 0.1，far = 视距相关，不宜盲目放大——会伤深度缓冲精度）。
- resize 三步：`camera.aspect = w/h` → `camera.updateProjectionMatrix()` → `renderer.setSize(w, h)`。

> 出处：[Responsive 设计](https://threejs.org/manual/#en/responsive) · [PerspectiveCamera API](https://threejs.org/docs/#api/en/cameras/PerspectiveCamera)

---

## 4. 光照（r155+ 物理光照单位，老教程的坑）

- M1 "能分辨面"的最小组合：`AmbientLight`（无方向底光）+ `DirectionalLight`（平行光/太阳）。
- **r155 起默认物理光照**（`useLegacyLights` 已在 r165 彻底移除）：强度是线性倍率，不换算 lux/candela 的直觉值。经验起点：Ambient 0.5–0.8，Directional 1.5–3.0。网上 2023 年前的老教程强度普遍偏小，照抄会一片黑。
- 材质选择：`MeshLambertMaterial` 逐顶点光照（便宜，体素游戏够用）；`MeshStandardMaterial` PBR 逐像素（好看但贵，M9 打磨期再考虑）。

> 出处：[Lights 手册](https://threejs.org/manual/#en/lights) · [r155 光照变更说明](https://discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733)

---

## 5. 色彩管理与雾（r152+ 默认开启，通常不用管）

- **r152 起 ColorManagement 默认启用**：hex/`Color.set()` 按 sRGB 解释，输出自动转 sRGB——**默认即正确**，不要手动设 `outputColorSpace`，也别再抄老教程的 `sRGBEncoding`。
- 雾：`scene.fog = new THREE.Fog(color, near, far)`，线性雾；对 Lambert 材质自动生效。M1 审核项"远处方块融入雾色"就是这行 + 雾色与背景色一致。

> 出处：[ColorManagement API](https://threejs.org/docs/#api/en/math/ColorManagement) · [r152 色彩变更说明](https://discourse.threejs.org/t/updates-to-color-management-in-three-js-r152/50791) · [Fog API](https://threejs.org/docs/#api/en/scenes/Fog) · [Fog 手册](https://threejs.org/manual/#en/fog)

---

## 6. 批量方块：InstancedMesh（8×8×8 阵列的正确姿势）

- 问题：512 个独立 `Mesh` = 512 次 draw call 调用；`InstancedMesh` 一个 geometry + 一个 material + N 个实例矩阵 = **1 次 draw call**。
- API 三件套：构造时给 `count`；`setMatrixAt(i, matrix)` 摆位姿；`setColorAt(i, color)` 每实例颜色（写入 `instanceColor`，材质颜色会与之相乘）。运行时改动后置 `instanceMatrix.needsUpdate = true`。
- 对 cubeforge 的意义：这是将来粒子（M9）、批量植被渲染的同一范式；M3 真正的 chunk 网格走 BufferGeometry 合批，思想同源。

> 出处：[InstancedMesh API](https://threejs.org/docs/#api/en/core/InstancedMesh) · [Optimized lots of objects (instancing) 手册](https://threejs.org/manual/#en/optimized-lots-of-objects-instancing)

---

## 7. 相机控制：`three/addons` 自带控制器（不装库也能有）

- 官方示例控制器在 **three 包内**：`import { OrbitControls } from "three/addons/controls/OrbitControls.js"`。已确认本仓库 `node_modules/three` 带完整 `examples/jsm` 与 `./addons/*` 导出——**不算新增依赖**。
- 可用的现成控制器：`OrbitControls`（绕目标点拖转/缩放，M1 观赏阶段最省事）、`PointerLockControls`（第一人称视角锁，M5 用得上）、`FlyControls`（自由飞）。
- 注意边界：OrbitControls 只管"绕着看"，plan.md M1 要求的 **WASD 平移 + 滚轮改速度**仍需自写（约 60 行，放 `game/`，因为要接键盘输入与移动语义）。

> 出处：[OrbitControls 文档](https://threejs.org/docs/#examples/en/controls/OrbitControls) · [在线示例](https://threejs.org/examples/#controls_orbit)

---

## 8. 接进 React 的唯一注意点：StrictMode 双挂载

`src/main.tsx` 用了 `<StrictMode>`：dev 模式下 effect 会**挂载→卸载→再挂载**执行两次。three 的 setup 不做清理就会留下两个 canvas、两个动画循环（现象：画面加倍闪烁/请求泄漏）。

正确姿势——工厂函数返回 dispose，放 `useEffect` 的 cleanup：

```ts
export function createScene(container: HTMLElement): () => void {
  /* ...上面的 setup，canvas 挂进 container 而非 body... */
  return () => {
    renderer.setAnimationLoop(null); // 先停循环
    geometry.dispose(); material.dispose(); renderer.dispose();
    renderer.domElement.remove();
  };
}
```

```tsx
useEffect(() => createScene(ref.current!), []); // 返回值恰好是 cleanup
```

---

## 9. cubeforge 落地估算（两档）

### A 档：先看到点东西（≈ 90–120 行，零新依赖，纯观赏）

| 文件 | 动作 | 行数 |
|---|---|---|
| `src/render/scene.ts` | **新建**：上面骨架 + dispose 封装（`render/` 层首次落地，不 import react，合规） | ~80–100 |
| `src/main.tsx` 或 `App.tsx` | 接线：容器 div + `useEffect(createScene)` | ~10–15 |

不含：输入控制、FPS 计数、参数面板。效果：自转方块阵 + 环绕相机 + 雾 + 光照。

### B 档：补齐成完整 M1（去掉 Tweakpane 的版本，≈ 250–300 行）

| 文件 | 职责 | 行数 |
|---|---|---|
| `src/render/scene.ts` | 场景/灯/雾/方块阵，参数集中导出 | ~100 |
| `src/game/loop.ts` | rAF + 固定步长累加器（逻辑 60Hz） | ~50 |
| `src/game/cameraControls.ts` | 拖转 + WASD + 滚轮速度 | ~60 |
| `src/ui/debug.ts` | FPS 计数（自写 rAF 统计，ref 直写 DOM，不进 React state） | ~35 |
| `src/main.tsx` | 装配接线 | ~25 |

Tweakpane 的三个调参滑条（FOV/雾距离/时间步长）在 B 档里没有着落：先用"改常量看效果"顶替，或等加库批准后补（属 M1 审核项 3/4，届时需在 QA 记录挂账）。

---

## 10. 版本备忘（本项目 r185，网上资料对不上的原因）

| 版本 | 变化 | 对我们的影响 |
|---|---|---|
| r152 | ColorManagement 默认开启 | 默认即正确；忽略旧教程的 `sRGBEncoding` 写法 |
| r155 | 物理光照成为默认 | 灯强度按 §4 经验值调；老教程场景照抄会偏黑 |
| r163 | WebGLRenderer 放弃 WebGL 1 | 桌面 Chrome 无感 |
| r165 | `useLegacyLights` 移除 | 见到这个 API 的教程一律过时 |

> 出处：[官方 Migration Guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide)

## 11. 官方文档索引

- 手册：[Fundamentals](https://threejs.org/manual/#en/fundamentals) · [Creating a scene](https://threejs.org/manual/#en/creating-a-scene) · [Responsive](https://threejs.org/manual/#en/responsive) · [Lights](https://threejs.org/manual/#en/lights) · [Fog](https://threejs.org/manual/#en/fog) · [Instancing](https://threejs.org/manual/#en/optimized-lots-of-objects-instancing)
- API：[WebGLRenderer](https://threejs.org/docs/#api/en/renderers/WebGLRenderer) · [PerspectiveCamera](https://threejs.org/docs/#api/en/cameras/PerspectiveCamera) · [MeshLambertMaterial](https://threejs.org/docs/#api/en/materials/MeshLambertMaterial) · [InstancedMesh](https://threejs.org/docs/#api/en/core/InstancedMesh) · [OrbitControls](https://threejs.org/docs/#examples/en/controls/OrbitControls)
- 示例库（可抄的官方 demo）：https://threejs.org/examples/
