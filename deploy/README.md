# DicomVision Web 部署

这里的配置用于把 DicomVision Web 版部署到一台 Ubuntu 服务器上：

- `web`：Nginx 容器，托管前端静态文件，并反向代理 `/api/`、`/socket.io/`、`/health` 到后端。
- `backend`：FastAPI + Socket.IO 后端容器，负责 DICOM 解析、渲染、PACS 下载缓存和上传文件处理。

默认部署目录：

```text
/opt/dicomvision/
  DicomVisionClient/
  DicomVisionServer/
```

## 首次初始化服务器

在服务器上执行：

```bash
sudo bash /opt/dicomvision/DicomVisionClient/deploy/install-ubuntu.sh
```

如果服务器还没有代码，可以先手动安装基础工具并拉取客户端仓库：

```bash
sudo apt-get update
sudo apt-get install -y git
sudo mkdir -p /opt/dicomvision
sudo chown -R "$USER":"$USER" /opt/dicomvision
git clone https://github.com/l5769389/DicomVisionClient.git /opt/dicomvision/DicomVisionClient
sudo bash /opt/dicomvision/DicomVisionClient/deploy/install-ubuntu.sh
```

脚本会安装 Docker、Docker Compose、Git、UFW，并创建 2G swap。2 核 4G 或更低配置的服务器建议保留 swap。

## 手动部署

```bash
APP_DIR=/opt/dicomvision \
PUBLIC_ORIGIN=https://dicom.zhaolin.online \
WEB_PORT=80 \
bash /opt/dicomvision/DicomVisionClient/deploy/deploy.sh
```

部署完成后访问：

```text
https://dicom.zhaolin.online/
https://dicom.zhaolin.online/health
```

如果服务已经通过 HTTPS 域名访问，`PUBLIC_ORIGIN` 必须使用 HTTPS 域名或 `same-origin`，不要配成 `http://...`，否则浏览器会拦截 WebSocket mixed content。

## GitHub 自动部署

两个仓库都包含 `.github/workflows/deploy-web.yml`。任一仓库推送到 `main` 后，Actions 会 checkout 客户端和服务端两个仓库，打包上传到服务器，再启动同一套 Docker 部署脚本。

Actions 会在服务器上启动后台部署任务，避免长时间 Docker 构建导致 SSH 连接断开；服务器不需要自行访问 GitHub。部署日志保存在 `/var/log/dicomvision/`。

需要在 GitHub 仓库的 `Settings -> Secrets and variables -> Actions` 中配置：

- `JDCLOUD_DEPLOY_PASSWORD`：可选，京东云服务器 SSH 密码；设置后优先使用密码登录。
- `DEPLOY_SSH_KEY`：可选，可登录服务器的私钥内容；未配置密码时使用。
- `JDCLOUD_DEPLOY_HOST`：可选，服务器公网 IP，默认 `111.228.1.213`。
- `DEPLOY_USER`：可选，SSH 用户，默认 `root`。
- `DEPLOY_PATH`：可选，部署目录，默认 `/opt/dicomvision`。
- `JDCLOUD_PUBLIC_ORIGIN`：可选，公网访问地址，默认 `https://dicom.zhaolin.online`。
- `JDCLOUD_WEB_PORT`：可选，Nginx 容器监听地址，默认 `127.0.0.1:18080`。

如果后续更换域名，必须使用 HTTPS 域名，例如：

```text
https://dicom.zhaolin.online
```

## 常用运维命令

```bash
cd /opt/dicomvision/DicomVisionClient/deploy
docker compose --env-file .env -f docker-compose.yml ps
docker compose --env-file .env -f docker-compose.yml logs -f
docker compose --env-file .env -f docker-compose.yml restart
docker compose --env-file .env -f docker-compose.yml down
tail -f /var/log/dicomvision/deploy-*.log
```

## 注意事项

- 如果服务器在中国大陆并使用域名对外提供服务，通常需要 ICP 备案。
- 自动部署需要 GitHub Actions 能连通服务器 SSH 端口；如果部署日志出现 `Connection timed out during banner exchange`，需要检查云安全组、防火墙或 SSH 服务监听地址。
- 3Mbps 带宽上传大 DICOM 文件会比较慢。
- 2 核 4G 可以跑 Web Demo 和轻量测试；大 CT、3D、4D 或多人并发会吃紧。
