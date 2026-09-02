# cubeforge

浏览器端体素实验游戏（Minecraft-like）。目标是亲手实现并学习体素引擎的核心算法：分块世界、网格生成、BFS 光照、体素射线、AABB 碰撞。

参照对象（选择性借鉴、不做整体复刻）：

- **Minecraft 官方代码**（反编译，见 [docs/refs/minecraft.md](docs/refs/minecraft.md)）——世界行为的主要参照：草方块染色、光照范围等机制规格
- [Luanti](https://github.com/luanti-org/luanti)（原 Minetest，C++）——性能优化与工程参考
- [Voxelize](https://github.com/voxelize/voxelize)（TypeScript + three.js 同栈）——同栈实现参考

**范围**：单机、无联机、无 mod 系统、桌面浏览器键鼠操作。

## 开发

```bash
pnpm install
pnpm dev        # 开发服务器
pnpm build      # 类型检查 + 构建
pnpm preview    # 预览产物
pnpm lint       # ESLint
pnpm test       # vitest
pnpm typecheck  # tsc -b
```

里程碑路线、进度与人工验收清单见 [docs/plan/plan.md](docs/plan/plan.md)，当前任务见 [TODO.md](TODO.md)。

## 许可证

代码以 [MIT](LICENSE) 授权。
