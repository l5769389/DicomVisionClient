# DicomVision

[English](./README.en.md)

DicomVision 是一套 C/S 架构的 DICOM Viewer，包含 Vue/Electron 客户端和 FastAPI 后端。它把 DICOM 解析、MPR/4D/3D 等重计算和部分渲染放在后端完成，再把结果推送给前端显示，适合在普通办公电脑、集显设备或显存较小的环境中进行影像浏览、重建、测量、PACS 检索和元数据处理。

## 适合什么场景

DicomVision 更适合这些情况：

- 阅片端设备是集显、低端独显或显存较小，前端直接做复杂渲染容易卡顿。
- 希望把 DICOM 解码、体数据重建、4D/MPR/3D、PACS 下载缓存等工作集中放到后端。
- 需要 Windows/macOS 桌面端，并希望安装包内置后端服务，用户打开软件即可使用。
- 需要 PACS Browser、DICOMweb/DIMSE 查询下载、DICOM Tag 查看与编辑、脱敏导出、SR/GSPS 导出等完整工具链。
- Web 端只是作为轻量前端连接远程后端，而不是把所有 DICOM 数据和渲染压力都放在浏览器里。

如果阅片端有较好的独显和显存，且目标是浏览器内的纯前端 DICOM Viewer，我更建议优先考虑 Cornerstone3D（C3D）这类完全前端方案。它部署链路更轻，交互延迟更低，也更符合“前端直接持有体数据并完成渲染”的场景。DicomVision 的优势主要在于把重活移到后端，让低显存设备也能使用较完整的 DICOM Viewer 能力。

## 主要功能

- 本地 DICOM 文件/文件夹拖拽导入，按患者、检查、序列组织数据。
- PACS Browser：支持 DICOMweb 与 DIMSE Profile，查询检查/序列，下载后直接打开。
- Stack、Compare Stack、MPR、斜切 MPR、MPR + 3D、3D 体渲染和 4D 时相播放。
- 多序列布局、可配置 MPR 布局、序列树导航、关键层面书签。
- 线段、矩形、椭圆、角度、曲线、自由形状测量，以及 MTF/FWHM、水模 QA。
- DICOM Tag 树查看、VR 感知编辑、批量修改、脱敏导出。
- 测量/标注可导出为 PNG、DICOM、DICOM SR 和 DICOM GSPS。
- 支持导入 GSPS 并叠加显示到原始影像；单独导入 SR/GSPS 时会以 DICOM Tags 视图查看。
- Windows/macOS Electron 桌面端打包，桌面端可内置后端 bundle。

## 在线预览

https://dicom-vision-client.vercel.app/

http://111.228.1.213/

公开 Web 预览连接远程后端，适合快速体验 UI 和基础流程。真实 PACS、桌面端内置后端和本地大数据量场景建议使用本地部署或桌面端。

## 仓库

- 客户端：[https://github.com/l5769389/DicomVisionClient](https://github.com/l5769389/DicomVisionClient)
- 服务端：[https://github.com/l5769389/DicomVisionServer](https://github.com/l5769389/DicomVisionServer)

## 基础操作演示

<img src="./screenshots/basic_operations_demo.gif" alt="DicomVision 基础操作演示" width="880">

## 截图

| 工作区首页 | 已加载序列 |
| --- | --- |
| <img src="./screenshots/home_page.png" alt="DicomVision 工作区首页" width="420"> | <img src="./screenshots/home_page_loaded_series.png" alt="已加载 DICOM 序列" width="420"> |

| PACS 数据源 | PACS Browser 导入 |
| --- | --- |
| <img src="./screenshots/pacs_dicom_import.png" alt="PACS DICOMweb 和 DIMSE Profile 设置" width="420"> | <img src="./screenshots/pacs_dicom_import_1.png" alt="PACS Browser 查询并打开已下载序列" width="420"> |

| 布局阅片 | Stack 对比 |
| --- | --- |
| <img src="./screenshots/view_layout.png" alt="多视口布局阅片" width="420"> | <img src="./screenshots/compare_view.png" alt="Stack 双序列对比" width="420"> |

| 斜切 MPR / 十字线旋转 | 4D 时相播放 |
| --- | --- |
| <img src="./screenshots/mpr_rotate.png" alt="斜切 MPR 与十字线旋转" width="420"> | <img src="./screenshots/4D.png" alt="4D 时相播放" width="420"> |

| 测量工具 | 曲线/自由形状测量 |
| --- | --- |
| <img src="./screenshots/measure_line_angle_rect_ellipse.png" alt="线段、角度、矩形和椭圆测量" width="420"> | <img src="./screenshots/measure_curve_freedom.png" alt="曲线和自由形状测量" width="420"> |

| DICOM 标签 | 批量 Tag 修改 |
| --- | --- |
| <img src="./screenshots/dicomTags.png" alt="DICOM Tag 树查看" width="420"> | <img src="./screenshots/batch_modify_tags.png" alt="DICOM Tag 批量修改" width="420"> |

| MTF 分析 | FWHM 结果 |
| --- | --- |
| <img src="./screenshots/mtf_fwhm_1.png" alt="MTF 分析流程" width="420"> | <img src="./screenshots/mtf_fwhm_2.png" alt="FWHM 分析结果" width="420"> |

| 水模 QA | 设置 |
| --- | --- |
| <img src="./screenshots/water_phantom_qa.png" alt="水模 QA" width="420"> | <img src="./screenshots/settings.png" alt="设置面板" width="420"> |

| 深色主题 | 蓝色主题 |
| --- | --- |
| <img src="./screenshots/theme.png" alt="工业深色主题" width="420"> | <img src="./screenshots/theme_blue.png" alt="冷蓝深色主题" width="420"> |

| 拖拽导入 | 脱敏导出 |
| --- | --- |
| <img src="./screenshots/drap_import.png" alt="拖拽导入 DICOM" width="420"> | <img src="./screenshots/deIndentifyExport.png" alt="DICOM 脱敏导出" width="420"> |

## 架构

DicomVision 拆分为两个仓库：

- `DicomVisionClient`：Electron + Vue 前端，负责工作区编排、UI 状态、用户交互、Web 构建和桌面端打包。
- `DicomVisionServer`：FastAPI + Socket.IO 后端，负责 DICOM 发现、元数据服务、2D 渲染、MPR/4D/3D 计算、测量分析和实时图像推送。

典型运行流程：

1. 客户端加载本地文件夹、服务端可访问路径、PACS 下载缓存或示例数据。
2. 服务端发现可读 DICOM 序列并返回序列元数据。
3. 客户端创建 Stack、Compare、MPR、3D、4D 或 DICOM Tag 标签页。
4. 视口通过 Socket.IO 与服务端视图会话绑定。
5. 用户交互持续发送到服务端。
6. 服务端实时回推渲染帧、叠加层、悬停信息、确认事件和错误信息。

## 快速开始

### 1. 启动服务端

```bash
cd ../DicomVisionServer
uv sync
uv run python run.py
```

默认服务地址：

- HTTP：`http://127.0.0.1:8000`
- OpenAPI：`http://127.0.0.1:8000/docs`
- Socket.IO：`http://127.0.0.1:8000/socket.io`

### 2. 启动桌面客户端

```bash
cd ../DicomVisionClient
npm install
npm run dev
```

桌面开发模式默认连接 `http://127.0.0.1:8000`。如需指定其他后端：

```powershell
$env:DICOM_VISION_SERVER_ORIGIN = "http://127.0.0.1:8000"
npm run dev
```

## Web 开发与部署

```bash
npm run dev:web
npm run build:web
npm run preview:web
```

生产环境变量示例：

```env
VITE_BACKEND_ORIGIN=https://your-backend.example.com
VITE_WEB_APP_MODE=web
```

部署时需要：

- 将 `DicomVisionServer` 部署为 HTTP + Socket.IO 后端。
- 将客户端 Web 构建产物部署到 Vercel、静态托管或任何支持 SPA 的服务。
- 在后端 `CORS_ORIGINS` 中加入前端域名。
- 浏览器上传模式使用 `VITE_WEB_APP_MODE=web`；公开演示站可使用 `VITE_WEB_APP_MODE=demo-web`。

## 桌面端打包

一键 Windows 发布，要求 `DicomVisionServer` 与本仓库处于同级目录：

```powershell
npm run release:win
```

macOS 需要在 macOS 上构建：

```bash
npm run release:mac
```

桌面端发布产物位于 `dist-electron/`。运行时 Electron 主进程会启动内置后端，并把 UI 连接到自动分配的本地端口。

## 常用脚本

- `npm run dev`：启动 Electron 桌面开发运行时。
- `npm run dev:web`：启动浏览器端 Vite 开发服务。
- `npm run build`：构建 Electron main、preload 和 renderer。
- `npm run build:web`：构建独立 Web 前端。
- `npm run generate:api-types`：从服务端 OpenAPI 重新生成前端 API 类型。
- `npm run typecheck`：运行 TypeScript 类型检查。
- `npm run test:run`：运行 Vitest。
- `npm run release:win`：构建后端桌面 bundle 并打包 Windows 安装器。
- `npm run release:mac`：在 macOS 上构建后端 bundle 并打包 DMG/ZIP。

## 服务端说明

后端 API、Socket.IO 事件、部署和桌面 bundle 细节见：

[DicomVisionServer README](https://github.com/l5769389/DicomVisionServer)
