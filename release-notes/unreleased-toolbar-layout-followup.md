# Toolbar Layout Follow-up Notes

Date: 2026-06-17
Scope: DicomVisionClient, `worktree/toolbar-layout`.

## TL-BUG-003 Right Dock Annotation Clear Action

- Issue: the right toolbar had a direct clear action for measurements, but annotation cleanup required users to switch through the Reset panel.
- Impact: annotation and measurement cleanup behaved inconsistently in the right-side toolbar layout.
- Fix: the right dock now treats `annotate` as a detail-capable tool, expands the dock when needed, and shows a clear action that reuses the existing `clearAnnotations` view action.
- Code evidence:
  - `src/renderer/src/components/workspace/shell/ViewerToolbarDock.vue`
  - `src/renderer/src/composables/workspace/toolbar/useViewerWorkspaceToolbar.ts`
  - `src/renderer/src/components/workspace/shell/ViewerToolbarDock.test.ts`
  - `src/renderer/src/composables/workspace/toolbar/useViewerWorkspaceToolbar.test.ts`

## TL-BUG-004 Web Tag Path And ICP Footer Visibility

- Issue: the web Tag tab could show the DICOM file path, and the ICP footer remained visible after images were loaded, leaving permanent bottom spacing. The application top padding was also visually too large.
- Impact: web users could see path details that should remain desktop-only, and loaded viewer layouts kept unnecessary footer space.
- Fix: `viewerPlatform` is passed into the Tag view so web hides the file path; the ICP footer is shown only on the initial web home state before any series or tabs are loaded; footer height reservation now follows footer visibility; app top padding is reduced.
- Code evidence:
  - `src/renderer/src/WorkspaceApp.vue`
  - `src/renderer/src/components/workspace/ViewerWorkspace.vue`
  - `src/renderer/src/components/viewer/views/DicomTagView.vue`

## Validation

- `npm run typecheck`: passed.
- Targeted tests: `ViewerToolbarDock.test.ts` and `useViewerWorkspaceToolbar.test.ts` passed, 36 tests total.
- `npm run test:run`: 347 of 349 tests passed; the remaining 2 failures are the existing `viewTabPatches.test.ts` transform baseline assertions for `offsetX`, `offsetY`, and `zoom`.
