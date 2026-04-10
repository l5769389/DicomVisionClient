# DicomVision Server 后端主流程梳理

这份文档用于帮助快速理解当前 `DicomVisionServer` 的核心调用链、关键数据对象，以及代码中常见的 Python 函数参数写法。

## 目录

- [1. 核心对象](#1-核心对象)
- [2. 主流程总览](#2-主流程总览)
- [3. `loadFolder` 流程](#3-loadfolder-流程)
- [4. `create` 流程](#4-create-流程)
- [5. `setSize` 流程](#5-setsize-流程)
- [6. `emit_render_for_view` 渲染调度流程](#6-emit_render_for_view-渲染调度流程)
- [7. `render_view_by_id` 实际渲染流程](#7-render_view_by_id-实际渲染流程)
- [8. Socket 交互流程](#8-socket-交互流程)
- [9. MPR / 3D 的特殊路径](#9-mpr--3d-的特殊路径)
- [10. Python 参数语法速查](#10-python-参数语法速查)

## 1. 核心对象

在理解流程之前，先明确几个核心对象：

- `SeriesRecord`
  - 表示一个已注册的 DICOM 序列。
  - 包含 `series_id`、`series_instance_uid`、病人/检查信息、以及 `instances` 列表。

- `InstanceRecord`
  - 表示序列中的单张 DICOM 实例。
  - 包含文件路径、`SOPInstanceUID`、`InstanceNumber`、行列数等。

- `ViewRecord`
  - 表示一个视口实例。
  - 后续所有交互请求基本都通过 `view_id` 找到对应的 `ViewRecord`。
  - 里面保存了视口类型、尺寸、缩放、偏移、窗宽窗位、MPR 索引、3D 旋转参数等状态。

- `ViewGroupRecord`
  - 主要用于 MPR 组视图。
  - 同一个序列下的 MPR / AX / COR / SAG 视口会共享 group 状态。

- `CachedDicom`
  - 表示已经解码并缓存的 DICOM 数据。
  - 包含 `dataset`、`source_pixels`、窗宽窗位、像素最值等。

- `RenderRequest`
  - `view_socket_hub` 内部使用的“待渲染请求”对象。
  - 用于合并重复渲染请求并控制输出目标 sid。

## 2. 主流程总览

目前最重要的主链路可以概括成：

1. 前端调用 `POST /api/v1/dicom/loadFolder` 加载一个本地路径。
2. 后端扫描目录并注册一个或多个 `SeriesRecord`。
3. 前端调用 `POST /api/v1/view/create` 创建视口。
4. 后端注册 `ViewRecord`，如果是 MPR 视图则还会绑定 `ViewGroupRecord`。
5. 前端通过 HTTP `POST /api/v1/view/setSize` 或 socket `set_view_size` 设置视口尺寸。
6. 后端初始化视口状态，并触发 `view_socket_hub.emit_render_for_view(view_id)`。
7. `view_socket_hub` 调度真正的渲染任务，最终调用 `viewer_service.render_view_by_id(view_id)`。
8. `viewer_service` 读取缓存、构建渲染上下文、完成图像渲染，并通过 socket 回推 `image_update`。

## 3. `loadFolder` 流程

入口：

- HTTP 路由：`app/api/routes/dicom.py`
- 实际逻辑：`series_registry.load_folder(payload)`

当前 `load_folder` 的内部流程已经拆分为几个 helper：

1. `_resolve_folder`
  - 将输入路径做 `expanduser()` 和 `resolve()`。
  - 目的是把路径归一化，避免同一路径因为写法不同导致 registry key 不稳定。
  - 如果路径不存在或不是目录，直接抛出 `404`。

2. `_collect_grouped_series`
  - 递归遍历目录下所有文件。
  - 对每个文件尝试执行 `_read_dataset_header`。
  - 这里只读取 DICOM 头信息，`stop_before_pixels=True`，避免在“扫描目录”阶段就把像素数据全部读进内存。

3. `_read_dataset_header`
  - 调用 `pydicom.dcmread(...)`。
  - 如果读取失败，返回 `None`，当前文件被忽略。

4. `_is_readable_dicom`
  - 判断这个 dataset 是否可作为一个有效 DICOM 实例处理。
  - 目前规则是：有 `SeriesInstanceUID`，或者至少包含 `PixelData`。

5. `_get_or_create_grouped_series`
  - 通过 `_build_series_key` 生成序列分组 key。
  - 如果当前分组还不存在，就创建新的 `SeriesRecord`。
  - 否则复用已存在的分组。

6. `_build_instance_record`
  - 把当前 dataset 转成 `InstanceRecord`。
  - 提取 `SOPInstanceUID`、`InstanceNumber`、`Rows`、`Columns` 等。

7. 实例去重
  - 使用 `SOPInstanceUID`，如果没有则退化为文件路径，形成 `instance_key`。
  - 同一 `series_key` 下如果已经出现过这个实例，就跳过。

8. `_build_series_summary`
  - 每个分组完成后：
  - 对实例按 `instance_number` 排序。
  - 写入 `_series_by_id` 和 `_series_id_by_key`。
  - 组装 `SeriesSummary`，作为返回结果的一部分。

最终返回：

- `LoadFolderResponse`
  - `seriesId`：默认取返回列表中第一个序列的 `series_id`
  - `seriesList`：所有可读序列的摘要列表

这一阶段有一个重要特点：

- 只做“目录扫描与序列注册”
- 不做真正像素解码缓存
- 真正的像素数据读取发生在后续渲染阶段，由 `dicom_cache.get(...)` 触发

## 4. `create` 流程

入口：

- HTTP 路由：`app/api/routes/view.py`
- 实际逻辑：`view_registry.create(payload)`

流程：

1. 校验 `series_id`
  - 通过 `series_registry.get(payload.series_id)` 确保序列已经存在。

2. 创建 `ViewRecord`
  - 生成新的 `view_id`
  - 写入 `series_id`
  - 写入 `view_type`

3. 如果是 MPR 类视图
  - 视图类型包括：`MPR`、`AX`、`COR`、`SAG`
  - 调用 `view_group_registry.get_or_create_mpr_group_for_series(...)`
  - 将共享的 `ViewGroupRecord` 关联到当前 `ViewRecord.view_group`

4. 注册到 `view_registry`
  - 写入 `_view_by_id`

5. 返回 `view_id`
  - 前端后续针对这个视口的交互，都需要携带这个 `view_id`

这里要注意：

- `create` 只负责创建视口状态对象
- 不负责尺寸初始化
- 不负责触发渲染

## 5. `setSize` 流程

当前有两条入口：

- HTTP：`POST /api/v1/view/setSize`
- Socket.IO：`set_view_size`

两条路径在“设置尺寸”这件事上的核心逻辑是一致的，最终都会调用：

- `viewer_service.set_view_size(payload)`

### 5.1 HTTP `setSize`

入口：

- `app/api/routes/view.py`

流程：

1. 调用 `viewer_service.set_view_size(payload)`
2. 将 `view_id` 对应的渲染任务通过 `background_tasks.add_task(...)` 加入后台任务
3. 后台任务中调用 `view_socket_hub.emit_render_for_view(view_id)`

这里要注意：

- HTTP 路径本身不会自动绑定 `sid`
- 它只是完成尺寸设置，并安排一个后台渲染任务
- 真正能把图像推送给谁，取决于这个 `view_id` 是否已经通过 socket 和某些 `sid` 关联过

### 5.2 Socket `set_view_size`

入口：

- `app/sockets/handlers.py` 中的 `_handle_set_size`

流程：

1. 校验请求体，构建 `ViewSetSizeRequest`
2. `view_socket_hub.bind_view(sid, payload.view_id)`
  - 这里会把当前 socket 的 `sid` 和 `view_id` 关联起来
3. 调用 `viewer_service.set_view_size(payload)`
4. 发送 `view_ack`
5. 调用 `_emit_render(...)`
6. `_emit_render(...)` 内部会再次确保绑定，并调用 `view_socket_hub.emit_render_for_view(view_id, target_sids=(sid,))`

### 5.3 `viewer_service.set_view_size`

这是尺寸初始化的核心逻辑：

1. 校验 `opType` 必须是 `setSize`
2. 通过 `view_registry.get(view_id)` 找到对应的 `ViewRecord`
3. 写入 `view.width` 和 `view.height`
4. 如果这个视口还没有初始化：
  - 普通 2D 视图：`_initialize_viewport(view)`
  - MPR 视图：`_initialize_mpr_viewport(view)`
  - 3D 视图：`_initialize_3d_viewport(view)`
5. 设置 `view.is_initialized = True`

### 5.4 `_initialize_viewport`

普通 2D 视图初始化时，一般会做这些事情：

1. 获取当前视图关联的序列和当前实例
2. 通过 `dicom_cache.get(instance_uid, path)` 获取缓存数据
   - 如果缓存没有命中，会真正读取 DICOM 并解码像素
3. 根据图片尺寸和 canvas 尺寸计算 contain 的 zoom
4. 初始化：
   - `zoom`
   - `offset_x`
   - `offset_y`
   - `window_width`
   - `window_center`
   - 其他默认显示状态

所以你写的这条主线是对的，只是更精确一点应该表述为：

- `setSize` 会初始化视图状态
- DICOM 像素缓存一般在初始化或首次渲染时触发
- 真正的渲染任务不是在 `set_view_size()` 内直接执行，而是通过 `emit_render_for_view()` 异步调度

## 6. `emit_render_for_view` 渲染调度流程

入口：

- `app/sockets/runtime.py`
- 核心对象：`view_socket_hub`

这是“渲染调度器”，负责避免同一个 `view_id` 在高频交互时无限堆积重复渲染。

流程如下：

1. `emit_render_for_view(view_id, ...)`
  - 构造一个 `RenderRequest`
  - 包含：
    - `image_format`
    - `fast_preview`
    - `target_sids`

2. 获取锁：`_get_render_lock(view_id)`
  - 每个 `view_id` 对应一把 `asyncio.Lock`
  - 保证同一个视口在同一时刻只有一个 active render drain 流程

3. 如果锁已经被占用
  - 当前请求不会立刻渲染
  - 而是通过 `_queue_pending_render(view_id, incoming_request)` 放进 `_pending_render_requests`

4. `_merge_render_request`
  - 如果已经存在 pending 请求，会把新请求和旧请求合并
  - 例如：
    - `target_sids` 会取并集
    - `image_format`、`fast_preview` 以最后一次请求为准

5. 如果锁空闲
  - 进入 `_drain_render_requests(view_id, initial_request)`
  - 这个方法会不断消费当前请求和后续 pending 请求

6. `_emit_render_message`
  - 先根据 `view_id` 和 `target_sids` 计算本次推送目标
  - 再通过 `asyncio.to_thread(...)` 把真正的同步渲染逻辑丢到线程里执行：
    - `viewer_service.render_view_by_id(view_id, ...)`

7. 渲染完成后
  - 组装 `(meta, image_bytes)`
  - 对所有目标 sid 发送 `image_update`

这个设计的核心价值是：

- 同一个视口高频交互时不会启动很多并发渲染
- 后来的请求可以覆盖或合并前面的请求
- 交互更流畅，资源消耗更稳定

## 7. `render_view_by_id` 实际渲染流程

入口：

- `viewer_service.render_view_by_id(view_id, image_format, fast_preview)`

### 7.1 按视图类型分发

它会先通过 `_render_by_view_type(view, ...)` 分发到：

- `_render_view`：普通 2D stack
- `_render_mpr_view`：MPR
- `_render_3d_view`：3D

### 7.2 普通 2D / MPR 渲染主线

你梳理的大方向是对的，可以补全成下面这条：

1. 获取缓存 DICOM
  - 普通 2D：`dicom_cache.get(...)`
  - MPR：先把整套序列转成 volume，再切 plane

2. 获取 `RenderPlan`
  - `_build_render_plan_for_shape(view, image_height, image_width)`
  - 根据图片尺寸、canvas 尺寸、当前 zoom 和偏移，决定本次渲染使用的 `render_view`
  - 有时为了性能会降采样渲染，再放大到目标 canvas

3. 构建图像到 canvas 的仿射变换
  - `viewport_transformer.build_image_to_canvas_transform(...)`

4. 构建角标信息 / overlay 信息
  - `_build_slice_corner_info_overlay(...)`
  - 对于 MPR 还会构建：
    - crosshair overlay
    - orientation overlay

5. 构建 `RenderContext`
  - 把 source pixels、window、transform、overlay 等打包

6. 执行渲染
  - 快速路径通常会先做：
    1. 应用窗宽窗位 `_window_array(...)`
    2. 生成灰度图 `_render_fast_grayscale_image(...)`
    3. 转成 `RGBA`
    4. 将 overlay 图层合成到最终图像上

7. 编码输出
  - `png` 或 `jpeg`
  - 返回 `RenderedImageResult(meta, image_bytes)`

### 7.3 你目前梳理中的几个关键点修正

你写的这段：

1. 应用窗、生成灰度图。 `_render_fast_grayscale_image`
2. 转为 RGBA 、然后对各个图层进行仿射变换后合并图层

这个理解方向是对的，但更准确的说法是：

- 先对 source image 应用窗宽窗位，得到基础灰度图
- 再通过仿射变换把 image 映射到 canvas
- overlay 层会基于对应的渲染上下文单独生成并最终合成
- 合成工作主要由 `layered_renderer.composite_overlays(...)` 完成

## 8. Socket 交互流程

主要在 `app/sockets/handlers.py`。

### 8.1 连接建立

- `connect`
  - 发送 `connected`

- `disconnect`
  - 调用 `view_socket_hub.unbind_sid(sid)`
  - 清理 sid 和 view 的绑定关系

### 8.2 `bind_view`

这是前端显式声明“这个 socket 想看哪个视口”的入口。

流程：

1. 校验 `viewId`
2. `view_socket_hub.bind_view(sid, view_id)`
3. 发送 `view_bound`
4. 如果该视口已经有尺寸，则立即触发一次初始渲染

### 8.3 `view_operation`

流程：

1. 解析 `ViewOperationRequest`
2. 绑定 `sid -> view_id`
3. `asyncio.to_thread(viewer_service.handle_view_operation, payload)`
4. 根据返回的 `OperationRenderOutcome` 处理三种结果：
  - `primary_result`
    - 直接把当前渲染结果发回当前 sid
  - `broadcast_view_ids`
    - 对一组视图触发 `emit_render_for_view(...)`
    - 主要用于 MPR 联动
  - `deferred_view_ids`
    - 异步安排后续渲染
    - 主要用于 3D 快速预览后再补完整渲染

### 8.4 `view_hover`

流程：

1. 解析 `ViewHoverRequest`
2. 绑定 `sid -> view_id`
3. 调用 `viewer_service.handle_view_hover(...)`
4. 返回 `hover_info`

这条链路本质上不做图像渲染，而是做：

- normalized canvas 坐标
- 通过逆变换映射回 source image row/col

## 9. MPR / 3D 的特殊路径

### 9.1 MPR

MPR 和普通 stack 的最大区别：

- 它不是直接读当前单张图
- 而是先把整套序列构造成 volume
- 再根据 `AX / COR / SAG` 提取 plane

另外 MPR 视图之间共享 `ViewGroupRecord`，所以：

- 十字线移动
- active viewport 切换
- 某些窗口调整

都可能触发 group 内广播渲染，而不是只更新单个视口。

### 9.2 3D

3D 的特殊点：

- 使用 `vtk_volume_renderer`
- 会构建 `VolumeRenderRequest`
- 支持 `fast_preview`
- 支持 `volumePreset` 和 `volumeConfig`
- 拖拽旋转时：
  - 先走快速预览
  - 再由 socket runtime 异步补发完整渲染

