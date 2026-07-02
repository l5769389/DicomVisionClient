# DicomVision

[English](./README.en.md)

DicomVision 是一套 C/S 架构的 DICOM Viewer，包含 Vue/Electron 客户端和 FastAPI 后端。它把 DICOM 解析、2D/MPR/4D/3D 重建、PET/CT 融合、分割、QA 和导出等重计算放在后端完成，再把结果实时推送给桌面端、Web 端和移动端界面。

## v3.0.0 重点更新

- **右侧操作区**：桌面/Web 端新增顶部工具栏和右侧 Dock 两种操作布局；右侧模式固定占位，工具二级菜单、3D/MIP 参数、QA/MTF 结果和分割详情都在右侧区域内显示，减少弹窗和视口抖动。
- **PET/CT Fusion**：新增 PET/CT 融合浏览、PET-only 显示、SUV/强度范围控制、手动配准、配准保存、Fusion pane 双击放大和独立 PET 视图优化。
- **MPR 分割与 VOI**：新增阈值分割、球形 VOI、分割 overlay、sidecar 数据流、移动端分割入口和详情面板。
- **QA/MTF 右侧报告化**：MTF 曲线、水模 QA、错误和加载状态统一进入右侧结果区；MTF ROI 自动打开结果面板，并提供复制/删除操作。
- **移动端重构**：统一 2D 命名，新增浏览记录、PACS 设置、移动端 bottom sheet、播放/FPS、4D/MPR slice play、方向锁定、测量/标注/分割、移动端截图和演示 GIF。
- **发布形态**：v3.0.0 Release 提供 Windows 桌面安装包、Web 静态包和独立 Server bundle。桌面安装包内置后端服务，安装后可直接使用。

## 主要功能

- 本地 DICOM 文件/文件夹导入，Web 上传，PACS DICOMweb/DIMSE 查询与下载。
- 2D、2D Compare、Layout、多序列同步、MPR、斜切 MPR、MPR + 3D、3D 体渲染和 4D 时相播放。
- PET/CT Fusion、PET 显示范围、PET-only 视图、手动配准和融合视图四宫格/单视口切换。
- 线段、矩形、椭圆、角度、曲线、自由形状测量，标注，MTF/FWHM 和水模 QA。
- MPR 阈值分割、VOI、分割预览、分割结果导入/导出和移动端触控绘制。
- DICOM Tag 树查看、VR 感知编辑、批量 Tag 修改、脱敏导出、PNG/DICOM/DICOM SR/DICOM GSPS 导出。
- 桌面端、Web 端、移动端响应式界面，支持深色、浅色和蓝色主题。

## 在线预览

- https://dicom-vision-client.vercel.app/
- http://111.228.1.213/

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

v3.0.0 Release 包含：

- `DicomVision-3.0.0-Setup.exe`：Windows 桌面端安装包，内置 Server bundle。
- `DicomVision-web-v3.0.0.zip`：Web 静态前端产物，需要连接可访问的 DicomVisionServer。
- `DicomVisionServer-v3.0.0-win-x64.zip`：Windows 独立后端 bundle。
- `SHA256SUMS.txt`：发布资产校验值。

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

默认命令会构建当前 Mac 的架构。完整 macOS 分包：

```bash
npm run release:mac:arm64
npm run release:mac:x64
npm run release:mac:all
```

无 Apple 证书时，脚本会在 `auto` 模式下生成可本地验证的 unsigned 包。正式分发时使用 Developer ID 签名和 Apple 公证：

```bash
npm run release:mac:all -- --sign required --notarize required
```

正式分发需要先准备 `CSC_NAME` 或已导入钥匙串的 Developer ID Application 证书，并设置以下任一组公证凭据：

```env
APPLE_ID=your-apple-id@example.com
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
APPLE_TEAM_ID=TEAMID1234
```

或：

```env
APPLE_API_KEY=/path/to/AuthKey_XXXXXXXXXX.p8
APPLE_API_KEY_ID=XXXXXXXXXX
APPLE_API_ISSUER=00000000-0000-0000-0000-000000000000
```

产物输出到 `dist-electron/`，命名示例：

```text
DicomVision-3.0.0-mac-arm64.dmg
DicomVision-3.0.0-mac-arm64.zip
DicomVision-3.0.0-mac-x64.dmg
DicomVision-3.0.0-mac-x64.zip
```

常见前置条件：macOS、Node.js/npm、Python 3.13、uv 或 PyInstaller、Xcode Command Line Tools（`iconutil`、`sips`、`xcrun notarytool`）。x64 和 arm64 会分别构建后端 bundle，不使用 universal2。

## 常用脚本

- `npm run dev`：启动 Electron 桌面开发运行时。
- `npm run dev:web`：启动 Web Vite 开发服务。
- `npm run build`：构建 Electron main、preload 和 renderer。
- `npm run build:web`：构建独立 Web 前端到 `dist-web/`。
- `npm run generate:api-types`：从 Server OpenAPI 重新生成前端 API 类型。
- `npm run typecheck`：运行 TypeScript 类型检查。
- `npm run test:run`：运行 Vitest。
- `npm run release:win`：构建后端桌面 bundle 并打包 Windows 安装器。
- `npm run release:mac`：构建当前 Mac 架构的桌面包。
- `npm run release:mac:arm64` / `npm run release:mac:x64`：分别构建 Apple Silicon / Intel 桌面包。
- `npm run release:mac:all`：依次构建 arm64 与 x64 桌面包。

## 后端说明

后端 API、Socket.IO 事件、部署和桌面 bundle 细节见：

[DicomVisionServer README](https://github.com/l5769389/DicomVisionServer)
