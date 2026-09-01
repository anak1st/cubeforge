# cubeforge

浏览器端体素实验游戏（Minecraft-like）。目标是亲手实现并学习体素引擎的核心算法：分块世界、网格生成、BFS 光照、体素射线、AABB 碰撞。

两个参考对象，选择性借鉴、不做整体复刻：

- [Luanti](https://github.com/luanti-org/luanti)（原 Minetest，C++）——机制参考：边界处理、光照、碰撞等"标准答案"
- [Voxelize](https://github.com/voxelize/voxelize)（TypeScript + three.js 同栈）——实现参考：算法可直接移植

**范围**：单机、无联机、无 mod 系统、桌面浏览器键鼠操作。

## 当前实现

- 工程骨架：Vite 8 + TypeScript strict + React 19 + Tailwind CSS 4 + three.js r185（pnpm）
- three.js 演示场景：黑底自转草方块（原版贴图 + 生物群系染色），分层接线 `src/render/scene.ts`（three，`createDemoScene(canvas)` 返回释放函数）→ `src/ui/SceneCanvas.tsx`（React 承载 canvas）→ `src/ui/App.tsx`
- 参考仓库脚本：`scripts/fetch-refs.sh`（浅克隆到 `refs/`）
- 里程碑路线与人工验收清单：[docs/plan.md](docs/plan.md)（当前推进至 M1）

## 开发

```bash
pnpm install
pnpm dev        # 开发服务器
pnpm build      # 类型检查 + 构建
pnpm preview    # 预览产物
pnpm lint       # ESLint
```

当前任务见 [TODO.md](TODO.md)。

## 许可证

代码以 [MIT](LICENSE) 授权。
