# DicomVision v3.0.0

v3.0.0 is a major release that combines the new right-side toolbar layout, PET/CT Fusion, MPR segmentation/VOI, mobile viewer refresh, QA/MTF report panels, and backend render/data-flow upgrades.

## Release Assets

- `DicomVision-3.0.0-Setup.exe` - Windows desktop installer with the backend bundled.
- `DicomVision-web-v3.0.0.zip` - static web frontend build.
- `DicomVisionServer-v3.0.0-win-x64.zip` - standalone Windows backend bundle.
- `SHA256SUMS.txt` - SHA256 checksums for the release assets.

## Added

- Right-side viewer operation dock with fixed width, collapsible mode, docked subpanels, docked 3D/MIP parameters, and top/right toolbar layout preference.
- Docked QA/MTF result panels that replace scattered dialogs for MTF curves, water phantom QA results, loading states, and errors.
- PET/CT Fusion viewer with CT, PET, fused overlay, PET MIP panes, PET-only display controls, manual registration, registration save flow, and pane double-click expansion.
- Standalone PET viewing refinements, PET display range controls, PET corner-info styling, and PET-specific tool semantics.
- MPR threshold segmentation, spherical VOI workflow, segmentation preview metadata, overlay render intent, and segmentation sidecar-style state flow.
- Mobile viewer refresh with 2D naming, browsing history, PACS settings, unified bottom sheets, mobile reset/clear footers, mobile segmentation controls, and mobile screenshots/GIF.
- MPR and 4D slice playback, 4D phase playback separation, FPS sliders, and play-state locking across conflicting tools.
- Web/mobile UI polish including light theme active viewport styling, settings redesign, and Vue DevTools floating button disabled in renderer builds.

## Improved

- Reduced viewport resize jitter by keeping right-side dock content space stable.
- Reworked right-side tool panels so options, reset/clear actions, PET display, QA, export, rotate, window, annotation, measure, and segmentation actions follow consistent layouts.
- Improved PET/CT and MPR viewport rendering stability, including mobile MPR primary/reference pane switching.
- Improved QA and MTF presentation with report-style metrics, larger MTF chart display, copy/delete actions, and stable panel layout.
- Improved mobile bottom sheets, mobile toolbar organization, More panel sizing, pseudocolor strips, window preset layout, and orientation lock behavior.
- Updated README screenshots and documentation for v3.0.0 workflows.

## Backend

- Added backend support for PET/CT Fusion render flows, PET-only rendering, manual registration previews, registration persistence, and fusion Socket.IO interactions.
- Added MPR segmentation and VOI overlay data flow, render intent, and preview metadata support.
- Improved MPR/4D viewport size handling, render dispatch, playback support, and desktop server bundle packaging.
- Kept PACS DICOMweb/DIMSE, DICOM SR/GSPS, de-identification, tag editing, MTF/FWHM, water phantom QA, and export APIs available for the new client workflows.

## Notes

- Windows desktop packaging is included in this release. macOS and Linux desktop packages are not included in v3.0.0 assets.
- The web package is a static frontend build and must be deployed with a reachable DicomVisionServer backend.
- Server and Client repositories are both tagged `v3.0.0`; release assets are uploaded to the DicomVisionClient release page.
