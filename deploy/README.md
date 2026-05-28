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
PUBLIC_ORIGIN=http://114.67.114.128 \
WEB_PORT=80 \
bash /opt/dicomvision/DicomVisionClient/deploy/deploy.sh
```

部署完成后访问：

```text
http://114.67.114.128/
http://114.67.114.128/health
```

## GitHub 自动部署

两个仓库都包含 `.github/workflows/deploy-web.yml`。任一仓库推送到 `main` 后，都可以通过 SSH 登录服务器并执行同一套部署脚本。

需要在 GitHub 仓库的 `Settings -> Secrets and variables -> Actions` 中配置：

- `DEPLOY_HOST`：服务器公网 IP，例如 `114.67.114.128`
- `DEPLOY_USER`：SSH 用户，例如 `root` 或 `ubuntu`
- `DEPLOY_SSH_KEY`：可登录服务器的私钥内容
- `DEPLOY_PATH`：部署目录，可选，默认 `/opt/dicomvision`
- `PUBLIC_ORIGIN`：公网访问地址，例如 `http://114.67.114.128`

如果后续绑定域名并开启 HTTPS，把 `PUBLIC_ORIGIN` 改成正式域名，例如：

```text
https://dicom.example.com
```

## 常用运维命令

```bash
cd /opt/dicomvision/DicomVisionClient/deploy
docker compose --env-file .env -f docker-compose.yml ps
docker compose --env-file .env -f docker-compose.yml logs -f
docker compose --env-file .env -f docker-compose.yml restart
docker compose --env-file .env -f docker-compose.yml down
```

## 注意事项

- 如果服务器在中国大陆并使用域名对外提供服务，通常需要 ICP 备案。
- 如果只通过公网 IP 测试，可以先使用 `http://114.67.114.128/`。
- 3Mbps 带宽上传大 DICOM 文件会比较慢。
- 2 核 4G 可以跑 Web Demo 和轻量测试；大 CT、3D、4D 或多人并发会吃紧。
