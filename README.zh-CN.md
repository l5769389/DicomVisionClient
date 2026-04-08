# DicomVision Client

[English](./README.md)

DicomVision Client 是 DICOM 阅片工作流的桌面前端，负责提供浏览序列、打开 Stack/MPR/3D 视图、执行工具栏操作，并接收后端实时渲染结果的交互工作台。

客户端基于 Electron、Vue 3、Vuetify 与 Socket.IO 构建，配套后端服务位于 `D:\ct\git-repo\my\dicomVision\DicomVisionServer`。

## 目录

- [项目概览](#项目概览)
- [核心亮点](#核心亮点)
- [技术栈](#技术栈)
- [目录结构](#目录结构)
- [架构说明](#架构说明)
- [快速开始](#快速开始)
- [后端连接](#后端连接)
- [主要界面模块](#主要界面模块)
- [交互模型](#交互模型)
- [支持的视图模式](#支持的视图模式)
- [脚本命令](#脚本命令)
- [对应后端项目](#对应后端项目)

## 项目概览

DicomVision Client 是一个有状态的桌面客户端，负责驱动后端渲染并展示返回的图像帧与叠加层信息。前端本身不执行医学图像渲染。

典型用户流程：

1. 通过侧边栏加载本地 DICOM 文件夹。
2. 选择序列并打开一个或多个视口类型。
3. 绑定视口尺寸并初始化工作区状态。
4. 通过工具栏和鼠标手势进行交互。
5. 实时接收后端返回的渲染图像和叠加信息。

## 核心亮点

- 基于 Electron 的桌面应用
- 使用 Vue 3 + Vuetify 构建渲染层界面
- 基于 Socket.IO 的实时视口更新
- 支持 Stack、MPR 和 3D 三类阅片模式
- 通过侧边栏完成序列加载、状态展示与设置操作
- 通过工具栏完成图像交互与 3D 预设切换
- 提供独立的 3D 参数面板用于传输函数调节

## 技术栈

- Electron
- electron-vite
- Vue 3
- TypeScript
- Vuetify
- Tailwind CSS
- Axios
- Socket.IO Client

## 目录结构

```text
src/
  main/                    Electron 主进程
  preload/                 预加载桥接层
  renderer/                Vue 渲染层应用
  shared/                  共享契约与类型

src/renderer/src/
  components/              界面组件
  composables/             组合式状态与交互逻辑
  plugins/                 渲染层插件配置
  services/                HTTP 与 Socket 客户端
  types/                   前端领域类型
```

## 架构说明

客户端由三层组成：

- Electron 主进程，负责桌面窗口生命周期
- preload 层，负责受控桥接
- Vue 渲染层，负责完整的阅片交互体验

前端核心职责：

- 通过后端 HTTP API 加载本地 DICOM 目录
- 管理视图标签与工作区布局
- 发送平移、缩放、滚动、重置、十字线与 3D 操作等交互事件
- 接收后端返回的渲染图像帧与叠加元数据
- 提供 3D 预设与自定义体渲染参数的配置入口

## 快速开始

### 环境要求

- 推荐使用 Node.js 20+
- npm
- 需要先运行 DicomVision Server，默认地址 `http://127.0.0.1:8000`

### 安装依赖

```bash
npm install
```

### 启动开发模式

```bash
npm run dev
```

该命令会通过 `electron-vite` 启动 Electron 开发环境。

### 生产构建

```bash
npm run build
```

如需类型检查：

```bash
npm run typecheck
```

## 后端连接

当前渲染层代码中的默认连接地址：

- API 基础地址：`http://127.0.0.1:8000/api/v1`
- Socket.IO 地址：`http://127.0.0.1:8000`

相关代码文件：

- `src/renderer/src/services/api.ts`
- `src/renderer/src/services/socket.ts`
- `src/renderer/src/composables/useViewerWorkspace.ts`

在打开视口或进行交互之前，请确保后端服务已经启动。

## 主要界面模块

- `SidebarPanel.vue`：左侧工作流区域容器
- `SidebarSeriesList.vue`：已加载序列列表
- `ViewerWorkspace.vue`：主工作区容器
- `ViewerToolbar.vue`：操作工具栏
- `ViewerTabStrip.vue`：标签页管理
- `StackView.vue`：Stack 视图
- `MprView.vue`：MPR 视图
- `VolumeView.vue`：3D 视图
- `VolumeRenderConfigPanel.vue`：3D 自定义渲染参数面板

## 交互模型

前端主要承担以下交互职责：

- 序列加载
- 视口创建与布局管理
- 鼠标驱动操作
- 工具栏动作分发
- 实时图像与叠加层展示

## 支持的视图模式

- Stack
- MPR
- 3D 体视图

3D 工作流支持预设切换以及可编辑的传输函数控制，包括图层显隐、WW/WL、透明度、颜色渐变、混合模式与光照行为。

## 脚本命令

- `npm run dev`：以开发模式启动 Electron
- `npm run build`：使用 electron-vite 构建应用
- `npm run preview`：预览构建结果
- `npm run typecheck`：执行渲染层与 Node 侧 TypeScript 检查

## 对应后端项目

配套后端项目位于：

`D:\ct\git-repo\my\dicomVision\DicomVisionServer`

推荐启动顺序：

1. 先启动后端服务。
2. 再启动 Electron 客户端。
3. 最后在界面中加载 DICOM 目录并创建视口。
