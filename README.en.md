# DicomVision

[中文说明](./README.md)

**DICOM Viewer for Desktop / Web / Mobile**

DicomVision is a client/server DICOM viewer for medical image viewing, analysis, and workflow validation. The client is built with Vue, TypeScript, and Electron. The backend is built with FastAPI, Socket.IO, and medical imaging libraries to parse, render, reconstruct, analyze, and export DICOM data while streaming rendered results to desktop, web, and mobile interfaces in real time.

## Overview

- Web preview: [https://dicom.zhaolin.online/](https://dicom.zhaolin.online/)
- Client repository: [https://github.com/l5769389/DicomVisionClient](https://github.com/l5769389/DicomVisionClient)
- Server repository: [https://github.com/l5769389/DicomVisionServer](https://github.com/l5769389/DicomVisionServer)
- Current release: [DicomVision v3.1.1](https://github.com/l5769389/DicomVisionClient/releases/tag/v3.1.1)

DicomVision keeps compute-heavy work on the backend and leaves interaction, tools, and result presentation to the client. The same rendering and analysis capabilities can therefore be reused by the browser, mobile UI, and desktop app across local networks, cloud deployments, or desktop packages with an embedded backend.

The project is designed especially for deployments where the client has limited GPU memory but still needs shared DICOM viewing and backend 2D/3D rendering capabilities. For workstations with ample GPU resources and a strong requirement for fully local GPU interaction, native solutions such as C3D may be a better fit. For deployments that require UI and computation in one process, a non-separated Python or C++ implementation may also be preferable. DicomVision is primarily intended for cross-platform reuse, centralized rendering, and lightweight clients.

## Features

- **Data import**: DICOM files, folders, drag-and-drop import, browser upload, server sample data, and PACS DICOMweb/DIMSE query/retrieval.
- **2D viewing**: window/level, zoom, pan, scroll, flip, rotate, pseudocolor, synchronized browsing, Compare, Layout, multi-series, and multi-view workspaces.
- **MPR and 4D**: AX/COR/SAG tri-view, oblique MPR, synchronized crosshair, MPR playback, 4D phase playback, FPS control, and phase sync.
- **3D visualization**: VR volume rendering, Surface rendering, MIP/XRay-style presets, AAA/CT/CTA/MR/CBCT adaptive presets, 3D parameter panels, remove-bed, freeform clipping, and mobile touch 3D.
- **PET/CT Fusion**: PET/CT fusion, PET-only mode, SUV/intensity controls, manual registration, saved registration, and four-pane/single-pane switching.
- **Measurement and annotation**: line, rectangle, ellipse, angle, curve, freeform measurements, arrow/text annotations, realtime drafts, and ROI metrics.
- **Segmentation and QA**: MPR threshold segmentation, spherical VOI, segmentation overlays, segmentation import/export, MTF/FWHM, water phantom QA, and report panels.
- **DICOM and export**: DICOM tag tree, VR-aware editing, batch tag changes, de-identification export, PNG, DICOM, DICOM SR, and DICOM GSPS export.
- **Multi-platform UI**: desktop, web, and mobile-responsive interfaces with dark, light, and blue themes. Desktop installers include the backend service.

## Web Preview

[https://dicom.zhaolin.online/](https://dicom.zhaolin.online/)

The public web preview is intended for checking the UI, basic workflows, and remote-rendering behavior. Real PACS workflows, large local datasets, embedded desktop backend scenarios, and privacy-sensitive data are better tested with a local deployment or the desktop app.

## Demos

<img src="./screenshots/basic_operations_demo.gif" alt="DicomVision basic operation demo" width="880">

<img src="./screenshots/mobile_use_gif.gif" alt="DicomVision mobile demo" width="420">

## Screenshots

| Workspace home | Loaded series |
| --- | --- |
| <img src="./screenshots/home_page.png" alt="DicomVision workspace home" width="420"> | <img src="./screenshots/home_page_loaded_series.png" alt="Loaded DICOM series workspace" width="420"> |

| PET/CT Fusion | PET/CT manual registration |
| --- | --- |
| <img src="./screenshots/pet_ct_fusion.png" alt="PET/CT Fusion viewer" width="420"> | <img src="./screenshots/pet_ct_fusion_registration.png" alt="PET/CT manual registration" width="420"> |

| MPR and oblique rotation | 4D phases |
| --- | --- |
| <img src="./screenshots/mpr_rotate.png" alt="MPR oblique rotation" width="420"> | <img src="./screenshots/4D.png" alt="4D phase playback" width="420"> |

| MTF/FWHM | Segmentation and VOI |
| --- | --- |
| <img src="./screenshots/mtf_fwhm_1.png" alt="MTF and FWHM analysis" width="420"> | <img src="./screenshots/segmentation_voi.png" alt="MPR threshold segmentation and VOI" width="420"> |

| Water phantom QA | Light theme |
| --- | --- |
| <img src="./screenshots/water_phantom_qa.png" alt="Water phantom QA" width="420"> | <img src="./screenshots/theme_light.png" alt="Light theme" width="420"> |

| Mobile home | Mobile 2D |
| --- | --- |
| <img src="./screenshots/mobile_home_page.png" alt="Mobile home" width="260"> | <img src="./screenshots/mobile_2d.png" alt="Mobile 2D viewer" width="260"> |

| Mobile MPR | Mobile 4D |
| --- | --- |
| <img src="./screenshots/mobile_mpr.png" alt="Mobile MPR" width="260"> | <img src="./screenshots/mobile_4D.png" alt="Mobile 4D" width="260"> |

| Mobile PET/CT | Mobile settings |
| --- | --- |
| <img src="./screenshots/mobile_pet_ct_fusion.png" alt="Mobile PET/CT Fusion" width="260"> | <img src="./screenshots/mobile_setting.png" alt="Mobile settings" width="260"> |

| PACS data sources | PACS Browser |
| --- | --- |
| <img src="./screenshots/pacs_dicom_import.png" alt="PACS DICOMweb and DIMSE settings" width="420"> | <img src="./screenshots/pacs_dicom_import_1.png" alt="PACS Browser query and import" width="420"> |

| Measurement tools | DICOM Tags |
| --- | --- |
| <img src="./screenshots/measure_line_angle_rect_ellipse.png" alt="Measurement tools" width="420"> | <img src="./screenshots/dicomTags.png" alt="DICOM Tag viewer" width="420"> |

| Drag-and-drop import | De-identification export |
| --- | --- |
| <img src="./screenshots/drap_import.png" alt="Drag-and-drop DICOM import" width="420"> | <img src="./screenshots/deIndentifyExport.png" alt="DICOM de-identification export" width="420"> |

## Quick Start

### Start the server

```bash
cd ../DicomVisionServer
uv sync
uv run python run.py
```

Default endpoints:

- HTTP: `http://127.0.0.1:8000`
- OpenAPI: `http://127.0.0.1:8000/docs`
- Socket.IO: `http://127.0.0.1:8000/socket.io`

### Start the desktop client

```bash
cd ../DicomVisionClient
npm install
npm run dev
```

To point the Electron shell at another backend:

```powershell
$env:DICOM_VISION_SERVER_ORIGIN = "http://127.0.0.1:8000"
npm run dev
```

### Start the web development server

```bash
npm run dev:web
```

### Build the static web package

```bash
npm run build:web
```

Production environment example:

```env
VITE_BACKEND_ORIGIN=https://your-backend.example.com
VITE_WEB_APP_MODE=web
```

## Development

Common scripts:

- `npm run dev`: start the Electron desktop development runtime.
- `npm run dev:web`: start the web Vite development server.
- `npm run build`: build Electron main, preload, and renderer.
- `npm run build:web`: build the static web frontend into `dist-web/`.
- `npm run preview:web`: preview the static web build locally.
- `npm run generate:api-types`: regenerate frontend API types from Server OpenAPI.
- `npm run typecheck`: run TypeScript checks.
- `npm run test:run`: run Vitest once.
- `npm run release:win`: build the backend desktop bundle and package the Windows installer.
- `npm run release:mac`: build the backend desktop bundle and package the macOS desktop app on macOS.
- `npm run release:mac:publish -- --tag vX.Y.Z`: build macOS DMG/ZIP assets locally, generate checksums, and upload them to the GitHub Release.

### Release process

- **Windows / Web / Windows Server**: push a `vX.Y.Z` tag and `.github/workflows/release-windows.yml` builds and publishes these assets automatically.
- **macOS**: on macOS, run `npm run release:mac:publish -- --tag vX.Y.Z`. The script uses the official Electron Builder binary mirror, builds the DMG/ZIP packages, generates `SHA256SUMS-macos.txt`, and uploads the assets to the same GitHub Release.
- Before publishing, push matching version tags to both the Client and Server repositories and complete `gh auth login`. Use `--skip-build` when the macOS assets have already been built locally.

Backend API, Socket.IO events, deployment, and desktop bundle details are documented here:

[DicomVisionServer README](https://github.com/l5769389/DicomVisionServer)

## Contact & Feedback

Feedback, issue reports, and improvement suggestions are welcome: 5769389@qq.com
