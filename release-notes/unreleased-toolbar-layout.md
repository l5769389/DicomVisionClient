# Toolbar Layout Unreleased Notes

记录日期：2026-06-17

适用范围：DicomVisionClient，`worktree/toolbar-layout` 分支。Server 无代码改动。

## 修复记录

### TL-BUG-001 右侧布局缺少临时自定义窗值入口

- 问题：右侧操作区的“窗”工具只能选择预设窗宽/窗位，无法临时输入目标 `WW / WL` 并立即应用。
- 影响：用户需要快速尝试非预设窗值时，只能回到其他交互路径，右侧布局下操作不完整。
- 修复：在右侧 `Window` 内容面板顶部新增临时窗值表单，输入有效 `WW / WL` 后复用现有 `windowPreset` 通道立即触发视图 `window` operation；该值不写入用户预设。
- 代码依据：
  - `src/renderer/src/components/workspace/shell/ViewerToolbarDockPanelContent.vue`
  - `src/renderer/src/components/workspace/shell/ViewerToolbarDock.test.ts`
- 发布说明建议：右侧操作区的窗宽窗位面板新增临时自定义输入，确认后可立即应用到当前目标视图。

### TL-BUG-002 伪彩重渲染可能覆盖测量/标注颜色

- 问题：选择伪彩后，后端图像帧可能携带 overlay payload，前端接收帧时会替换本地 `measurements` / `annotations`，导致用户设置或绘制的测量、标注颜色受到伪彩流程干扰。
- 影响：伪彩本应只作用于图像本身，但可能让前端绘制 overlay 的颜色或状态被后续图像帧覆盖。
- 修复：
  - 前端发送 `pseudocolor` operation 时记录对应 `viewId`。
  - 收到对应伪彩图像帧时只更新图像与伪彩状态，显式保留前端本地 `measurements` / `annotations`。
  - MPR/4D 图像更新在 payload 未携带 `measurements` 时改为保留已有测量，避免把“缺失 payload”误判为空测量列表。
- 代码依据：
  - `src/renderer/src/composables/workspace/core/useViewerWorkspace.ts`
  - `src/renderer/src/composables/workspace/views/useViewerWorkspaceViews.ts`
- 发布说明建议：修复伪彩切换可能影响测量和标注颜色的问题；伪彩现在只作用于医学图像渲染，不覆盖前端绘制 overlay。

## 验证记录

- `npm run typecheck`：通过。
- 定向测试：`ViewerToolbarDock`、`useViewerWorkspaceToolbar`、`ViewportMeasurementOverlay`、`ViewerCanvasStage`、`MprView`、`FourDView` 通过，共 62 个用例。
- `npm run test:run`：除既有 `viewTabPatches.test.ts` 中 `offsetX / offsetY / zoom` baseline 差异外，其余 340 个用例通过；该 baseline 差异非本次改动引入。

