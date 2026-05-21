# DicomVision

[English](./README.md)

DicomVision 是一套 C/S 架构的 DICOM Viewer，面向影像浏览、重建、测量、QA、元数据审阅、序列对比与脱敏导出。软件支持 Stack、MPR/斜切 MPR、3D 体渲染、4D 时相播放、布局阅片、同步对比、DICOM Tag 修改与 Web / Windows 桌面部署。

## 核心亮点

- 支持患者 / 检查层级的序列管理、拖拽导入、标签页阅片和可配置布局。
- 覆盖 Stack、Compare、MPR、MPR + 3D、3D 体渲染和 4D 时相工作流。
- 提供测量、标注、MTF/FWHM、水模 QA 等影像评估能力。
- 支持 DICOM Tag 树形查看、VR 感知修改、批量修改和脱敏导出。
- 支持主题、布局、伪彩、测量、ROI、导出和 Hanging Protocol 等偏好设置。

## 功能总览

- **加载与工作区**：导入 DICOM 文件 / 文件夹，按患者和检查组织序列，并以多标签页管理不同阅片任务。
- **2D 与对比阅片**：Stack 支持播放速度、伪彩、窗宽窗位、变换工具和布局；Compare/Layout 可按需同步关键操作。
- **重建与渲染**：支持 MPR、斜切 MPR、MPR + 3D、服务端 3D 体渲染和 4D 时相播放。
- **测量与 QA**：支持线段、矩形、椭圆、角度、曲线、自由形状测量，以及 MTF/FWHM 和水模 QA。
- **DICOM 数据操作**：支持 Tag 树形审阅、VR 感知修改、批量 Tag 修改、脱敏导出和图像 / DICOM 导出。
- **部署形态**：Web 端可连接远程后端；桌面端可打包为内置后端的 Windows Electron 应用。

## Web端演示
https://dicom-vision-client.vercel.app/

## 仓库地址

- 客户端 Client：[https://github.com/l5769389/DicomVisionClient](https://github.com/l5769389/DicomVisionClient)
- 服务端 Server：[https://github.com/l5769389/DicomVisionServer](https://github.com/l5769389/DicomVisionServer)

## 项目截图

| 工作区首页 | 已加载序列 |
| --- | --- |
| <img src="./screenshots/home_page.png" alt="DicomVision 工作区首页" width="420"> | <img src="./screenshots/home_page_loaded_series.png" alt="已加载 DICOM 序列" width="420"> |

| 布局阅片 | Stack 对比 |
| --- | --- |
| <img src="./screenshots/view_layout.png" alt="多视口布局阅片" width="420"> | <img src="./screenshots/compare_view.png" alt="Stack 双序列对比" width="420"> |

| 斜切 MPR / 十字线旋转 | 4D 时相播放 |
| --- | --- |
| <img src="./screenshots/mpr_rotate.png" alt="斜切 MPR 与十字线旋转" width="420"> | <img src="./screenshots/4D.png" alt="4D 时相播放" width="420"> |

| 基础测量 | 曲线 / 自由形状测量 |
| --- | --- |
| <img src="./screenshots/measure_line_angle_rect_ellipse.png" alt="线段、角度、矩形和椭圆测量" width="420"> | <img src="./screenshots/measure_curve_freedom.png" alt="曲线和自由形状测量" width="420"> |

| DICOM 标签 | DICOM Tag 批量修改 |
| --- | --- |
| <img src="./screenshots/dicomTags.png" alt="DICOM Tag 树形审阅" width="420"> | <img src="./screenshots/batch_modify_tags.png" alt="DICOM Tag 批量修改" width="420"> |

| MTF 分析 | FWHM 结果 |
| --- | --- |
| <img src="./screenshots/mtf_fwhm_1.png" alt="MTF 分析流程" width="420"> | <img src="./screenshots/mtf_fwhm_2.png" alt="FWHM 分析结果" width="420"> |

| 水模 QA | 设置面板 |
| --- | --- |
| <img src="./screenshots/water_phantom_qa.png" alt="水模 QA" width="420"> | <img src="./screenshots/settings.png" alt="设置面板" width="420"> |

| 工业深色主题 | 冷蓝深色主题 |
| --- | --- |
| <img src="./screenshots/theme.png" alt="工业深色主题" width="420"> | <img src="./screenshots/theme_blue.png" alt="冷蓝深色主题" width="420"> |

| 拖拽导入 | 脱敏导出 |
| --- | --- |
| <img src="./screenshots/drap_import.png" alt="拖拽导入 DICOM" width="420"> | <img src="./screenshots/deIndentifyExport.png" alt="DICOM 脱敏导出" width="420"> |

## 系统架构

DicomVision 拆分为两个仓库：

- `DicomVisionClient`：Electron + Vue 前端，负责工作区编排、UI 状态、用户交互、Web 构建和桌面端打包。
- `DicomVisionServer`：FastAPI + Socket.IO 后端，负责 DICOM 发现、元数据服务、2D 渲染、MPR/4D/3D 计算、测量分析和实时图像推送。

典型运行流程：

1. 客户端加载本地文件夹、服务端可访问路径或服务端示例数据。
2. 服务端发现可读 DICOM 序列并返回序列元数据。
3. 客户端创建 Stack、MPR、3D、4D 或 DICOM Tag 标签页。
4. 视口通过 Socket.IO 与服务端会话绑定。
5. 用户操作持续发送到服务端。
6. 服务端实时回推渲染帧、叠加层、悬停信息、确认事件和错误信息。

## 技术栈

- Vue 3
- TypeScript
- Electron
- electron-vite
- Vite Web 构建
- Vuetify
- Tailwind CSS
- Axios
- Socket.IO Client
- Vitest
- electron-builder

## 目录结构

```text
src/
  main/                    Electron 主进程与内置后端启动逻辑
  preload/                 Electron 预加载桥接层
  renderer/                Vue 渲染层应用
  shared/                  共享运行时配置、常量和生成的 API 类型

src/renderer/src/
  components/              侧边栏、工作区、视口、叠加层和设置 UI
  composables/             阅片工作区状态和交互编排
  constants/               前端常量
  platform/                桌面端 / Web 端运行时适配
  services/                HTTP 与 Socket.IO 客户端
  types/                   阅片领域类型

screenshots/               README 与发布截图
scripts/                   安装器素材、服务端暂存和 Windows 发布脚本
```

## 快速开始

### 1. 启动服务端

```bash
cd ../DicomVisionServer
uv sync
uv run python run.py
```

服务端默认地址：

- HTTP：`http://127.0.0.1:8000`
- OpenAPI：`http://127.0.0.1:8000/docs`
- Socket.IO：`http://127.0.0.1:8000/socket.io`

### 2. 启动桌面客户端

```bash
cd ../DicomVisionClient
npm install
npm run dev
```

桌面开发模式默认要求后端已运行在 `http://127.0.0.1:8000`。如果需要连接其它后端地址，可以设置：

```powershell
$env:DICOM_VISION_SERVER_ORIGIN = "http://127.0.0.1:8000"
npm run dev
```

## Web 端开发与部署

本地启动 Web 客户端：

```bash
npm run dev:web
```

构建静态 Web 产物：

```bash
npm run build:web
```

预览 Web 构建结果：

```bash
npm run preview:web
```

生产环境常用变量：

```env
VITE_BACKEND_ORIGIN=https://your-backend.example.com
VITE_WEB_APP_MODE=web
```

部署说明：

- 将 `DicomVisionServer` 部署为 HTTP + Socket.IO 后端；服务端仓库内已有面向 Render 的配置。
- 将客户端 `dist-web/` 目录部署到 Vercel、静态托管或其它支持 SPA 的平台。
- 将 Web 前端域名加入服务端 `CORS_ORIGINS`。
- 使用 `VITE_WEB_APP_MODE=web` 启用浏览器文件 / 文件夹上传；使用 `VITE_WEB_APP_MODE=demo-web` 启用公开演示版并加载后端 sample 数据。

## 桌面端打包

桌面端是 Electron 应用，可以将服务端产物一起打入安装包，并在运行时自动拉起本地后端。

如果 `DicomVisionServer` 与当前仓库位于同级目录，可一键生成 Windows 安装包：

```powershell
npm run release:win
```

如果已经有服务端 bundle，也可以手动打包：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-win.ps1 -ServerBundlePath "D:\path\to\DicomVisionServer"
```

服务端 bundle 目录需要满足：

```text
DicomVisionServer/
  DicomVisionServer.exe
  ...
```

生成的安装包位于 `dist-electron/`。运行时 Electron 主进程会从 `resources/server/DicomVisionServer.exe` 启动内置服务端，分配本地端口，并让 UI 自动连接到解析后的后端地址。

## 常用脚本

- `npm run dev`：启动 Electron 桌面开发环境。
- `npm run dev:web`：启动浏览器端 Vite 开发服务。
- `npm run build`：构建 Electron main、preload 和 renderer 产物。
- `npm run build:web`：构建独立 Web 前端到 `dist-web/`。
- `npm run preview`：预览 Electron 构建结果。
- `npm run preview:web`：预览 Web 构建结果。
- `npm run generate:api-types`：从服务端 OpenAPI schema 重新生成前端 API 类型。
- `npm run typecheck`：运行 Web 与 Electron 项目的 TypeScript 检查。
- `npm run test:run`：运行一次 Vitest。
- `npm run release:win`：构建服务端桌面 bundle 并生成 Windows 安装包。

## 后端 README

后端 API、Socket.IO 事件、Render 部署和桌面 bundle 说明见：

[DicomVisionServer README](https://github.com/l5769389/DicomVisionServer)
