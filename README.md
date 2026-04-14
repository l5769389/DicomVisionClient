# DicomVision Client

[中文文档](./README.zh-CN.md)

DicomVision Client is the desktop frontend for the DICOM viewer workflow. It provides the interactive workspace for browsing series, opening stack/MPR/3D views, operating toolbars, and receiving real-time rendered images from the backend service.

The client is built with Electron, Vue 3, Vuetify, and Socket.IO, and is intended to work with the backend service in `D:\ct\git-repo\my\dicomVision\DicomVisionServer`.

## Table of Contents

- [Overview](#overview)
- [Highlights](#highlights)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Backend Connectivity](#backend-connectivity)
- [Main UI Modules](#main-ui-modules)
- [Interaction Model](#interaction-model)
- [Supported View Modes](#supported-view-modes)
- [Scripts](#scripts)
- [Related Backend Project](#related-backend-project)

## Overview

DicomVision Client is a stateful desktop application that drives backend rendering and presents returned image frames and overlays. It does not perform medical image rendering locally.

Typical user flow:

1. Load a local DICOM folder from the sidebar workflow.
2. Select a series and open one or more viewport types.
3. Bind viewport size and workspace state.
4. Interact through the toolbar and pointer gestures.
5. Receive server-rendered images and overlay metadata in real time.

## Highlights

- Desktop application built on Electron
- Vue 3 renderer with Vuetify-based UI composition
- Real-time viewport updates over Socket.IO
- Support for stack, MPR, and 3D viewing modes
- Sidebar workflow for series loading, status display, and settings
- Toolbar-driven image operations and 3D preset selection
- Dedicated 3D configuration panel for transfer-function tuning

## Technology Stack

- Electron
- electron-vite
- Vue 3
- TypeScript
- Vuetify
- Tailwind CSS
- Axios
- Socket.IO Client

## Repository Structure

```text
src/
  main/                    Electron main process
  preload/                 preload bridge
  renderer/                Vue renderer application
  shared/                  shared contracts and types

src/renderer/src/
  components/              UI components
  composables/             workspace state and interaction logic
  plugins/                 renderer plugin setup
  services/                HTTP and socket clients
  types/                   frontend domain types
```

## Architecture

The client consists of three layers:

- Electron main process for desktop window lifecycle
- preload layer for controlled renderer integration
- Vue renderer for the full viewer experience

Core frontend responsibilities:

- load local DICOM folders through backend HTTP APIs
- manage viewer tabs and viewport layout
- send interaction events such as pan, zoom, scroll, reset, crosshair, and 3D operations
- receive rendered image frames and overlay metadata
- expose 3D preset and custom volume configuration controls

## Quick Start

### Requirements

- Node.js 20+ recommended
- npm
- Running DicomVision Server instance, default `http://127.0.0.1:8000`

### Install Dependencies

```bash
npm install
```

### Start Development Mode

```bash
npm run dev
```

This starts the Electron development environment through `electron-vite`.

### Build for Production

```bash
npm run build
```

Run type checking when needed:

```bash
npm run typecheck
```

## Backend Connectivity

Current defaults in the renderer code:

- API base URL: `http://127.0.0.1:8000/api/v1`
- Socket.IO origin: `http://127.0.0.1:8000`

Relevant files:

- `src/renderer/src/services/api.ts`
- `src/renderer/src/services/socket.ts`
- `src/renderer/src/composables/useViewerWorkspace.ts`

Make sure the backend is running before opening or interacting with viewports.

## Main UI Modules

- `SidebarPanel.vue`: shell for the left-side workflow area
- `SidebarSeriesList.vue`: loaded series browsing
- `ViewerWorkspace.vue`: central workspace container
- `ViewerToolbar.vue`: operation toolbar
- `ViewerTabStrip.vue`: tab management
- `StackView.vue`: stack viewport
- `MprView.vue`: MPR viewport
- `VolumeView.vue`: 3D viewport
- `VolumeRenderConfigPanel.vue`: custom 3D rendering controls

## Interaction Model

The frontend acts as the interaction layer for:

- series loading
- viewport creation and layout management
- pointer-driven operations
- toolbar action dispatch
- realtime image and overlay presentation

## Supported View Modes

- Stack
- MPR
- 3D volume view

The 3D workflow includes preset selection and editable transfer-function controls such as layer visibility, WW/WL, opacity, color gradients, blend mode, and lighting behavior.

## Scripts

- `npm run dev`: start Electron in development mode
- `npm run build`: build the application with electron-vite
- `npm run stage:server`: copy a prebuilt server bundle into `dist-server/DicomVisionServer`
- `npm run preview`: preview the built application
- `npm run dist:win`: build the Windows installer, consuming a staged server bundle
- `npm run release:win`: build the server bundle from the companion repository and assemble the Windows installer in one step
- `npm run typecheck`: run renderer and node TypeScript checks

For desktop packaging, the client repository is now only responsible for assembling the Electron installer. The backend repository should produce its own desktop bundle artifact first, then this repository stages that artifact before invoking `electron-builder`.

## Related Backend Project

The companion backend project is located at:

`D:\ct\git-repo\my\dicomVision\DicomVisionServer`

Recommended startup order:

1. Start the backend server.
2. Start the Electron client.
3. Load a DICOM folder and create viewports from the UI.
