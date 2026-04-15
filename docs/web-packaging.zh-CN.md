# Web 打包说明

## 目标

在保留 Electron 桌面端的同时，复用同一套 `src/renderer` 前端，产出一个浏览器可访问的 Web 版本。

## 当前实现

- 桌面端
  - 继续通过 Electron `preload` 暴露 `viewerApi`
  - 继续连接本地内嵌后端
- Web 端
  - 通过 `vite.web.config.ts` 直接构建 `src/renderer/index.html`
  - 通过 `VITE_BACKEND_ORIGIN` 指向远程后端
  - 可选通过浏览器 `prompt` 输入服务端可访问的 DICOM 目录路径
  - 也可通过服务端 sample 目录直接加载示例数据

## 命令

```powershell
npm run dev:web
npm run build:web
npm run preview:web
```

构建产物输出到 `dist-web/`。

## 环境变量

可在 `.env.local` 或部署环境中配置：

```env
VITE_BACKEND_ORIGIN=http://127.0.0.1:8000
VITE_WEB_USE_SERVER_SAMPLE=false
VITE_WEB_FOLDER_PROMPT=请输入服务端可访问的 DICOM 文件夹路径
```

说明：

- `VITE_BACKEND_ORIGIN`
  - Web 端 API 和 Socket.IO 的后端根地址
  - 开发环境固定使用 `http://127.0.0.1:8000`
  - 生产环境必须显式配置该变量
- `VITE_WEB_FOLDER_PROMPT`
  - Web 端点击“输入路径”时的提示文案
- `VITE_WEB_USE_SERVER_SAMPLE`
  - 为 `true` 时，Web 端点击按钮会直接请求服务端 `/dicom/loadSample`
  - 为 `false` 时，仍使用路径输入方式

## 约束

- Web 版本当前不直接读取用户本机目录
- 输入的路径必须是后端服务器自身可访问的路径
- 如果启用服务端 sample 模式，需要后端配置 `WEB_SAMPLE_DICOM_PATH`
- 如果要支持浏览器本地文件或目录上传，需要后续增加专门的上传链路
