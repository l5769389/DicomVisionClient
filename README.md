# DicomVision

[English](./README.en.md)

DicomVision 是一套 C/S 架构的 DICOM Viewer，包含 Vue/Electron 客户端和 FastAPI 后端。它把 DICOM 解析、2D/MPR/4D/3D 重建、PET/CT 融合、分割、QA 和导出等重计算放在后端完成，再把结果实时推送给桌面端、Web 端和移动端界面。

## v3.1.0 重点更新

- **3D 渲染与交互**：优化 VR/Surface 预览与最终帧一致性，改进模型直接拖拽旋转、连续拖动防跳帧、移动端 3D 初始相机适配和最终帧采样质量。
- **3D 模板与参数**：补齐 General、CT、CTA、MR、CBCT 分组模板；AAA 等模板改为 CT HU 锚点 + 前景百分位自适应，Surface 独立使用 iso-surface/material 参数。
- **3D 工具**：新增去床板开关、自由形状裁剪、裁剪进度提示、3D 参数弹层、移动端 3D 工具链路和服务端 metadata 状态同步。
- **Web/移动端连接**：开发环境按当前页面 host 自动连接同一台后端，修复手机访问局域网地址时仍连接 `127.0.0.1` 的问题；开发模式自动清理旧 PWA 缓存，避免模块 MIME 错误。
- **Demo 数据**：本地 macOS 开发环境优先加载 `/Users/jun/Documents/test_dicom/py_test_path/py_test_path2`，部署环境继续使用项目默认样例。
- **发布形态**：v3.1.0 Release 计划提供 Web 静态包、Windows 桌面安装包、Windows 独立 Server bundle、macOS DMG/ZIP 桌面端和校验文件。

## 主要功能

- **数据源**：本地 DICOM 文件/文件夹导入、拖拽导入、浏览器上传、服务端样例数据、PACS DICOMweb/DIMSE 查询与下载。
- **2D 浏览**：窗宽窗位、缩放、平移、滚动、翻转/旋转、伪彩、同步浏览、Compare、Layout、多序列和多视图工作区。
- **MPR/4D**：AX/COR/SAG 三视图、斜切 MPR、十字线同步、MPR 播放、4D phase 播放、FPS 控制和时相同步。
- **3D**：VR 体渲染、Surface 渲染、MIP/XRay 类模板、AAA/CT/CTA/MR/CBCT 自适应预设、3D 参数面板、去床板、自由形状裁剪、移动端触控 3D。
- **PET/CT Fusion**：PET/CT 融合浏览、PET-only、SUV/强度范围、手动配准、配准保存、Fusion 四宫格和单视口切换。
- **测量与标注**：线段、矩形、椭圆、角度、曲线、自由形状测量，箭头/文本标注，实时 draft 和 ROI 指标。
- **分割与 QA**：MPR 阈值分割、球形 VOI、分割 overlay、分割导入/导出、MTF/FWHM、水模 QA 和结果报告。
- **DICOM 与导出**：DICOM Tag 树查看、VR 感知编辑、批量 Tag 修改、脱敏导出、PNG、DICOM、DICOM SR、DICOM GSPS 导出。
- **多端体验**：桌面端、Web 端、移动端响应式界面，支持深色、浅色和蓝色主题；桌面端安装包内置后端服务。

## 在线预览

- https://dicom.zhaolin.online/

公开 Web 预览用于体验 UI 和基础流程。真实 PACS、本地大数据量和桌面端内置后端场景建议使用本地部署或桌面端。

## 仓库

- Client: [https://github.com/l5769389/DicomVisionClient](https://github.com/l5769389/DicomVisionClient)
- Server: [https://github.com/l5769389/DicomVisionServer](https://github.com/l5769389/DicomVisionServer)

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

## Release 资产

v3.1.0 Release 包含：

- `DicomVision-3.1.0-Setup.exe`：Windows 桌面端安装包，内置 Server bundle。
- `DicomVision-web-v3.1.0.zip`：Web 静态前端产物，需要连接可访问的 DicomVisionServer。
- `DicomVisionServer-v3.1.0-win-x64.zip`：Windows 独立后端 bundle。
- `DicomVision-3.1.0-Setup.dmg`：macOS 桌面端安装镜像，内置 Server bundle。
- `DicomVision-3.1.0-Setup.zip`：macOS 桌面端 ZIP 包。
- `SHA256SUMS-windows.txt` / `SHA256SUMS-macos.txt`：发布资产校验值。

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

### Web 开发与构建

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

### 桌面端打包

Windows：

```powershell
npm run release:win
```

macOS 需要在 macOS 上构建：

```bash
npm run release:mac
```

## 常用脚本

- `npm run dev`：启动 Electron 桌面开发运行时。
- `npm run dev:web`：启动 Web Vite 开发服务。
- `npm run build`：构建 Electron main、preload 和 renderer。
- `npm run build:web`：构建独立 Web 前端到 `dist-web/`。
- `npm run generate:api-types`：从 Server OpenAPI 重新生成前端 API 类型。
- `npm run typecheck`：运行 TypeScript 类型检查。
- `npm run test:run`：运行 Vitest。
- `npm run release:win`：构建后端桌面 bundle 并打包 Windows 安装器。

## 后端说明

后端 API、Socket.IO 事件、部署和桌面 bundle 细节见：

[DicomVisionServer README](https://github.com/l5769389/DicomVisionServer)
