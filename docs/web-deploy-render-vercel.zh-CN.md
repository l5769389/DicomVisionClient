# Render + Vercel 部署说明

## 目标

- Render 部署 Python 服务端
- Vercel 部署 `build:web` 生成的静态前端
- 继续保留 Electron 桌面端 EXE 打包链路

## 服务端 Render 配置

Render 需要至少配置这些环境变量：

```env
APP_ENV=production
APP_HOST=0.0.0.0
APP_PORT=10000
CORS_ORIGINS=["https://your-vercel-app.vercel.app"]
WEB_SAMPLE_DICOM_PATH=/opt/render/project/src/sample-data
```

说明：

- `CORS_ORIGINS`
  - 同时用于 FastAPI CORS 和 Socket.IO `cors_allowed_origins`
- `WEB_SAMPLE_DICOM_PATH`
  - Web 端点击“加载示例”时，后端实际读取的本地 DICOM 目录

服务端新增接口：

- `POST /api/v1/dicom/loadSample`
  - 从 `WEB_SAMPLE_DICOM_PATH` 读取示例数据

## 前端 Vercel 配置

Vercel 需要至少配置这些环境变量：

```env
VITE_BACKEND_ORIGIN=https://your-render-service.onrender.com
VITE_WEB_USE_SERVER_SAMPLE=true
```

说明：

- `VITE_BACKEND_ORIGIN`
  - 浏览器访问的 Render 服务根地址
- `VITE_WEB_USE_SERVER_SAMPLE=true`
  - 前端点击按钮时不再提示输入路径，直接调用 `/dicom/loadSample`

## 构建命令

```bash
npm run build:web
```

输出目录：

```text
dist-web/
```

Vercel 的 Output Directory 设为：

```text
dist-web
```

## 目前已补齐的能力

- Web 构建入口
- 前端 runtime 平台抽象
- Web 端后端地址环境变量
- Web 端 sample DICOM 加载链路
- 服务端 sample 目录环境变量与接口

## 仍需你在部署平台上完成的事项

- 在 Render 上准备真实 sample DICOM 目录
- 在 Render 环境变量中配置 `WEB_SAMPLE_DICOM_PATH`
- 在 Vercel 环境变量中配置 `VITE_BACKEND_ORIGIN`
- 把 Render 域名加入 `CORS_ORIGINS`
