# DicomVision

[中文说明](./README.md)

DicomVision is a client/server DICOM viewer with a Vue/Electron client and a FastAPI backend. The backend handles DICOM parsing, 2D/MPR/4D/3D reconstruction, PET/CT fusion, segmentation, QA, and export work, then streams rendered results to desktop, web, and mobile interfaces.

## v3.0.0 Highlights

- **Right-side tool dock**: desktop and web now support top toolbar and fixed right-side dock layouts. Tool subpanels, 3D/MIP parameters, QA/MTF reports, and segmentation controls can stay inside the dock instead of opening scattered popups.
- **PET/CT Fusion**: added PET/CT fusion viewing, PET-only display, SUV/intensity controls, manual registration, registration save flow, pane double-click expansion, and standalone PET view refinements.
- **MPR segmentation and VOI**: added threshold segmentation, spherical VOI, segmentation overlays, sidecar-style data flow, and mobile segmentation controls.
- **QA/MTF report panels**: MTF curves, water phantom QA, loading states, and errors are shown in right-side report panels. MTF ROI results open automatically and support copy/delete actions.
- **Mobile refresh**: unified 2D naming, browsing history, PACS settings, bottom sheets, playback/FPS, 4D/MPR slice play, orientation lock, measurement, annotation, segmentation, screenshots, and demo GIF.
- **Release formats**: v3.0.0 provides a Windows desktop installer, a static web package, and a standalone Windows Server bundle. The desktop installer includes the backend server.

## Feature Overview

- Local DICOM file/folder import, browser upload, PACS DICOMweb/DIMSE query and retrieval.
- 2D, 2D Compare, Layout, synchronized multi-series viewing, MPR, oblique MPR, MPR + 3D, 3D volume rendering, and 4D phase playback.
- PET/CT Fusion, PET intensity range control, PET-only display, manual registration, and four-pane/single-pane fusion switching.
- Line, rectangle, ellipse, angle, curve, freeform measurement, annotation, MTF/FWHM, and water phantom QA.
- MPR threshold segmentation, VOI, segmentation preview, segmentation import/export, and mobile touch drawing.
- DICOM tag tree review, VR-aware editing, batch tag modification, de-identification export, PNG/DICOM/DICOM SR/DICOM GSPS export.
- Desktop, web, and mobile-responsive UI with dark, light, and blue themes.

## Web Preview

- https://dicom-vision-client.vercel.app/
- http://111.228.1.213/

The public web preview is useful for UI and basic workflow checks. Real PACS, local large datasets, and desktop embedded-backend workflows are better tested with a local deployment or the desktop app.

## Repositories

- Client: [https://github.com/l5769389/DicomVisionClient](https://github.com/l5769389/DicomVisionClient)
- Server: [https://github.com/l5769389/DicomVisionServer](https://github.com/l5769389/DicomVisionServer)

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

## Release Assets

The v3.0.0 release contains:

- `DicomVision-3.0.0-Setup.exe`: Windows desktop installer with embedded Server bundle.
- `DicomVision-web-v3.0.0.zip`: static web frontend build. It requires a reachable DicomVisionServer backend.
- `DicomVisionServer-v3.0.0-win-x64.zip`: standalone Windows backend bundle.
- `SHA256SUMS.txt`: checksums for release artifacts.

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

### Web development and build

```bash
npm run dev:web
npm run build:web
npm run preview:web
```

Production environment example:

```env
VITE_BACKEND_ORIGIN=https://your-backend.example.com
VITE_WEB_APP_MODE=web
```

### Desktop packaging

Windows:

```powershell
npm run release:win
```

macOS must be built on macOS:

```bash
npm run release:mac
```

## Scripts

- `npm run dev`: start the Electron desktop development runtime.
- `npm run dev:web`: start the web Vite development server.
- `npm run build`: build Electron main, preload, and renderer.
- `npm run build:web`: build the static web frontend into `dist-web/`.
- `npm run generate:api-types`: regenerate frontend API types from Server OpenAPI.
- `npm run typecheck`: run TypeScript checks.
- `npm run test:run`: run Vitest once.
- `npm run release:win`: build the backend desktop bundle and package the Windows installer.

## Backend README

Backend API, Socket.IO events, deployment, and desktop bundle details are documented here:

[DicomVisionServer README](https://github.com/l5769389/DicomVisionServer)
