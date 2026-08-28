# Changelog

## v3.2.5 - 2026-08-28

### 新增

- MPR、3D、4D 在序列不兼容时显示结构化原因和技术详情，不再打开无法渲染的空白标签页。
- MTF 分析增加径向与 W/H 方向的 MTF50、MTF10、FWHM、Nyquist 边界和质量提示。

### 改进

- 重构 MTF 右侧结果区，统一承载计算中、成功、部分可测和失败状态；影像上仅保留 ROI 与复制、删除操作。
- 统一桌面端右侧操作区，移除顶部操作按钮位置设置，普通 2D、MPR、Fusion 和 4D 使用一致的 Dock 交互。
- 优化视口 resize 与 reset 调度，保持未手动变换影像的物理比例、居中和完整适配。
- 改进 MPR、3D、4D 创建失败和首帧渲染失败时的资源回收与错误去重。

### 修复

- 修复 MTF ROI 边界取整、低信噪比、零频响应不稳定及异步结果写入错误标签等问题。
- 修复 MTF 曲线超过 1 时被错误裁剪，以及阈值未在 Nyquist 内穿越却显示伪精确值的问题。
- 修复调整视口大小或 reset 后影像缩放、居中状态与初始显示不一致的问题。
- 修复存在不规则层距、重复位置、混合方向或不一致 PixelSpacing 的序列进入 MPR、3D、4D 后无明确反馈的问题。

### 测试

- 增加二维高斯解析真值、矩形 ROI、各向异性 PixelSpacing、边缘点源和 Nyquist 边界测试。
- 增加视口 contain-fit、4D 相位兼容性、结构化错误弹窗和右侧操作区回归测试。

## v3.1.1 - 2026-07-15

### Highlights

- Stabilized the bottom-right X/Y/value readout with backend-authoritative text, fixed-width fields, preserved last valid hover values, and no `CT:` prefix.
- Improved 2D/MPR pan, zoom, hover sampling, coordinate handling, and out-of-viewport measurement/annotation geometry.
- Added and refined 3D orientation controls, mobile 3D gestures, Surface/VR presets, remove-bed and freeform clipping workflows.
- Improved 3D layout viewport overlays, orientation cube behavior, tool ordering, rendering controls, and mobile viewport fitting.
- Added regression coverage for 3D rendering, tabs/layouts, hover values, gestures, clipping, surface rendering, and socket/view lifecycle behavior.

## v3.1.0 - 2026-07-09

### 新增

- 新增完整 3D 模板分组：General、CT、CTA、MR、CBCT。
- 新增 3D 去床板开关、自由形状裁剪、裁剪进度提示和移动端 3D 工具入口。
- 新增 Surface 独立参数面板和 Surface preset，不再复用 VR transfer function 参数。
- 新增开发环境按页面 host 自动解析后端地址，方便手机通过局域网访问本机 Web。

### 改进

- 优化 3D VR/Surface 预览与最终帧一致性，最终帧采样质量更高。
- 优化 3D 模型直接拖拽旋转，减少连续拖动时旧帧覆盖和姿态跳变。
- AAA 等 3D 模板改为 CT HU 锚点 + 前景百分位自适应，兼顾低对比主体和高密度金属/骨点。
- 移动端 3D 初始视图根据视口和模型范围自动适配，尽量完整显示模型。
- 开发模式自动注销旧 PWA Service Worker 并清理缓存，避免 Vite 模块被 HTML fallback 污染。

### 修复

- 修复手机访问局域网 Web 时仍尝试连接手机本机 `127.0.0.1:8000` 的问题。
- 修复 Network 地址访问开发 Web 时可能出现 JS module MIME type 为 `text/html` 的问题。
- 修复 3D reset 回到固定模板而不是后端自动模板的问题。
- 修复去床板候选过度删除中央方形主体的问题。

## v3.0.0 - 2026-06-23

这是一次大型版本升级，合并了右侧操作区、PET/CT 融合、MPR 分割和移动端重构等多条工作线。

### 新增

- 新增桌面端右侧操作区布局，并将默认视图操作体验调整为更稳定的固定 Dock。工具按钮、二级面板、3D/MIP 参数、分割、PET/CT 配准和 QA/MTF 结果都可以在右侧区域内完成，减少弹窗和视口反复 resize。
- 新增 PET/CT Fusion 浏览能力，包括 CT/PET/融合/MIP 多视口、PET 层显示控制、手动配准、配准保存、PET-only 白底显示和 fusion pane 双击放大/恢复。
- 新增 MPR 阈值分割和 VOI 工作流，支持预览、阈值矩形、球形 VOI、统计指标、导入导出和右侧 Dock 嵌入模式。
- 新增 QA/MTF 右侧结果区。MTF ROI 选中后自动展示曲线和指标，水模 QA 以报告/表格方式展示 loading、结果和错误状态。
- 新增 MPR/4D 切片播放。4D 中区分 phase play 与 slice play，并在 mobile、顶部工具栏和右侧 Dock 中保持互斥与一致状态。
- 移动端新增 PET/CT Fusion 测量和标注、最近打开记录、统一更多面板、固定加载文件夹/加载 PACS 入口，以及更完整的二级菜单 reset/clear footer。

### 改进

- 统一用户可见的 2D 命名：普通 Stack 和独立 PET 都显示为 2D，内部 viewType 与后端接口保持不变。
- 右侧 Dock 改为无下拉的面板式交互，按钮 active、utility 面板、结果面板和收缩状态由单一状态模型驱动。
- Window、Pan、Zoom、Rotate、Measure、Annotate、Reset、PET Display、MIP 和分割面板的 reset/clear 动作统一放在内容区底部，内容过长时中间区域滚动。
- PET 独立影像对齐 PET-only 语义，采用白底显示、PET 强度范围和 PET 专用显示控制，避免走 CT 窗宽窗位逻辑。
- 优化浅色主题下 active viewport 高亮、PET 白底四角信息、移动端小视图信息布局、伪彩色带、设置页和 mobile bottom sheet 的视觉一致性。
- Web 端 Tag 页隐藏文件路径，ICP 信息仅在首页未加载影像时显示。
- 测量、标注等 overlay 颜色不再受后续伪彩选择影响，伪彩只作用于图像本身。

### 修复

- 修复右侧布局选择相同 Layout/MPR Layout 会重复刷新或导致内容区抖动的问题。
- 修复右侧 Dock 点击带二级面板的工具后 activeOperation 未同步，导致调窗、缩放、翻页、测量、分割等操作残留的问题。
- 修复右侧 Dock 多 active、收缩不立即生效、utility 面板不切换、QA 结果覆盖 QA 二级菜单等状态问题。
- 修复 PET-only 独立影像和融合视图背景、伪彩/强度范围、角标清晰度和调窗过程中背景闪烁的问题。
- 修复 4D/MPR 初始 active viewport 十字线不显示、浅色主题 active viewport 不明显、播放 hover 文案和移动端 play 菜单不一致的问题。
- 修复移动端序列弹窗点击序列即切换视图的问题，改为用户选择目标视图类型后再打开。

### 测试

- 扩展右侧 Dock、toolbar composable、QA/MTF、PET/CT Fusion、MPR 分割、MPR/4D 播放、移动端工作区、active viewport 和 overlay 相关测试。
