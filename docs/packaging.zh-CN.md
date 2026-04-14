# Windows 打包方案

## 目标

将 `DicomVisionClient` 和 `DicomVisionServer` 组装为一个可安装的 Windows 桌面应用，同时明确前后端构建边界：

- `DicomVisionServer` 仓库负责产出自己的桌面发布物
- `DicomVisionClient` 仓库负责组装 Electron 安装包
- 应用启动时由 Electron 主进程拉起内嵌服务端

## 当前边界

客户端仓库负责：

- 构建 Electron renderer/main
- 将外部提供的 server bundle 复制到 `dist-server/DicomVisionServer`
- 通过 `electron-builder --win nsis` 生成安装包

服务端仓库负责：

- 产出可分发的桌面 bundle
- bundle 目录内应直接包含 `DicomVisionServer.exe`

这意味着客户端仓库不再负责：

- 直接调用 `..\DicomVisionServer\.venv\Scripts\python.exe`
- 直接执行 `PyInstaller`
- 依赖服务端仓库的内部入口文件和打包参数

## 目录约定

Electron 打包阶段仍然从以下位置收集内嵌服务端文件：

```text
dist-server/
  DicomVisionServer/
    DicomVisionServer.exe
    ...
```

`package.json` 中的 `build.extraResources` 会把该目录打进安装包的 `resources/server`。

## 使用方式

### 1. 由服务端仓库生成 bundle

服务端仓库需要先产出一个目录，且目录内包含：

```text
DicomVisionServer.exe
```

你可以把这个目录路径通过环境变量 `DICOM_VISION_SERVER_BUNDLE_PATH` 传给客户端仓库。

### 2. 将服务端产物暂存到客户端仓库

```powershell
$env:DICOM_VISION_SERVER_BUNDLE_PATH = "D:\path\to\DicomVisionServer"
npm run stage:server
```

也可以直接调用脚本并传参：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stage-server-bundle.ps1 -BundlePath "D:\path\to\DicomVisionServer"
```

### 3. 生成 Windows 安装包

如果已经完成 `stage:server`：

```powershell
npm run dist:win
```

如果想在打包时顺带暂存服务端 bundle：

```powershell
$env:DICOM_VISION_SERVER_BUNDLE_PATH = "D:\path\to\DicomVisionServer"
npm run dist:win
```

### 4. 一键发布

如果本机同时存在相邻目录下的 `DicomVisionServer` 仓库，可以直接在客户端仓库执行：

```powershell
npm run release:win
```

该命令会依次执行：

- 调用服务端仓库的 `scripts/build-desktop-bundle.ps1`
- 将生成的 bundle 暂存到客户端仓库的 `dist-server/DicomVisionServer`
- 调用 `electron-builder` 生成 Windows 安装包

如需指定服务端仓库路径或服务端产物输出目录，可直接调用脚本：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\release-win.ps1 -ServerRepoPath "D:\path\to\DicomVisionServer" -ServerOutputRoot "D:\path\to\server-dist"
```

## 运行时逻辑

Electron 主进程保持以下行为：

- 开发环境下优先尝试启动 `..\DicomVisionServer\.venv\Scripts\python.exe run.py`
- 打包环境下启动 `resources/server/DicomVisionServer.exe`
- 应用退出时关闭由 Electron 拉起的服务端进程
- 服务端日志写入 `%APPDATA%/<app>/logs/backend.log`

## 优势

- 降低客户端仓库对服务端内部结构的耦合
- 服务端可以独立演进自己的打包方式
- 更适合后续接入 CI/CD 和版本化 artifact
- 客户端仓库的职责收敛为桌面产品组装

## 当前限制

- 当前 Windows 安装链路仍假设服务端发布物是目录形式，而不是 zip 包
- 客户端仓库尚未内置下载 artifact 的逻辑，目前只负责本地暂存和组装
- macOS / Linux 的 bundled backend 仍未纳入统一发布链路
