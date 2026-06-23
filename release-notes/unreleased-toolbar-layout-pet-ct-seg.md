# Toolbar Layout + PET/CT + Seg Unreleased Notes

记录日期：2026-06-17

适用范围：`worktree/toolbar-layout-pet-ct-seg` Client / Server 合并分支。

## 合并来源

- `worktree/toolbar-layout`：右侧视图操作区、QA/MTF 右侧结果区、工具栏跟随行为与 Web 显示细节。
- `fix/pet-only-white-background`：PET/CT fusion 与 PET-only 白底修复。
- `fix/mpr-overlay-render-intent-20260616`：MPR segmentation overlay、VOI 与 preview metadata 稳定化。

## Toolbar Layout 功能与修复

- 新增默认右侧操作区布局，支持固定宽度 Dock、底部收缩按钮、收起后自动展开需要二级内容的工具。
- 右侧工具二级菜单改为“上方按钮激活、下方固定内容区”，避免继续使用顶部工具栏下拉菜单视觉。
- QA 与 MTF 结果迁移到右侧结果区：顶部布局在宽屏下保留可折叠右侧结果区，右侧布局直接显示在 Dock 下方内容区，减少弹窗。
- MTF ROI ready 后自动打开结果区，复制和删除操作移动到右侧内容区底部。
- 水模 QA 结果改为报告式表格，QA 翻页时保持右侧结果区挂载，降低闪烁和抖动。
- 右侧 Window 面板新增临时自定义 WW/WL 输入，确认后立即应用到当前目标视图。
- 右侧测量和标注面板增加清除入口；修复测量菜单默认线段后按下鼠标变为缩放的问题。
- Play FPS 在右侧面板改为离散 slider；Layout 面板已打开时重复点击不重复渲染。
- 修复伪彩切换可能覆盖测量、标注颜色的问题，伪彩只作用于图像本身。
- Web Tag tab 不再显示文件路径；Web 首页 ICP 信息仅在未加载影像时显示，加载后隐藏。

## PET/CT 功能与修复

- 新增 PET/CT Fusion viewer，支持 CT/PET/fusion 多 pane 显示、PET display control 和 fusion alpha 调整。
- 支持 PET manual registration preview、接受/保存 registration 以及相关 socket/render dispatch 流程。
- 修复 PET-only fusion viewport 背景显示为深色的问题，独立 PET 视图使用白底渲染。
- 补充 fusion backend schema、render service、socket handler 和导出/保存相关测试覆盖。

## Segmentation 功能与修复

- 新增 MPR segmentation overlay workflow，支持 threshold rect、VOI overlay、sidecar 状态和 viewer preview metadata 流。
- 修复 threshold rect ghost projection 与 overlay render intent，使 preview 更新不会误清空或污染语义 overlay。
- 稳定 annotation / VOI overlay 的渲染意图，减少预览帧、overlay 帧、完整帧之间的状态抖动。
- Server 端增加 segmentation preview metadata 处理，降低大 overlay payload 对预览交互的影响。

## 合并修正

- `ViewerWorkspace.vue` 同时保留 PET/CT Fusion、MPR segmentation/VOI、右侧 toolbar 和 QA/MTF 右侧结果区。
- `PetCtFusionView.vue` 同时保留 PET-only 白底 / scale bar / corner info 行为，以及 seg 的 viewport transform state。
- `useViewerWorkspaceViews.ts` 合并 render intent 与右侧 toolbar overlay 保护逻辑，MPR/4D preview 不再误清已有测量。
- `backendApi.ts` 已基于合并后的 Server OpenAPI 重新生成，包含 fusion 与 annotation operation 字段。

## 验证记录

- Server：`uv run --extra dev pytest` 通过，332 passed。
- Client：`npm run typecheck` 通过。
- Client 定向测试：toolbar Dock/composable、QA/MTF panels、ViewerCanvasStage、VOI/annotation overlay、MPR segmentation、PET/CT fusion、4D、settings/mobile 共 203 passed。
- Client 全量：`npm run test:run` 通过，79 files / 521 tests passed。
