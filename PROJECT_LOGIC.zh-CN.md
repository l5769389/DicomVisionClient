# DicomVision Client 项目逻辑梳理

这份文档面向阅读和二次开发，重点解释前端如何组织工作区、如何显示医学图像、如何把用户交互转成后端 API 或 Socket 事件。前端本身不负责 DICOM 像素解码、窗宽窗位重采样、MPR 切面提取或 3D 体渲染；这些重计算主要在后端完成。前端负责视图状态、交互编排、叠加层绘制和图像 Blob 生命周期管理。

## 1. 技术栈与入口

| 内容 | 位置 | 说明 |
| --- | --- | --- |
| 应用入口 | `src/App.vue` | 组合 `useViewerWorkspace`，把状态和事件传给侧栏与主工作区。 |
| 前端构建 | `package.json` | Electron + Vite + Vue 3 + TypeScript。常用脚本包括 `dev`、`dev:web`、`build`、`test:run`、`typecheck`。 |
| UI 框架 | `src/plugins/vuetify.ts` | Vuetify 组件体系，同时项目中也使用 Tailwind 工具类。 |
| HTTP API | `src/services/api.ts`、`src/services/typedApi.ts` | Axios 实例和基于 OpenAPI 类型的 `postApi` 包装。 |
| Socket | `src/services/socket.ts` | 与后端 Socket.IO 通信，接收渲染图像和交互反馈。 |
| Viewer 类型 | `src/types/viewer.ts` | 前端核心领域类型，尤其是 `ViewerTabItem` 和 `ViewImageResponse`。 |

运行时大致分成三层：

```text
App.vue
  -> SidebarPanel：选择序列、打开视图
  -> ViewerWorkspace：显示 Stack/MPR/3D/4D/Tag 视图
      -> useViewerWorkspace：统一状态和业务事件
          -> useViewerWorkspaceViews：创建视图、绑定 Socket、接收图像、管理 Tab
          -> useViewerWorkspacePointer：鼠标/触控交互、测量、MTF、十字线
          -> useViewerWorkspaceConnection：后端连接、Socket 事件注册
```

## 2. 目录结构阅读地图

| 目录 | 作用 |
| --- | --- |
| `src/components/layout` | 主布局、侧栏、工作区容器。 |
| `src/components/viewer` | 影像视图组件，包含 Stack、MPR、4D、3D、Tag、通用画布舞台和叠加层。 |
| `src/composables/workspace` | Viewer 工作区的主要状态和交互逻辑。 |
| `src/services` | HTTP、Socket、后端进程、文件选择等服务封装。 |
| `src/types` | 前端领域类型、API 类型和 Electron 类型。 |
| `src/state` | 部分复杂交互状态机，例如测量、MTF。 |
| `src/utils` | 几何、测量、窗口预设、标注等工具函数。 |

建议从 `src/App.vue` 开始，然后看 `src/composables/workspace/core/useViewerWorkspace.ts`，再按需要进入 `views`、`pointer`、`components/viewer`。

## 3. 核心业务流程

### 3.1 加载 DICOM 目录

1. 用户在侧栏触发选择目录。
2. `useViewerWorkspace.chooseFolder()` 调用运行时能力选择本地目录。
3. `loadFolderSeries()` 通过 `postApi('LoadFolderApiV1DicomLoadFolderPost', { folderPath })` 请求后端扫描。
4. 后端返回 `seriesList`，前端追加到 `seriesList`，并默认选中第一条新序列。
5. 侧栏根据 `seriesList` 展示病人、检查、序列、4D 标记等信息。

这里前端只接收序列摘要，不加载完整像素。缩略图由后端 `/api/v1/dicom/thumbnail` 提供。

### 3.2 打开一个视图

入口主要在 `useViewerWorkspaceViews.openSeriesView()`：

| 视图类型 | 前端动作 | 后端对象 |
| --- | --- | --- |
| Stack | 创建一个后端 view，绑定 Socket，设置尺寸，等待首帧。 | 单个 `viewId`。 |
| MPR | 同一序列创建 AX/COR/SAG 三个 view，共享一个 MPR view group。 | `viewportViewIds.axial/coronal/sagittal`。 |
| 3D | 创建一个 VOLUME_3D view，后端使用 VTK 离屏渲染。 | 单个 `viewId`。 |
| 4D | 加载 phase manifest，再为当前 phase 创建 MPR 三视口。 | 每个 phase 对应一组三视口 view。 |
| Tag | 不创建渲染 view，直接请求 DICOM tags。 | HTTP 数据页。 |

所有需要渲染的视图都遵循同一套首帧流程：

```text
create view -> bind_view -> setSize -> 后端 render -> socket image_update -> updateTabImage
```

### 3.3 接收和显示图像

后端通过 Socket 发送 `image_update`，前端入口是 `useViewerWorkspace.handleImageUpdate()`，最终由 `useViewerWorkspaceViews.updateTabImage()` 更新 tab。

关键动作：

1. 从 Socket 参数中解析 `meta` 和二进制图像。
2. 用 `new Blob([binary], { type: mimeType })` 创建图片 Blob。
3. 用 `URL.createObjectURL(blob)` 得到 `blob:` URL。
4. 根据 `viewId` 找到所属 tab 或 MPR viewport。
5. 更新 `imageSrc`、`viewportImages`、`windowWidth/windowCenter`、`cornerInfo`、`orientation`、`scaleBar`、`measurements`、`mprFrame` 等元数据。
6. 对旧的 Blob URL 调用 `URL.revokeObjectURL()`，避免内存泄漏。

前端显示的主图像是 `<img>`，不是 canvas 像素数组。实际像素窗口、伪彩、旋转、MPR 重采样、3D 渲染都已由后端处理成 PNG/JPEG。

## 4. 前端图像显示与叠加层逻辑

### 4.1 主图像由后端渲染

`ViewerCanvasStage.vue` 负责通用视口显示：

```text
后端 PNG/JPEG bytes
  -> Blob URL
  -> <img class="viewer-image">
  -> 前端叠加 SVG/Canvas/Vue overlay
```

前端不会直接修改主图像像素。用户调窗、伪彩、旋转、翻转、MPR 十字线、3D 旋转等动作都会通过 Socket 发给后端，后端生成新的主图，再发回 `image_update`。

### 4.2 前端叠加层

常见叠加层在 `ViewerCanvasStage.vue` 中组合：

| 叠加层 | 组件 | 说明 |
| --- | --- | --- |
| 角标信息 | `ViewportCornerOverlay.vue` | 显示病人、序列、窗宽窗位、坐标、帧等信息。 |
| 方向标记 | `ViewportOrientationOverlay.vue` | 根据后端返回的方向元数据展示 L/R/A/P/S/I 等方向。 |
| 比例尺 | `ViewportScaleBar.vue` | 根据后端返回的像素间距和缩放信息绘制。 |
| MPR 十字线 | `ViewportCrosshairOverlay.vue` | 用 canvas 绘制三平面交线和拖拽热点。 |
| 测量 | `ViewportMeasurementOverlay.vue` | 根据归一化点和后端测量结果绘制线、角度、面积等。 |
| 标注 | `ViewportAnnotationOverlay.vue` | 前端标注图形。 |
| MTF ROI | `ViewportMtfOverlay.vue` | 显示 MTF 分析区域和结果状态。 |
| 水模 QA | `ViewportWaterQaOverlay.vue` | 显示水模自动检测 ROI 和指标。 |
| 3D 方位 | `VolumeOrientationCube.vue` | 根据 `volumeQuaternion` 展示体渲染方向。 |

### 4.3 坐标系统

项目里有几类坐标，阅读交互代码时要特别区分：

| 坐标 | 范围/含义 | 主要位置 |
| --- | --- | --- |
| 容器归一化坐标 | 相对整个 `.viewer-viewport`，范围通常是 0 到 1。 | `useViewerWorkspacePointer.getNormalizedContainerPoint()` |
| 图像归一化坐标 | 相对实际 object-contain 后的图像矩形。 | `ViewerCanvasStage.getNormalizedViewportPoint()` |
| 图像像素坐标 | DICOM 图像 row/col 或 MPR 切面像素。 | 后端 hover、测量、MTF 分析。 |
| Canvas 坐标 | 后端渲染图像时的输出像素坐标。 | 后端 `viewport_transformer` 和 render meta。 |

鼠标 hover 使用实际图像矩形归一化坐标，避免黑边区域影响 row/col。测量和叠加层通常保存归一化点，再由前后端各自映射到显示或像素空间。

### 4.4 尺寸变化和重渲染

视口尺寸由 `ResizeObserver` 和 `getViewportSize()` 读取。尺寸变化时：

1. 前端调用 `/api/v1/view/setSize`。
2. 后端更新 view 的 `width/height`。
3. 后端异步发起 render。
4. 前端收到 `image_update` 后替换图片。

MPR 和 4D 有多个视口，`postMprViewSizeUpdates()`、`renderFourDPhaseSizeUpdatesAndWait()` 会按 viewport 逐一同步尺寸。

## 5. 重要状态对象

### 5.1 `ViewerTabItem`

位置：`src/types/viewer.ts`

`ViewerTabItem` 是前端视图页签的核心状态。常见字段包括：

| 字段 | 说明 |
| --- | --- |
| `key` | 前端 tab 唯一键。 |
| `seriesId` | 所属序列。 |
| `type` | `stack`、`mpr`、`volume`、`fourD`、`tag` 等。 |
| `viewId` | 单视图后端 view id。 |
| `viewportViewIds` | MPR/4D 三视口后端 view id。 |
| `imageSrc` | 单视图主图 Blob URL。 |
| `viewportImages` | MPR/4D 每个 viewport 的 Blob URL。 |
| `cornerInfo`、`orientation`、`scaleBar` | 后端返回的显示元数据。 |
| `measurements`、`mtfItems`、`qaWater` | 叠加层和分析结果。 |
| `mprCursor`、`mprFrame`、`mprPlanes` | MPR 十字线、切面和几何信息。 |
| `volumeConfig`、`volumePreset` | 3D 体渲染配置。 |

### 5.2 `useViewerWorkspace`

位置：`src/composables/workspace/core/useViewerWorkspace.ts`

这是前端业务编排中心。它不直接渲染 DOM，而是组合连接、视图、指针、工具栏、导出等逻辑，向组件暴露状态和事件。

核心职责：

| 职责 | 说明 |
| --- | --- |
| 后端连接 | 初始化 HTTP baseURL 和 Socket.IO。 |
| 序列管理 | 加载文件夹、样例、角标缓存。 |
| tab 管理 | 打开、关闭、激活 Stack/MPR/3D/4D/Tag。 |
| 交互派发 | 把工具栏、鼠标、键盘动作转换成 API 或 Socket 事件。 |
| 图像接收 | 注册 `image_update`，更新 tab 图像和元数据。 |
| 分析任务 | 发起 MTF、水模 QA、导出等 HTTP 请求。 |

### 5.3 `useViewerWorkspaceViews`

位置：`src/composables/workspace/core/useViewerWorkspaceViews.ts`

这是视图生命周期管理模块。它关心“某个 tab 对应哪些后端 view，以及这些 view 的图片和元数据如何更新”。

重点函数注释：

| 函数 | 说明 |
| --- | --- |
| `ensureTab()` | 创建或复用指定类型的前端 tab。 |
| `createMprViewportViews()` | 为 AX/COR/SAG 创建三枚后端 view，可传入 `viewGroupKey` 让它们共享 MPR 状态。 |
| `openSeriesView()` | 打开 Stack/MPR/3D/4D/Tag 的总入口。 |
| `updateTabImage()` | 处理后端 `image_update`，更新 Blob URL 和图像元数据。 |
| `renderTab()` | 根据 tab 类型设置尺寸并触发后端初次渲染。 |
| `setFourDPhase()` | 切换 4D phase，复用或创建 phase 对应 view，更新当前 phase 图像。 |
| `preloadFourDPhases()` | 预加载 4D phase 图像，提升播放流畅度。 |
| `closeTab()` | 关闭 tab，释放后端 view，并回收 Blob URL。 |

### 5.4 `useViewerWorkspacePointer`

位置：`src/composables/workspace/core/useViewerWorkspacePointer.ts`

这是鼠标和触控交互中心。它将 pointer down/move/up/wheel 转换成业务动作。

重点逻辑：

| 场景 | 前端行为 |
| --- | --- |
| 滚轮翻页 | 发 `view_operation`，`opType=scroll`。 |
| 拖拽平移 | 发 `opType=pan`，包含 start/move/end 和 delta。 |
| 拖拽缩放 | 发 `opType=zoom`。 |
| 拖拽调窗 | 发 `opType=window`。 |
| 3D 旋转 | 发 `opType=rotate3d`。 |
| MPR 十字线 | 发 `opType=crosshair` 或 `opType=mprOblique`。 |
| 测量 | 使用测量状态机管理绘制过程，发 `opType=measurement`。 |
| MTF | 使用 MTF 状态机创建 ROI，之后调用 HTTP 分析 API。 |

为了降低高频事件压力，拖拽、十字线、测量草稿都做了节流。

## 6. HTTP API 注释

前端通过 `postApi()` 使用生成的 OpenAPI operation key。主要 HTTP API 如下：

| 前端 operation key | 后端路径 | 用途 | 前端调用位置 |
| --- | --- | --- | --- |
| `LoadFolderApiV1DicomLoadFolderPost` | `POST /api/v1/dicom/loadFolder` | 扫描本地 DICOM 目录，返回序列列表。 | `loadFolderSeries()` |
| `LoadSampleApiV1DicomLoadSamplePost` | `POST /api/v1/dicom/loadSample` | 加载后端配置的样例数据。 | `loadFolderSeries()` |
| `GetCornerInfoApiV1DicomCornerInfoPost` | `POST /api/v1/dicom/cornerInfo` | 获取序列角标信息。 | `ensureSeriesCornerInfo()` |
| `GetFourDPhasesApiV1DicomFourDPhasesPost` | `POST /api/v1/dicom/fourD/phases` | 获取 4D phase manifest。 | `loadFourDManifest()` |
| `GetDicomTagsApiV1DicomTagsPost` | `POST /api/v1/dicom/tags` | 获取某一帧/实例的 DICOM tags。 | `loadTagTab()`、`setTagTabIndex()` |
| `CreateViewApiV1ViewCreatePost` | `POST /api/v1/view/create` | 创建后端 view。 | `createBackendView()`、`createMprViewportViews()` |
| `CloseViewApiV1ViewClosePost` | `POST /api/v1/view/close` | 关闭后端 view，释放资源。 | `releaseBackendViews()` |
| `SetViewSizeApiV1ViewSetSizePost` | `POST /api/v1/view/setSize` | 同步视口尺寸并触发渲染。 | `renderTab()`、`postMprViewSizeUpdates()` |
| `AnalyzeMtfApiV1ViewMtfAnalyzePost` | `POST /api/v1/view/mtf/analyze` | 后端对 ROI 做 MTF 分析。 | `handleMtfCommit()` |
| `AnalyzeQaWaterApiV1ViewQaWaterAnalyzePost` | `POST /api/v1/view/qa/water/analyze` | 后端做水模 QA 自动检测和指标计算。 | `ViewerWorkspace.vue` |

另有资源 URL：

| URL | 用途 |
| --- | --- |
| `/api/v1/dicom/thumbnail?seriesId=...` | 序列缩略图。 |
| `/api/v1/dicom/fourD/preview?seriesId=...&phaseIndex=...` | 4D phase 预览图。 |
| `/api/v1/view/export` | 导出 PNG 或 DICOM Secondary Capture。 |

### 6.1 重点 API 使用说明

| API | 何时调用 | 前端要点 | 常见注意 |
| --- | --- | --- | --- |
| `POST /dicom/loadFolder` | 用户选择 DICOM 目录后。 | 只拿 `seriesList` 摘要，像素不在这里加载。 | 返回的 `seriesId` 是后端运行时 ID，不等同于 DICOM `SeriesInstanceUID`。 |
| `POST /view/create` | 打开 Stack、MPR、3D 或 4D phase 视图前。 | 创建后保存 `viewId`；MPR 保存三枚 `viewportViewIds`。 | 4D/MPR 要关注 `viewGroupKey`，它决定多视口是否共享状态。 |
| `POST /view/setSize` | 视口首次渲染或尺寸变化。 | HTTP 只确认尺寸，真正图像随后走 Socket `image_update`。 | 调用前要确保 view 已绑定 Socket，否则可能收不到首帧。 |
| Socket `view_operation` | 滚轮、拖拽、调窗、伪彩、MPR 十字线、3D 旋转、测量。 | 高频交互统一走 Socket，避免 HTTP 往返和轮询。 | 拖拽中可能收到 JPEG 快速预览，松手后后端会推最终帧。 |
| Socket `image_update` | 后端完成一次渲染。 | 前端把二进制图像包成 Blob URL，并用 meta 更新叠加层。 | 旧 Blob URL 必须回收，避免长时间浏览后内存上涨。 |
| `POST /view/mtf/analyze` | MTF ROI 提交后。 | ROI 点是归一化坐标，由后端换算到图像像素。 | 只适合 2D 视图；spacing 缺失时单位可能退回 `lp/pixel`。 |
| `POST /view/qa/water/analyze` | 水模 QA 按钮触发。 | 前端传 viewId、viewportKey 和指标偏好。 | 自动检测依赖图像中水模边界清晰。 |
| `POST /view/export` | 导出当前视图。 | 前端需要把要烘焙的标注/测量作为 overlays 传给后端。 | 日常显示时很多 overlay 在前端画，导出时才由后端合成。 |

## 7. Socket 事件注释

### 7.1 前端发给后端

| 事件 | 封装函数 | 用途 |
| --- | --- | --- |
| `bind_view` | `bindView()`、`bindViewSilentlyWithAck()` | 把当前 Socket 连接和后端 view 绑定。绑定后该连接可以收到该 view 的图像更新。 |
| `view_operation` | `emitViewOperation()`、`emitViewOperationWithAck()` | 所有交互操作的统一入口，例如滚动、调窗、缩放、MPR、测量、3D 旋转。 |
| `view_hover` | `emitViewHover()` | 鼠标 hover，后端返回 row/col/像素值。 |
| `four_d_playback_start` | `emitFourDPlaybackStart()` | 请求后端按 FPS 推送 4D phase index。 |
| `four_d_playback_stop` | `emitFourDPlaybackStop()` | 停止 4D 播放。 |
| `four_d_playback_fps` | `emitFourDFps()` | 修改 4D 播放帧率。 |

### 7.2 后端发给前端

| 事件 | 前端处理 | 用途 |
| --- | --- | --- |
| `connected` | `useViewerWorkspaceConnection` | 后端确认连接，前端可重新绑定已打开 view。 |
| `view_bound` | Socket 服务内部回调 | 某个 view 绑定成功。 |
| `image_update` | `handleImageUpdate()` | 最重要事件，携带图像 meta 和 PNG/JPEG bytes。 |
| `image_error` | `handleImageError()` | 单个 view 渲染失败。 |
| `render_error` | `handleImageError()` | 渲染流程异常。 |
| `hover_info` | `handleHoverInfo()` | row/col/value 等 hover 信息。 |
| `measurement_draft` | `handleMeasurementDraft()` | 测量绘制中的实时草稿。 |
| `four_d_phase_index` | `handleFourDPhaseIndex()` | 后端播放时推送当前 phase。 |
| `four_d_playback_state` | `handleFourDPlaybackState()` | 播放状态变化。 |

## 8. `view_operation` 常见 opType

| opType | 场景 | 关键字段 | 说明 |
| --- | --- | --- | --- |
| `scroll` | 滚轮翻页 | `delta` | Stack 改变 slice index，MPR 改变对应切面位置。 |
| `pan` | 拖拽平移 | `phase`、`deltaX`、`deltaY` | 高频 move 通常触发快速预览。 |
| `zoom` | 拖拽缩放 | `phase`、`deltaY` | 后端更新 zoom 后重渲染。 |
| `window` | 拖拽调窗 | `phase`、`deltaX`、`deltaY` | 后端更新窗宽窗位。 |
| `pseudocolor` | 工具栏伪彩 | `preset` | 后端使用 LUT 重新生成主图。 |
| `transform2d` | 旋转/翻转 | `rotateDelta`、`flipHorizontal`、`flipVertical` | Stack/MPR 二维变换。 |
| `crosshair` | MPR 十字线 | `point`、`phase` | 更新共享 MPR 光标并广播三视口。 |
| `mprMipConfig` | MPR MIP 参数 | `enabled`、`slabThicknessMm`、`algorithm` | 后端重采样时按 slab 取 maximum/minimum/average/sum。 |
| `mprOblique` | MPR 斜切面 | `viewport`、`normal` 或拖拽信息 | 更新 oblique plane 并广播。 |
| `rotate3d` | 体渲染旋转 | `phase`、`deltaX`、`deltaY` | 后端 VTK 相机旋转并返回新图。 |
| `volumePreset` | 体渲染预设 | `preset` | 切换传递函数预设。 |
| `volumeConfig` | 体渲染配置 | `config` | 调整层、阈值、不透明度等。 |
| `measurement` | 测量 | `action`、`toolType`、`points` | 创建、预览、提交、删除、清空测量。 |
| `reset` | 重置视图 | 可选范围 | 后端恢复默认窗口、缩放、平移、旋转等。 |

## 9. 4D 前端逻辑

4D 的前端入口仍在 `useViewerWorkspaceViews`。核心思路是：后端把不同 phase 暴露为虚拟序列或 phase item，前端每个 phase 可以拥有一组三视口 MPR view。

流程：

1. `loadFourDManifest()` 调用 `/dicom/fourD/phases`。
2. `resolveFourDPhaseItems()` 标准化 phase 数据。
3. `ensureFourDPhaseViewIds()` 为 phase 创建 AX/COR/SAG 三个后端 view。
4. `setFourDPhase()` 切换当前 phase，更新 `currentPhaseIndex` 和 viewport 图像。
5. `preloadFourDPhases()` 预加载 phase 图像，写入 phase cache。
6. 播放时，后端发 `four_d_phase_index`，前端切换到对应 phase。

4D 播放期间前端会限制部分交互，避免播放和重渲染状态互相覆盖。

## 10. 阅读和调试建议

1. 想看“用户动作到后端”的链路：从 `ViewerWorkspace.vue` 事件开始，进入 `useViewerWorkspacePointer.ts` 或 `useViewerWorkspace.ts`，再看 `socket.ts`。
2. 想看“后端图像如何显示出来”：从 `socket.ts` 的 `image_update` 开始，进入 `updateTabImage()`，再看 `ViewerCanvasStage.vue`。
3. 想看“MPR 三视口如何同步”：看 `createMprViewportViews()`、`emitMprViewOperation()`、`viewportViewIds`、`mprFrame/mprCursor/mprPlanes`。
4. 想看“测量如何工作”：看 `useMeasurementMachine`、`useViewerWorkspacePointer.ts`、`ViewportMeasurementOverlay.vue`。
5. 想看“4D 播放”：看 `FourDView.vue`、`setFourDPhase()`、`preloadFourDPhases()`、`handleFourDPhaseIndex()`。

前端最重要的设计边界是：主图像像素由后端生成，前端维护交互状态和叠加层。只要记住这一点，阅读图像相关逻辑会清晰很多。

