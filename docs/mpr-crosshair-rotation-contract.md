# MPR Crosshair Rotation Contract

This document is the frontend-facing contract for MPR crosshair rotation.

## Contract

- The frontend does not calculate MPR rotation angles.
- The frontend does not send `angleRad` or `deltaAngleRad`.
- The frontend only sends interaction facts:
  - `opType: "mprOblique"` for line rotation;
  - `actionType: "start" | "move" | "end"`;
  - `line: "horizontal" | "vertical"`;
  - `x` and `y`, normalized to the rendered image/canvas.
- The backend owns all MPR geometry:
  - drag-start cursor snapshot;
  - pointer angle resolution;
  - paired target plane normal updates;
  - derived `mprPlane`, `mprFrame`, and `mpr_crosshair` payloads.

## Frontend Boundary

Relevant files:

- `src/renderer/src/composables/measurements/mprCrosshairPointerController.ts`
- `src/renderer/src/composables/measurements/useViewerWorkspacePointer.ts`
- `src/renderer/src/composables/workspace/core/useViewerWorkspace.ts`
- `src/renderer/src/services/socket.ts`

Frontend responsibilities:

- Hit-test crosshair center vs. crosshair lines.
- Enter move mode when the center is hit.
- Enter rotate mode when a horizontal/vertical line is hit.
- Send pointer `x/y` for every drag phase.
- Draw the backend-returned crosshair and planes.

Frontend non-responsibilities:

- No screen-angle unwrapping.
- No viewport-specific sign correction.
- No patient/world/plane calculation.

## Backend Boundary

The companion backend document is:

- `DicomVisionServer/docs/mpr-crosshair-rotation-reimplementation.zh-CN.md`
