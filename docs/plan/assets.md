# 资源加载

状态:已实现,待人工验收(2026-09-02)。

## 原则

资源缺失永远不阻塞游戏(MC 哲学:紫黑棋盘继续跑,不拒绝启动)。

## 结构(src/render/textures.ts)

- `MANIFEST`:语义键 → `public/` 路径,全项目唯一贴图清单,新增贴图只改这里
- `loadTextures()`:逐张独立降级——失败键换紫黑棋盘(16×16、8px 象限)+ console.warn,永不 reject
- `textureFrom()`:sRGB + NearestFilter 统一出口;`tinted()`:灰度染色
- 加载时机:进游戏时按需(SceneCanvas 挂载后),开始屏幕不感知贴图

贴图文件 gitignore(Mojang 资产,来源与授权见 [refs/minecraft-assets.md](../refs/minecraft-assets.md));
新 clone 无贴图时方块呈紫黑棋盘,流程仍完整可玩。

## 扩展点

- `loadTextures` 预留 onProgress 回调接 M7 主菜单进度条
- 染色暂用平原常量 `#91bd59`,M6 生物群系落地后改 colormap 采样

## 验收清单(Chrome)

1. 开始游戏 → 草方块双轴自转:顶面绿色染色、侧面草皮沿口、底面 dirt
2. 临时改名 `public/textures/block/dirt.png` → 刷新进游戏 → 底面呈紫黑棋盘、其余面正常、console 有 warn;改回恢复
