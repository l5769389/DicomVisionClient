# DicomVision

[English](./README.en.md)

**面向桌面、Web 与移动端的远程渲染 DICOM 工作站**

DicomVision 是一套面向医学影像浏览、分析和教学验证场景的 DICOM Viewer。项目采用 C/S 架构：客户端基于 Vue、TypeScript 和 Electron 构建，后端基于 FastAPI、Socket.IO 和医学影像处理栈完成 DICOM 解析、渲染、重建、分析和导出，并将结果实时推送到桌面端、Web 端和移动端界面。

## 项目概览

- 在线预览：[https://dicom.zhaolin.online/](https://dicom.zhaolin.online/)
- Client 仓库：[https://github.com/l5769389/DicomVisionClient](https://github.com/l5769389/DicomVisionClient)
- Server 仓库：[https://github.com/l5769389/DicomVisionServer](https://github.com/l5769389/DicomVisionServer)
- 当前发布：[DicomVision v3.1.3](https://github.com/l5769389/DicomVisionClient/releases/tag/v3.1.3)

DicomVision 将 DICOM 解析、重建、渲染和计算密集型分析置于后端，将交互、工作流和结果呈现置于客户端。浏览器、移动端和桌面端因此复用同一套影像能力，并可部署在局域网、云服务器或带内置后端的桌面安装包中。

本项目特别适合客户端显存有限、但仍需要稳定使用统一 DICOM 浏览和后端 2D/3D 渲染能力的场景。对于显存充足且以本地 GPU 交互性能为首要目标的工作站，应优先评估 C3D 等原生方案；对于计算和界面必须同进程部署的产品，也可采用 Python/C++ 等前后端不分离的架构。DicomVision 的 C/S 设计侧重跨端复用、集中式渲染与轻量客户端接入。

## 架构与适用范围

- **统一渲染服务**：FastAPI、Socket.IO、VTK 与医学影像处理链路在服务端执行，客户端保持轻量。
- **双端 3D 传输**：启动时可选择 WebP 静帧或 WebRTC 低延迟预览；交互稳定后保留高质量最终帧。
- **多端一致工作流**：Electron 桌面端、浏览器和移动端共享视图、工具、PACS 与导出能力。
- **安全导入**：支持 DICOM 文件、目录、ZIP、7z 与 RAR；压缩包在服务端临时目录中按路径、条目数、解压体积和压缩比限制处理。

## 核心能力

- **数据导入**：支持 DICOM 文件、文件夹、拖拽导入、浏览器上传，以及 ZIP、7z、RAR 压缩包；支持服务端样例数据与 PACS DICOMweb/DIMSE 查询和下载。
- **2D 浏览**：支持窗宽窗位、缩放、平移、滚动、翻转、旋转、伪彩、同步浏览、Compare、Layout、多序列和多视图工作区。
- **MPR 与 4D**：支持 AX/COR/SAG 三视图、斜切 MPR、十字线同步、MPR 播放、4D phase 播放、FPS 控制和时相同步。
- **3D 可视化**：支持 VR 体渲染、Surface 渲染、MIP/XRay 类模板、AAA/CT/CTA/MR/CBCT 自适应预设、WebRTC 低延迟交互、3D 参数面板、去床板、自由形状裁剪、标准解剖朝向和移动端触控 3D。
- **PET/CT Fusion**：支持 PET/CT 融合浏览、PET-only、SUV/强度范围控制、手动配准、配准保存、Fusion 四宫格和单视口切换。
- **测量与标注**：支持线段、矩形、椭圆、角度、曲线、自由形状测量，箭头和文本标注，实时 draft 与 ROI 指标。
- **分割与 QA**：支持 MPR 阈值分割、球形 VOI、分割 overlay、分割导入导出、MTF/FWHM、水模 QA 和结果报告。
- **DICOM 与导出**：支持 DICOM Tag 树查看、VR 感知编辑、批量 Tag 修改、脱敏导出、PNG、DICOM、DICOM SR 和 DICOM GSPS 导出。
- **多端体验**：支持桌面端、Web 端和移动端响应式界面，提供深色、浅色和蓝色主题；桌面安装包内置后端服务。

## 在线预览

[https://dicom.zhaolin.online/](https://dicom.zhaolin.online/)

公开 Web 预览适合体验 UI、基础流程和远程渲染能力。真实 PACS、本地大数据量、桌面端内置后端和隐私数据场景，建议使用本地部署或桌面端。

## 演示

<img src="./screenshots/basic_operations_demo.gif" alt="DicomVision 基础操作演示" width="880">

<img src="./screenshots/mobile_use_gif.gif" alt="DicomVision 移动端操作演示" width="420">

## 截图

| 工作区首页 | 已加载序列 |
| --- | --- |
| <img src="./screenshots/home_page.png" alt="DicomVision 工作区首页" width="420"> | <img src="./screenshots/home_page_loaded_series.png" alt="已加载 DICOM 序列" width="420"> |

| PET/CT 融合 | PET/CT 手动配准 |
| --- | --- |
| <img src="./screenshots/pet_ct_fusion.png" alt="PET/CT 融合浏览" width="420"> | <img src="./screenshots/pet_ct_fusion_registration.png" alt="PET/CT 手动配准" width="420"> |

| MPR 与斜切 | 4D 时相 |
| --- | --- |
| <img src="./screenshots/mpr_rotate.png" alt="MPR 斜切与十字线旋转" width="420"> | <img src="./screenshots/4D.png" alt="4D 时相播放" width="420"> |

| MTF/FWHM | 分割与 VOI |
| --- | --- |
| <img src="./screenshots/mtf_fwhm_1.png" alt="MTF/FWHM 分析" width="420"> | <img src="./screenshots/segmentation_voi.png" alt="MPR 阈值分割与 VOI" width="420"> |

| 水模 QA | 浅色主题 |
| --- | --- |
| <img src="./screenshots/water_phantom_qa.png" alt="水模 QA" width="420"> | <img src="./screenshots/theme_light.png" alt="浅色主题" width="420"> |

| 移动端首页 | 移动端 2D |
| --- | --- |
| <img src="./screenshots/mobile_home_page.png" alt="移动端首页" width="260"> | <img src="./screenshots/mobile_2d.png" alt="移动端 2D 浏览" width="260"> |

| 移动端 MPR | 移动端 4D |
| --- | --- |
| <img src="./screenshots/mobile_mpr.png" alt="移动端 MPR" width="260"> | <img src="./screenshots/mobile_4D.png" alt="移动端 4D" width="260"> |

| 移动端 PET/CT | 移动端设置 |
| --- | --- |
| <img src="./screenshots/mobile_pet_ct_fusion.png" alt="移动端 PET/CT 融合" width="260"> | <img src="./screenshots/mobile_setting.png" alt="移动端设置" width="260"> |

| PACS 数据源 | PACS Browser |
| --- | --- |
| <img src="./screenshots/pacs_dicom_import.png" alt="PACS DICOMweb 和 DIMSE 设置" width="420"> | <img src="./screenshots/pacs_dicom_import_1.png" alt="PACS Browser 查询与导入" width="420"> |

| 测量工具 | DICOM Tag |
| --- | --- |
| <img src="./screenshots/measure_line_angle_rect_ellipse.png" alt="线段、角度、矩形和椭圆测量" width="420"> | <img src="./screenshots/dicomTags.png" alt="DICOM Tag 查看" width="420"> |

| 拖拽导入 | 脱敏导出 |
| --- | --- |
| <img src="./screenshots/drap_import.png" alt="拖拽导入 DICOM" width="420"> | <img src="./screenshots/deIndentifyExport.png" alt="DICOM 脱敏导出" width="420"> |

## 快速开始

### 启动 Server

```bash
cd ../DicomVisionServer
uv sync
uv run python run.py
```

默认地址：

- HTTP: `http://127.0.0.1:8000`
- OpenAPI: `http://127.0.0.1:8000/docs`
- Socket.IO: `http://127.0.0.1:8000/socket.io`

### 启动桌面客户端

```bash
cd ../DicomVisionClient
npm install
npm run dev
```

如果需要指定后端：

```powershell
$env:DICOM_VISION_SERVER_ORIGIN = "http://127.0.0.1:8000"
npm run dev
```

### 启动 Web 开发服务

```bash
npm run dev:web
```

### 构建 Web 静态包

```bash
npm run build:web
```

生产环境变量示例：

```env
VITE_BACKEND_ORIGIN=https://your-backend.example.com
VITE_WEB_APP_MODE=web
```

## 开发

常用脚本：

- `npm run dev`：启动 Electron 桌面开发运行时。
- `npm run dev:web`：启动 Web Vite 开发服务。
- `npm run build`：构建 Electron main、preload 和 renderer。
- `npm run build:web`：构建独立 Web 前端到 `dist-web/`。
- `npm run preview:web`：本地预览 Web 静态构建。
- `npm run generate:api-types`：从 Server OpenAPI 重新生成前端 API 类型。
- `npm run typecheck`：运行 TypeScript 类型检查。
- `npm run test:run`：运行 Vitest。
- `npm run release:win`：构建后端桌面 bundle 并打包 Windows 安装器。
- `npm run release:mac`：在 macOS 上构建后端桌面 bundle 并打包 macOS 桌面端。
- `npm run release:mac:publish -- --tag vX.Y.Z`：在 macOS 本地构建 DMG/ZIP、生成校验文件并上传到 GitHub Release。

### 发布流程

- **Windows / Web / Windows Server**：推送 `vX.Y.Z` 标签后，由 `.github/workflows/release-windows.yml` 自动构建并发布。
- **macOS**：在 macOS 本地运行 `npm run release:mac:publish -- --tag vX.Y.Z`。脚本会使用官方 Electron Builder 二进制源，构建 DMG/ZIP，生成 `SHA256SUMS-macos.txt`，并将资产上传到同一个 GitHub Release。
- 发布前需要先将 Client 和 Server 的同名版本标签推送到远端，并完成 `gh auth login`。macOS 也支持 `--skip-build`，用于上传已经生成的本地资产。

后端 API、Socket.IO 事件、部署和桌面 bundle 细节见：

[DicomVisionServer README](https://github.com/l5769389/DicomVisionServer)

## 联系与反馈

如有问题、建议或希望参与改进，欢迎联系：5769389@qq.com
