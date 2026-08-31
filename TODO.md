# TODO — M0 工程骨架与开发回路

> 目标：空壳工程，但"改代码 → 看到效果"的回路完全建立。预计 0.5 天。
> 详细背景见 `docs/plan.md`（M0 章节）。本步完成并验收后，再开 M1。
>
> 状态更新（2026-08-31）：脚手架已由初始化会话完成（Vite 8 + React 19.2.8 + TS 6.0 + ESLint 10 + git），
> README/AGENTS/.gitignore(refs/) 已补齐。以下为**剩余任务**。

## 已完成 ✅

- [x] 脚手架：Vite 8 + React 19 + TS + ESLint(flat) + pnpm（`package.json`、`tsconfig.*`、`eslint.config.js`）
- [x] `git init`、基础 `.gitignore`（已追加 `refs/` 防止 215MB 参考仓库误提交）
- [x] 脚本：`dev` / `build`(tsc -b + vite build) / `lint` / `preview`
- [x] `README.md`（项目介绍 + 里程碑状态表）、`AGENTS.md`（AI 协作约定）
- [x] 设计文档：`docs/plan.md`、`docs/luanti.md`
- [x] Tailwind CSS 4.3（用户指定引入，替代原 CSS Modules 方案；官方 Vite 插件方式，无 config 文件）
- [x] three.js 0.185 + `@types/three`（用户指定提前引入，原计划 M3；官方方式：npm 安装 + ESM 导入，`main.tsx` 有 REVISION 冒烟日志）

## 1. 补齐工具链

- [ ] 安装 `vitest`、`tweakpane`（`idb` 留到 M7）
- [ ] `package.json` 增加脚本：`"test": "vitest run"`、`"typecheck": "tsc -b --noEmit"`
- [ ] `package.json` 增加 `"engines": { "node": ">=22" }`
- [ ] 核对 `tsconfig.app.json` 确认 `strict: true`（模板默认应有，确认即可）

## 2. 分层结构

- [x] 现有模板入口已重构：`src/ui/App.tsx`（占位首页）+ `src/main.tsx`（装配入口）；~~建空目录~~（**按用户要求不预留空目录，各层目录随首个文件一起创建**）
- [ ] ESLint 分层禁令（`eslint.config.js` 加 `no-restricted-imports` 按目录配置；目录出现于下表时机）：
  - `src/core/**`（M2 创建）禁止：`three`、`react`、`react-dom`
  - `src/render/**`（M1 创建）、`src/game/**`（M1 创建）禁止：`react`、`react-dom`
  - `src/ui/**` 已存在，禁止：`three`
- [ ] 违规冒烟测试：在 `src/core/` 临时 `import * as THREE from "three"`，确认 `pnpm lint` 报错，然后删除

## 3. 占位应用

- [x] `src/ui/App.tsx`：已替换为最小占位页（Tailwind 原子类，标题 "cubeforge"）
- [x] 删除模板残留资源（`App.css`、`src/assets/*`、`public/icons.svg`），保留 `public/favicon.svg`
- [ ] `src/ui/debug.ts`：Tweakpane 面板挂载（空分组即可）+ FPS 计数（自写 rAF 统计）

## 4. 测试回路

- [ ] vitest 最小配置，写 `src/core/smoke.test.ts`（内容随意，目的是打通 `pnpm test` 回路）

## 5. 收尾

- [ ] 提交当前改动（README/AGENTS/TODO/.gitignore/docs）
- [ ] 跑下面人工验收清单 → `docs/qa/M0.md` 验收记录 → `git tag M0`

## 人工验收清单（来自 docs/plan.md M0，全部通过才算完成）

| # | 操作 | 预期 |
|---|---|---|
| 1 | `pnpm dev` 打开提示的地址 | 浏览器显示标题页 + FPS 显示 + 调试面板 |
| 2 | 修改 `App.tsx` 标题文字并保存 | 浏览器 1 秒内自动更新（HMR），无需手动刷新 |
| 3 | `pnpm test && pnpm lint && pnpm typecheck` | 全部通过 |
| 4 | 在 `src/core/` 加 `import * as THREE from "three"` 跑 lint | lint 报错拦截（验证分层规则生效） |
| 5 | `pnpm build && pnpm preview` | 产物页面正常打开 |

**完成后**：`git tag M0` → 开 M1（场景/相机/调试面板，见 `docs/plan.md`）。
