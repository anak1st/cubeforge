# TODO — 当前进度

> 详细背景见 `docs/plan.md`。当前状态:**M2 世界数据模型已实现 + 测试,待人工验收**。

## M2 · 世界数据模型(实现完毕,待验收)

- [x] `src/core/blocks.ts`:方块注册表(`BlockDef` + id↔名字双向映射 + solid/transparent 查表),air/stone/dirt/grass/sand/leaves/water 七种占位
- [x] `src/core/chunk.ts`:16³ Chunk(`Uint16Array` id + `Uint8Array` light 预留 param1);三级坐标换算(位运算,负数正确);局部坐标与 id 范围校验
- [x] `src/core/world.ts`:chunk 容器;`getBlock`(缺失 chunk → air)、`setBlock`(缺失 chunk 抛错、未注册 id 抛错)、`ensureChunk`(生成路径)
- [x] vitest 用例 20 个:坐标往返(含负数)、越界/非整数/NaN 防护、跨 chunk 读写(三轴 8 chunk 不串扰)、16³ 全 0 初始化、注册表双向映射与查错
- [x] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` 全绿;core 纯度 `grep -rn "three\|document\|window" src/core/` 零结果
- [ ] **人工验收**(plan.md M2 清单):① `pnpm test` 全绿;② 对照上方用例清单核对测试存在;③ 亲跑 grep 确认 core 纯度。通过后写 `docs/qa/M2.md` → `git tag M2`

## M0 收尾(遗留)

- [x] vitest ^4.1.11(devDependency,`^` 版本范围);`test` / `typecheck` 脚本;~~`engines` 字段~~ 经用户决定不加(2026-09-01)
- [x] tsconfig strict:TS 6.0 起默认开启(实测:隐式 any 与可空检查在无配置时均报错),无需显式写 `"strict": true`,文档措辞已同步
- [x] 测试回路打通(由 M2 真实用例取代原计划的 smoke.test.ts)
- [x] ~~ESLint 分层禁令~~ **经用户决定(2026-09-01)不配置**:ESLint 保持模板基础配置;分层规则仍为硬约定,靠评审与验收 grep 守卫(已记入 AGENTS.md)
- [ ] Tweakpane 面板(随 M1 一并做)
- [ ] 提交当前改动;M0 人工验收清单 → `docs/qa/M0.md` → `git tag M0`(清单里"调试面板"一项依赖 Tweakpane,与 M1 一并验收)
