# TODO — 当前进度

> 计划与设计见 `docs/plan/plan.md`;实现细节跟代码注释走;里程碑人工验收结论记 `docs/impl/Mxx.md`。

## 当前状态(2026-09-02)

- 可玩切片已整体回退(设计文档保留于 docs/plan/,背景见 plan.md 关键决策记录)
- 已落地、待人工验收:
  - M0 工程骨架
  - M2 注册表:方块注册表(7 方块,数值对齐 MC)+ 外观映射 + 1/2/3 切换演示
  - M7 壳提前落地:UI 壳(应用状态机、开始/暂停画面、Pointer Lock 协议)→ `docs/plan/ui-shell.md`
  - 资源加载体系(MANIFEST + 紫黑棋盘降级)→ `docs/plan/assets.md`
- M1-M10 其余部分未开始;旧 M2 验收记录与 tag 随回退作废

## 下一步(方向待定,候选)

- M1 场景/相机/调试面板重做
- M2 世界数据模型重做(设计见 docs/plan/blocks.md)
- M3 网格化与面剔除
