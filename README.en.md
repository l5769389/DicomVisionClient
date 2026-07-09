# DicomVision

[中文说明](./README.md)

DicomVision is a client/server DICOM viewer with a Vue/Electron client and a FastAPI backend. The backend handles DICOM parsing, 2D/MPR/4D/3D reconstruction, PET/CT fusion, segmentation, QA, and export work, then streams rendered results to desktop, web, and mobile interfaces.

## v3.1.0 Highlights

- **3D rendering and interaction**: improves VR/Surface preview/final consistency, direct model rotation, stale-frame suppression, mobile 3D camera fitting, and final-frame sampling quality.
- **3D presets and parameters**: adds General, CT, CTA, MR, and CBCT preset groups. AAA and related presets now use CT HU anchors plus foreground percentiles, while Surface keeps independent iso-surface/material controls.
- **3D tools**: adds remove-bed rendering, freeform clipping, clip progress feedback, 3D parameter popovers, mobile 3D tools, and server-driven metadata sync.
- **Web/mobile connectivity**: local web development now connects to the backend through the current page host, so phones on the LAN do not try to connect to their own `127.0.0.1`. Development mode also clears stale PWA caches to avoid module MIME errors.
- **Demo data**: local macOS development prefers `/Users/jun/Documents/test_dicom/py_test_path/py_test_path2`; deployed environments continue to use the bundled sample data.
- **Release formats**: v3.1.0 is prepared for static web assets, Windows desktop installer, Windows standalone Server bundle, macOS DMG/ZIP desktop packages, and checksums.

## Feature Overview

- **Data sources**: local DICOM files/folders, drag-and-drop import, browser upload, server sample data, and PACS DICOMweb/DIMSE query/retrieval.
- **2D viewing**: window/level, zoom, pan, scroll, flip/rotate, pseudocolor, synchronized browsing, Compare, Layout, multi-series, and multi-view workspaces.
- **MPR/4D**: AX/COR/SAG tri-view, oblique MPR, synchronized crosshair, MPR playback, 4D phase playback, FPS control, and phase sync.
- **3D**: VR volume rendering, Surface rendering, MIP/XRay-style presets, AAA/CT/CTA/MR/CBCT adaptive presets, 3D parameter panels, remove-bed, freeform clipping, and mobile touch 3D.
- **PET/CT Fusion**: PET/CT fusion, PET-only mode, SUV/intensity range controls, manual registration, saved registration, and four-pane/single-pane switching.
- **Measurement and annotation**: line, rectangle, ellipse, angle, curve, freeform measurements, arrow/text annotations, realtime drafts, and ROI metrics.
- **Segmentation and QA**: MPR threshold segmentation, spherical VOI, segmentation overlays, segmentation import/export, MTF/FWHM, water phantom QA, and report panels.
- **DICOM and export**: DICOM tag tree, VR-aware editing, batch tag changes, de-identification export, PNG, DICOM, DICOM SR, and DICOM GSPS export.
- **Multi-platform UI**: desktop, web, and mobile-responsive UI with dark, light, and blue themes. Desktop installers include the backend service.

## Web Preview

- https://dicom.zhaolin.online/

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

The v3.1.0 release contains:

- `DicomVision-3.1.0-Setup.exe`: Windows desktop installer with embedded Server bundle.
- `DicomVision-web-v3.1.0.zip`: static web frontend build. It requires a reachable DicomVisionServer backend.
- `DicomVisionServer-v3.1.0-win-x64.zip`: standalone Windows backend bundle.
- `DicomVision-3.1.0-Setup.dmg`: macOS desktop installer image with embedded Server bundle.
- `DicomVision-3.1.0-Setup.zip`: macOS desktop ZIP package.
- `SHA256SUMS-windows.txt` / `SHA256SUMS-macos.txt`: checksums for release artifacts.

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
