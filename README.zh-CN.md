# DicomVision Client

[English](./README.md)

DicomVision Client 是 DicomVision 阅片系统的前端仓库，负责桌面端与 Web 端的工作流编排、视口管理、交互工具和实时显示；配套后端负责 DICOM 解析、MPR 重建与 3D 体渲染。

配套后端仓库 GitHub 地址：[DicomVisionServer](https://github.com/l5769389/DicomVisionServer)

## 项目概述

DicomVision 采用前后端分离的医学影像查看架构：

- `DicomVisionClient`：基于 Electron + Vue 的交互前端
- `DicomVisionServer`：基于 FastAPI + Socket.IO 的渲染与服务后端

前端本身不直接完成医学图像渲染，而是负责驱动业务流程、管理工作区状态，并实时接收后端返回的图像帧、叠加信息和交互反馈。

## 软件功能

### 影像浏览工作流

- 从桌面端选择本地 DICOM 文件夹
- 在左侧工作流区域浏览加载后的序列
- 创建多个标签页和多个视口会话
- 在同一工作区中切换不同序列和不同阅片模式

### 多视图阅片能力

- Stack 模式：逐层浏览切片
- MPR 模式：进行正交重建与联动查看
- 3D 模式：基于后端 VTK 管线进行体渲染

### 交互能力

- 平移、缩放、滚动、重置、视口尺寸更新
- 十字线联动与导航交互
- 悬停信息反馈与叠加层展示
- 通过工具栏统一下发图像操作与视图操作

### 3D 渲染配置

- 内置多种 3D 预设
- 支持传输函数编辑
- 支持图层显隐、颜色、不透明度、WW/WL、光照等配置
- 支持快速预览与完整渲染更新流程

### 产品化能力

- 提供 Electron 桌面运行形态
- 提供 Web 构建与部署路径
- 支持将后端桌面 bundle 一并打入 Windows 安装包

## 系统架构

系统使用两条通信链路：

- HTTP API：处理加载目录、创建视口、设置视口尺寸等粗粒度操作
- Socket.IO：处理低延迟交互命令和实时图像更新

典型运行流程如下：

1. 用户在客户端中选择 DICOM 文件夹。
2. 前端调用后端接口注册并解析可读序列。
3. 前端创建 Stack、MPR 或 3D 视口。
4. 前端将视口与 socket 会话绑定。
5. 用户交互事件持续发送到后端。
6. 后端实时回传渲染结果、叠加信息和确认事件。

## 技术栈

### 前端

- Electron
- Vue 3
- TypeScript
- Vuetify
- Tailwind CSS
- Axios
- Socket.IO Client
- electron-vite

### 后端

- Python 3.13+
- FastAPI
- python-socketio
- pydicom
- NumPy / SciPy
- Pillow
- VTK
- uv

## 目录结构

```text
src/
  main/                    Electron 主进程
  preload/                 Electron 预加载桥接层
  renderer/                Vue 渲染层应用
  shared/                  共享运行时配置与契约

src/renderer/src/
  components/              UI 组件
  composables/             工作区状态与交互逻辑
  plugins/                 Vue / Vuetify 初始化
  services/                HTTP 与 Socket.IO 客户端
  types/                   前端领域类型

docs/                      项目文档与实现说明
screenshots/               README 与发布截图目录
scripts/                   打包与发布脚本
```

## 主要界面模块

- `ViewerWorkspace.vue`：主工作区与视口编排容器
- `ViewerToolbar.vue`：交互工具栏
- `ViewerTabStrip.vue`：标签页与会话切换
- `SidebarPanel.vue`：加载流程、序列浏览与设置区域
- `StackView.vue`：Stack 视口
- `MprView.vue`：MPR 视口
- `VolumeView.vue`：3D 视口
- `VolumeRenderConfigPanel.vue`：3D 高级渲染参数面板

## 前后端使用说明

### 1. 启动后端

后端仓库地址：

[https://github.com/l5769389/DicomVisionServer](https://github.com/l5769389/DicomVisionServer)

安装依赖：

```bash
uv sync
```

启动服务：

```bash
uv run python run.py
```

默认地址：

- HTTP：`http://127.0.0.1:8000`
- OpenAPI：`http://127.0.0.1:8000/docs`
- Socket.IO：`http://127.0.0.1:8000/socket.io`

### 2. 启动前端开发环境

安装依赖：

```bash
npm install
```

启动 Electron 客户端：

```bash
npm run dev
```

需要注意：

- 桌面开发模式下，必须先手动启动后端服务。
- 当前桌面开发模式默认连接 `http://127.0.0.1:8000`。
- 如果后端不可达，客户端界面仍可能打开，但阅片工作流无法正常使用。

### 3. 本地联调建议流程

1. 先启动 `DicomVisionServer`。
2. 再启动 `DicomVisionClient`。
3. 在客户端中选择本地 DICOM 文件夹。
4. 从左侧序列列表中选择目标序列。
5. 创建 Stack、MPR 或 3D 视口。
6. 通过工具栏和鼠标手势进行浏览与交互。

## Web 端使用

本地启动 Web 前端：

```bash
npm run dev:web
```

构建 Web 产物：

```bash
npm run build:web
```

预览 Web 产物：

```bash
npm run preview:web
```

相关环境变量：

- `VITE_BACKEND_ORIGIN`：Web 前端连接的后端地址
- `VITE_WEB_USE_SERVER_SAMPLE`：是否启用服务端示例数据加载路径

当前默认值：

- Web 开发默认后端：`http://127.0.0.1:8000`
- 当前生产示例后端：`https://dicomvisionserver.onrender.com`

可进一步参考：

- [docs/web-packaging.zh-CN.md](./docs/web-packaging.zh-CN.md)
- [docs/web-deploy-render-vercel.zh-CN.md](./docs/web-deploy-render-vercel.zh-CN.md)

## 构建与发布

### 前端构建

```bash
npm run build
```

### 类型检查

```bash
npm run typecheck
```

### Windows 安装包

当前仓库负责打包 Electron 客户端，并消费后端预先构建好的桌面 bundle。

典型打包流程：

1. 在 `DicomVisionServer` 中构建后端桌面 bundle。
2. 将该 bundle 暂存到当前仓库。
3. 生成 Electron Windows 安装包。

可用脚本：

- `npm run build`：构建 Electron 应用
- `npm run release:win`：串联后端 bundle 构建与 Windows 安装包打包

相关脚本：

- `scripts/stage-server-bundle.ps1`
- `scripts/package-win.ps1`
- `scripts/release-win.ps1`

打包后的桌面版会从 `resources/server/DicomVisionServer.exe` 自动启动内置后端。

## 后端连接说明

前端中与后端连接相关的关键文件：

- `src/shared/appConfig.ts`
- `src/renderer/src/services/api.ts`
- `src/renderer/src/services/socket.ts`
- `src/renderer/src/composables/workspace/connection/useViewerWorkspaceConnection.ts`
- `src/main/index.ts`

桌面开发模式默认配置：

- Host：`127.0.0.1`
- Port：`8000`

打包后的桌面应用会在运行时为内置后端分配可用端口，并将 UI 自动连接到解析后的后端地址。

## 截图目录

README 和发布展示图统一放在 [`screenshots/`](./screenshots/) 目录中。

建议后续补充以下截图：

- 主工作区总览
- Stack 视口
- MPR 联动布局
- 3D 渲染配置面板
- 序列加载与侧边栏流程

## 关联仓库

后端项目：

[DicomVisionServer](https://github.com/l5769389/DicomVisionServer)
