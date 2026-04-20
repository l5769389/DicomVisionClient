# DicomVision Client

[中文说明](./README.zh-CN.md)

DicomVision Client is the desktop and web frontend for the DicomVision viewing system. It focuses on workflow orchestration, viewport management, interactive tools, and real-time presentation, while the companion backend performs DICOM parsing, MPR reconstruction, and 3D volume rendering.

Companion backend repository: [DicomVisionServer](https://github.com/l5769389/DicomVisionServer)

## Overview

DicomVision is a frontend-backend medical imaging viewer architecture:

- `DicomVisionClient`: Electron + Vue application for user interaction and workspace presentation
- `DicomVisionServer`: FastAPI + Socket.IO service for DICOM loading, rendering, and view-state processing

The client does not render medical images locally. It sends commands to the backend and receives rendered frames, overlays, and interaction feedback in real time.

## Key Features

### Clinical Viewing Workflow

- Load local DICOM folders from the desktop client
- Browse discovered studies and series in the left-side workflow panel
- Create and switch between multiple tabs and viewport sessions
- Support mixed viewing workflows within the same workspace

### Multi-Mode Visualization

- Stack viewing for slice-by-slice browsing
- MPR viewing for orthogonal reconstruction workflows
- 3D volume viewing backed by the server-side VTK pipeline

### Interactive Tools

- Pan, zoom, scroll, reset, and viewport resize
- Crosshair-based interaction and synchronized navigation
- Hover feedback and overlay display
- Toolbar-driven image and view operations

### 3D Rendering Controls

- Built-in rendering presets
- Transfer-function editing
- Layer visibility, color, opacity, WW/WL, and lighting controls
- Fast preview plus full render update workflow

### Productization

- Electron desktop runtime for local workstation scenarios
- Web build path for frontend-only deployment
- Windows packaging workflow that bundles the backend artifact into the desktop installer

## Architecture

The system uses two communication paths:

- HTTP API for coarse-grained operations such as loading folders, creating views, and setting viewport size
- Socket.IO for low-latency interactive commands and real-time image updates

Typical runtime flow:

1. The user opens a DICOM folder in the client.
2. The client calls the backend to register readable series.
3. The client creates one or more viewports for Stack, MPR, or 3D.
4. The client binds the viewport to a socket session.
5. User interactions are forwarded to the backend.
6. The backend returns rendered frames, overlays, and acknowledgements in real time.

## Tech Stack

### Frontend

- Electron
- Vue 3
- TypeScript
- Vuetify
- Tailwind CSS
- Axios
- Socket.IO Client
- electron-vite

### Backend

- Python 3.13+
- FastAPI
- python-socketio
- pydicom
- NumPy / SciPy
- Pillow
- VTK
- uv

## Repository Structure

```text
src/
  main/                    Electron main process
  preload/                 Electron preload bridge
  renderer/                Vue renderer application
  shared/                  shared runtime config and contracts

src/renderer/src/
  components/              UI components
  composables/             viewer state and interaction logic
  plugins/                 Vue and Vuetify setup
  services/                HTTP and Socket.IO clients
  types/                   frontend domain types

docs/                      project notes and implementation docs
screenshots/               repository screenshots for README and releases
scripts/                   packaging and release scripts
```

## Core Modules

- `ViewerWorkspace.vue`: central workspace and viewport composition
- `ViewerToolbar.vue`: interaction tools and command entry
- `ViewerTabStrip.vue`: tab and session switching
- `SidebarPanel.vue`: loading flow, series browser, and settings shell
- `StackView.vue`: stack viewport
- `MprView.vue`: MPR viewport
- `VolumeView.vue`: 3D viewport
- `VolumeRenderConfigPanel.vue`: advanced 3D rendering controls

## Frontend and Backend Usage

### 1. Start the Backend

Backend repository:

[https://github.com/l5769389/DicomVisionServer](https://github.com/l5769389/DicomVisionServer)

Install dependencies:

```bash
uv sync
```

Run the backend:

```bash
uv run python run.py
```

Default backend address:

- HTTP: `http://127.0.0.1:8000`
- OpenAPI: `http://127.0.0.1:8000/docs`
- Socket.IO: `http://127.0.0.1:8000/socket.io`

### 2. Start the Client in Development Mode

Install dependencies:

```bash
npm install
```

Run the Electron client:

```bash
npm run dev
```

Important:

- Desktop development mode requires the backend to be started separately first.
- The client connects to `http://127.0.0.1:8000` by default during desktop development.
- If the backend is not reachable, the desktop app opens but the viewer workflow will not function correctly.

### 3. Use the Viewer

Recommended local workflow:

1. Start `DicomVisionServer`.
2. Start `DicomVisionClient`.
3. Choose a local DICOM folder.
4. Select a series from the sidebar.
5. Open Stack, MPR, or 3D viewports.
6. Interact through the toolbar and pointer gestures.

## Web Usage

Run the web frontend locally:

```bash
npm run dev:web
```

Create a production web build:

```bash
npm run build:web
```

Preview the web build:

```bash
npm run preview:web
```

Relevant environment variables:

- `VITE_BACKEND_ORIGIN`: backend origin for the web frontend
- `VITE_WEB_USE_SERVER_SAMPLE`: whether the web client should use the server-side sample loading path

Current defaults:

- Development web backend: `http://127.0.0.1:8000`
- Production example backend: `https://dicomvisionserver.onrender.com`

See [docs/web-packaging.zh-CN.md](./docs/web-packaging.zh-CN.md) and [docs/web-deploy-render-vercel.zh-CN.md](./docs/web-deploy-render-vercel.zh-CN.md) for deployment notes.

## Build and Release

### Frontend Build

```bash
npm run build
```

### Type Check

```bash
npm run typecheck
```

### Windows Installer

This repository packages the Electron application and consumes a prebuilt backend bundle.

Typical packaging flow:

1. Build the backend desktop bundle in `DicomVisionServer`.
2. Stage that bundle into this repository.
3. Build the Electron installer.

Available scripts:

- `npm run build`: build the Electron application
- `npm run release:win`: build the backend bundle and package the Windows installer in one flow

Supporting scripts:

- `scripts/stage-server-bundle.ps1`
- `scripts/package-win.ps1`
- `scripts/release-win.ps1`

Packaged desktop builds can launch the bundled backend automatically from `resources/server/DicomVisionServer.exe`.

## Backend Connectivity

Relevant frontend files:

- `src/shared/appConfig.ts`
- `src/renderer/src/services/api.ts`
- `src/renderer/src/services/socket.ts`
- `src/renderer/src/composables/workspace/connection/useViewerWorkspaceConnection.ts`
- `src/main/index.ts`

Desktop development defaults:

- Backend host: `127.0.0.1`
- Backend port: `8000`

The packaged desktop application can allocate a runtime port for the embedded backend and then connect the UI to that resolved origin automatically.

## Screenshots

Store README and release screenshots in [`screenshots/`](./screenshots/).

Suggested assets:

- main workspace
- stack viewport
- MPR layout
- 3D rendering panel
- series loading workflow

## Related Repository

Backend project:

[DicomVisionServer](https://github.com/l5769389/DicomVisionServer)
