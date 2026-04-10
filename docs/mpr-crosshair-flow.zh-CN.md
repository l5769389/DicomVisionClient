# MPR 十字线前后端流程说明

这份文档专门梳理 MPR 十字线在当前项目里的完整链路，包括：

- 前端如何判断是否命中十字线中心
- 前端如何发送拖拽事件
- 后端如何把拖拽位置转换成 MPR 索引
- 后端如何回推新的十字线位置
- 前端如何重新绘制十字线
- 为什么之前会出现“十字线不跟手”的问题

## 目录

- [1. 涉及的主要文件](#1-涉及的主要文件)
- [2. 总体链路](#2-总体链路)
- [3. 前端：命中检测与拖拽发送](#3-前端命中检测与拖拽发送)
- [4. 前端：把十字线操作转成 socket 请求](#4-前端把十字线操作转成-socket-请求)
- [5. 后端：处理 `crosshair` 操作](#5-后端处理-crosshair-操作)
- [6. 后端：把拖拽位置转换成 MPR 索引](#6-后端把拖拽位置转换成-mpr-索引)
- [7. 后端：构建回传给前端的十字线坐标](#7-后端构建回传给前端的十字线坐标)
- [8. 前端：重新绘制十字线](#8-前端重新绘制十字线)
- [9. 为什么之前会“不跟手”](#9-为什么之前会不跟手)
- [10. 当前正确的坐标系约定](#10-当前正确的坐标系约定)
- [11. 调试建议](#11-调试建议)

## 1. 涉及的主要文件

前端：

- `DicomVisionClient/src/renderer/src/composables/useViewerWorkspacePointer.ts`
- `DicomVisionClient/src/renderer/src/composables/useViewerWorkspace.ts`
- `DicomVisionClient/src/renderer/src/components/viewer/ViewerCanvasStage.vue`
- `DicomVisionClient/src/renderer/src/components/viewer/ViewportCrosshairOverlay.vue`

后端：

- `app/services/viewer_operation_handlers.py`
- `app/services/viewer_service.py`
- `app/sockets/handlers.py`
- `app/services/view_registry.py`
- `app/services/view_group_registry.py`

## 2. 总体链路

MPR 十字线拖拽的完整链路可以概括成：

1. 前端在 pointer down 时判断鼠标是否点中了十字线中心。
2. 如果命中，就进入“十字线拖拽模式”。
3. pointer move 时，前端持续发送当前鼠标在“图像区域中的归一化坐标”。
4. 后端收到 `crosshair` 操作后，把归一化坐标反解回图像坐标。
5. 再根据当前视口类型 `AX / COR / SAG` 更新对应的 MPR 索引。
6. 如果索引变化，后端返回需要 broadcast 的渲染决策。
7. socket runtime 触发相关 MPR 视口重新渲染。
8. 后端在渲染结果里带上新的 `mpr_crosshair` 信息。
9. 前端用新的十字线归一化坐标重新绘制 overlay。

## 3. 前端：命中检测与拖拽发送

核心文件：

- `useViewerWorkspacePointer.ts`

### 3.1 判断当前是否允许十字线拖拽

前端要求同时满足：

- 当前 tab 的 `viewType === 'MPR'`
- 当前激活工具是 `crosshair`

对应逻辑：

- `isCrosshairOperationEnabled()`

### 3.2 判断鼠标是否点中了十字线中心

流程：

1. 在 `handleViewportPointerDown(...)` 里先计算当前 pointer 点。
2. 通过 `isPointNearCrosshairCenter(...)` 判断是否命中。
3. 如果命中：
   - `setPointerCapture`
   - 设置 `isCrosshairDragging = true`
   - 发送一次 `start`

命中检测关键点：

- 前端不是按整个 viewport 容器算坐标
- 而是按实际显示出来的图像区域算坐标

具体逻辑：

1. `resolveViewportImageElement(event)`
   - 找到当前 viewport 里的 `<img class="viewer-image">`

2. `getRenderedImageRect(image)`
   - 因为图片是 `object-contain`
   - 真实图像通常不会铺满整个 viewport
   - 这个函数会计算图像实际显示区域，去掉四周黑边

3. `getNormalizedViewportPoint(event)`
   - 将鼠标位置转换成相对于“实际图像区域”的归一化坐标
   - 输出范围在 `[0, 1]`

4. `getCrosshairCenter(crosshairInfo)`
   - 如果有 `verticalPosition/horizontalPosition`，优先用它们
   - 否则退回 `centerX/centerY`

5. `isPointNearCrosshairCenter(...)`
   - 计算鼠标和十字线中心的像素距离
   - 用 `hitRadius * min(rect.width, rect.height)` 得到命中半径

也就是说：

- 前端点击命中是按“图像区域坐标系”判定的
- 不是按整个 viewport 或整个 stage 判定的

### 3.3 拖拽时发送的是什么

拖拽中调用：

- `emitCrosshairEvent(...)`
- `emitThrottledCrosshairMove(...)`

发送的数据是：

- `viewportKey`
- `phase: start | move | end`
- `x`
- `y`

其中 `x/y` 的含义是：

- 当前鼠标在“实际图像区域中的归一化位置”
- 不是 viewport 整体归一化
- 也不是像素坐标

## 4. 前端：把十字线操作转成 socket 请求

核心文件：

- `useViewerWorkspace.ts`

这里会把十字线拖拽事件转成通用视图操作：

```ts
handleMprCrosshair(payload) {
  emitMprViewOperation(payload.viewportKey, {
    opType: VIEW_OPERATION_TYPES.crosshair,
    actionType: payload.phase,
    x: payload.x,
    y: payload.y
  })
}
```

也就是说，十字线拖拽最终会变成：

- `opType = crosshair`
- `actionType = start / move / end`
- `x, y = 图像区域归一化坐标`

然后通过 socket 发送给后端。

## 5. 后端：处理 `crosshair` 操作

后端入口主要分两层：

1. `app/sockets/handlers.py`
   - `view_operation`
   - `_handle_operation(...)`

2. `app/services/viewer_operation_handlers.py`
   - `_handle_crosshair_operation(...)`

### 5.1 socket handler 层

在 `_handle_operation(...)` 中：

1. 解析 `ViewOperationRequest`
2. 绑定 `sid -> view_id`
3. 在线程池里执行：
   - `viewer_service.handle_view_operation(payload)`

### 5.2 operation handler 层

当 `opType == crosshair` 时，会进入：

- `_handle_crosshair_operation(...)`

它会调用：

- `service._handle_mpr_crosshair(view, payload)`

返回值是：

- `False`
  - 不需要广播重渲染
- `True`
  - 需要对 MPR group 广播渲染

规则是：

- `start`
  - 只记录进入拖拽状态
  - 不立刻广播
- `move`
  - 如果 MPR 索引真的发生变化，就广播
- `end`
  - 如果之前处于拖拽状态，则广播一次

## 6. 后端：把拖拽位置转换成 MPR 索引

核心函数：

- `viewer_service._handle_mpr_crosshair(...)`

### 6.1 基本前提

该函数首先检查：

- `payload.x / payload.y` 是否存在
- 当前视口是否是 MPR 类视图
- 视口尺寸是否已设置

然后它会准备：

- 当前序列对应的 volume：`_get_series_volume(...)`
- 当前 MPR 视口类型：`_resolve_mpr_viewport(view)`
- 当前 plane 的尺寸：`_get_mpr_plane_shape(...)`
- 图像到 canvas 的仿射变换：`build_image_to_canvas_transform(...)`

### 6.2 `start`

收到 `start` 时：

- 只把 `view.mpr_crosshair_drag_active = True`
- 不修改索引
- 不触发广播

### 6.3 `move`

收到 `move` 时：

1. 先确认当前确实处于拖拽状态。
2. 重新构造当前十字线 overlay。
3. 从 overlay 中拿到：
   - `image_left`
   - `image_top`
   - `image_width`
   - `image_height`

4. 把前端传来的归一化坐标还原成 canvas 坐标：

```python
canvas_x = overlay.image_left + payload.x * overlay.image_width
canvas_y = overlay.image_top + payload.y * overlay.image_height
```

这一步非常关键，它说明后端明确把前端发来的 `x/y` 当成：

- 相对于图像区域的归一化坐标

5. 再通过 `_canvas_to_image_coordinates(...)` 反解成图像坐标：

```python
image_x, image_y = self._canvas_to_image_coordinates(image_transform, canvas_x, canvas_y)
```

6. 根据不同 MPR 视口更新不同索引：

- Coronal
  - `image_x -> sagittal_index`
  - `image_y -> axial_index`

- Sagittal
  - `image_x -> coronal_index`
  - `image_y -> axial_index`

- Axial
  - `image_x -> sagittal_index`
  - `image_y -> coronal_index`

7. 如果索引没有变化：
   - 返回 `False`

8. 如果索引变化：
   - 更新 `view.current_index`
   - 设置 `view.is_initialized = True`
   - 返回 `True`

## 7. 后端：构建回传给前端的十字线坐标

核心函数：

- `_build_mpr_crosshair_overlay(...)`
- `_build_mpr_crosshair_info(...)`

### 7.1 `_build_mpr_crosshair_overlay(...)`

这个函数负责根据当前 MPR 索引和仿射变换，计算出：

- 十字线中心在 canvas 中的实际位置
- 水平线位置
- 竖线位置
- 图像区域在 canvas 中的边界：
  - `image_left`
  - `image_top`
  - `image_width`
  - `image_height`

这里得到的是“canvas 像素坐标系”下的几何信息。

### 7.2 `_build_mpr_crosshair_info(...)`

这个函数负责把 overlay 转成可回传给前端的 `MprCrosshairInfo`。

当前已经修正后的逻辑是：

- `centerX / centerY`
  - 归一化到图像区域
  - 不是整个 canvas

- `horizontalPosition / verticalPosition`
  - 也归一化到图像区域
  - 不是整个 canvas

- `hitRadius`
  - 也按图像区域的最小边归一化

换句话说，现在后端返回给前端的十字线坐标语义是统一的：

- 都表示“相对于实际图像区域”的归一化坐标

## 8. 前端：重新绘制十字线

核心文件：

- `ViewportCrosshairOverlay.vue`

前端绘制时依赖两个输入：

1. `imageFrame`
   - 表示图像在 stage 里的实际显示矩形
   - 包含：
     - `left`
     - `top`
     - `width`
     - `height`

2. `mprCrosshair`
   - 后端返回的归一化十字线信息

绘制公式：

```ts
centerX = left + normalizedX * width
centerY = top + normalizedY * height
```

这说明前端 overlay 的绘制坐标系也是：

- 图像区域坐标系

所以只要后端返回的数据也是同一语义，十字线就能稳定跟手。

## 9. 为什么之前会“不跟手”

之前的问题本质上是：

- 前端拖拽发送的是“图像区域归一化坐标”
- 后端处理拖拽时也是按“图像区域归一化坐标”来解释
- 但后端回传十字线位置时，曾经按“整个 canvas 归一化”输出
- 前端绘制时又把这些值当成“图像区域归一化坐标”使用

于是出现了坐标系不一致：

- 输入坐标系：图像区域
- 输出坐标系：canvas
- 绘制坐标系：图像区域

结果就是：

- 鼠标拖动一段距离后
- 新十字线中心不会精确落在鼠标下方
- 图像四周黑边越明显，这个偏差越明显

## 10. 当前正确的坐标系约定

当前建议统一遵循下面这个约定：

### 前端发送给后端

- `x/y`
- 表示“相对于实际图像区域”的归一化坐标

### 后端内部处理中间态

- overlay 中的 `center_x / center_y / horizontal_position / vertical_position`
- 表示 canvas 像素坐标

### 后端回传给前端

- `MprCrosshairInfo`
- 表示“相对于实际图像区域”的归一化坐标

### 前端绘制

- 以 `imageFrame` 为基准进行反归一化后绘制

也就是说：

- 前后端对外交换的数据都用“图像区域归一化坐标”
- 只有后端内部几何计算时才使用 canvas 坐标

这个约定最稳定，也最符合当前前端架构。

## 11. 调试建议

以后如果十字线还有类似问题，可以按这个顺序排查：

1. 看前端 pointer down / move 发出去的 `x/y`
   - 是不是相对于图像区域归一化

2. 看后端 `_handle_mpr_crosshair(...)`
   - 是否按 `image_left + x * image_width` 的方式还原

3. 看后端 `_build_mpr_crosshair_info(...)`
   - 是否按图像区域而不是 canvas 做归一化

4. 看前端 `ViewportCrosshairOverlay.vue`
   - 是否按 `imageFrame` 而不是 stage 全尺寸来反归一化

5. 检查 `object-contain` 引入的黑边
   - 只要黑边存在，图像区域坐标系和 canvas 坐标系就绝不能混用
