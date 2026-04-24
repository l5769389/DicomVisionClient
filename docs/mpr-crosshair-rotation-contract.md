# MPR Crosshair Rotation Contract

This document is the source of truth for MPR/oblique crosshair rotation direction.

## Coordinate Terms

- Screen coordinates are DOM/canvas coordinates: `x` grows right, `y` grows down.
- A rendered crosshair angle is measured with `atan2(y - centerY, x - centerX)`.
- In screen coordinates, a positive angle delta is clockwise.
- Crosshair lines are undirected. Angle comparisons must be normalized to a half turn with the range `(-pi / 2, pi / 2]` for deltas.

## Frontend Contract

- The frontend stores rotation drag state at pointer down.
- During a drag, `deltaAngleRad` is cumulative from drag start, not frame-to-frame.
- The frontend sends `deltaAngleRad` unchanged in screen-space convention.
- The frontend must not apply viewport-specific sign fixes.
- The frontend must not convert the delta into patient or volume coordinates.

Relevant frontend boundary:

- `src/renderer/src/composables/measurements/mprCrosshairPointerController.ts`
- `toMprObliqueDeltaAngleRad(screenDeltaAngleRad)` must return the same value.

## Backend Contract

- The backend receives `deltaAngleRad` in screen-space convention.
- `_apply_mpr_rotation_drag` is the only backend place that maps screen delta to world cursor rotation.
- Backend tests assert that a positive wire delta produces a positive rendered crosshair angle delta in AX, COR, and SAG.
- The default SAG plane is the only non-oblique active plane whose world rotation sign already matches screen delta. Once SAG becomes oblique, it uses the same opposite-handed world rotation mapping as AX/COR.
- Display row/col basis must be derived from the plane normal and the viewport default basis.
- Display basis must not follow cursor in-plane rotation.
- Display basis must use a stable primary axis and must not switch between row and col based on small projection-length differences.
- Frontend fallback display-basis derivation must use the same stable primary-axis rule as the backend: project default row first, and fall back to default col only when row projection degenerates.

Relevant backend boundary:

- `app/services/viewer_service.py::_apply_mpr_rotation_drag`
- `app/services/mpr/planes.py::derive_plane_pose`

## Regression Rules

These behaviors must stay covered by tests:

- Initial AX, COR, and SAG mouse rotation direction matches the actual rendered crosshair direction.
- AX small rotation does not mirror COR.
- AX rotation followed by COR rotation keeps COR line direction consistent.
- AX rotation followed by SAG rotation keeps SAG line direction consistent.
- AX rotation followed by COR rotation does not flip top/bottom orientation labels.
- AX rotation followed by SAG rotation does not flip top/bottom orientation labels.
- Crossing 90/270 degrees does not flip row/col display basis.

When adding a fix, prefer adding one test at the API boundary and one test at the user-visible behavior boundary. Avoid tests that only verify an internal implementation detail.
