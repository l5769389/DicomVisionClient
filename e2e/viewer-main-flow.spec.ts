import { expect, test, type Locator, type Page } from '@playwright/test'

const SAMPLE_COLUMNS = 512
const SAMPLE_ROWS = 329
const SAMPLE_PIXEL_SPACING_MM = 0.9765625
const SAMPLE_TOTAL_SLICES = 27
const SAMPLE_REPRESENTATIVE_SLICE = 15

async function loadRealDicomSample(page: Page, isMobile: boolean): Promise<Locator> {
  await page.goto(isMobile ? '/m' : '/')
  const initialLocaleDialog = page.locator('.app-initial-locale')
  if (!isMobile) {
    await initialLocaleDialog.waitFor({ state: 'visible', timeout: 5000 }).then(async () => {
      await initialLocaleDialog.getByRole('button', { name: /简体中文/ }).click()
      await expect(initialLocaleDialog).toBeHidden()
    }).catch(() => {
      // Existing preferences skip the first-run language chooser.
    })
  }

  if (isMobile) {
    await page.getByTestId('mobile-load-demo').click()
    await expect(page.getByTestId('mobile-title-series-button')).toBeVisible({ timeout: 30_000 })
    const image = page.locator('.mobile-stack-viewport__image')
    await expect(image).toBeVisible({ timeout: 30_000 })
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0)
    const sheetClose = page.locator('.mobile-shell__sheet-close')
    if (await sheetClose.isVisible()) {
      await sheetClose.click()
    }
    return image
  }

  await page.getByRole('button', { name: /加载示例影像|Load Sample/i }).click()
  const previewButton = page.getByRole('button', { name: /快速浏览|Quick Preview/i })
  await expect(previewButton).toBeEnabled({ timeout: 30_000 })
  await previewButton.click()
  const image = page.locator('.viewer-image[alt="Stack"]')
  await expect(image).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0)
  return image
}

const MPR_VIEWPORT_KEYS = ['mpr-ax', 'mpr-cor', 'mpr-sag'] as const
type MprViewportKey = (typeof MPR_VIEWPORT_KEYS)[number]

async function openRealDicomMpr(page: Page, isMobile: boolean): Promise<void> {
  await loadRealDicomSample(page, isMobile)

  if (isMobile) {
    await page.getByTestId('mobile-title-series-button').click()
    await expect(page.getByTestId('mobile-open-mpr')).toBeVisible()
    await page.getByTestId('mobile-open-mpr').click()
    await expect(page.getByTestId('mobile-mpr-viewport')).toBeVisible({ timeout: 30_000 })
  } else {
    await page.getByRole('button', { name: 'MPR', exact: true }).first().click()
  }

  for (const viewportKey of MPR_VIEWPORT_KEYS) {
    const image = page.locator(
      `.viewer-viewport[data-viewport-key="${viewportKey}"] img.viewer-image`
    )
    await expect(image).toBeVisible({ timeout: 30_000 })
    await expect.poll(
      () => image.evaluate((element: HTMLImageElement) => element.naturalWidth),
      { timeout: 30_000 }
    ).toBeGreaterThan(0)
  }
}

function getMprStage(page: Page, viewportKey: MprViewportKey): Locator {
  return page.locator(`.viewer-viewport[data-viewport-key="${viewportKey}"]`)
}

async function selectMobileMprPlane(page: Page, viewportKey: MprViewportKey): Promise<Locator> {
  await page.getByTestId(`mobile-mpr-plane-${viewportKey}`).click()
  const primary = page.getByTestId('mobile-mpr-primary').locator('.viewer-viewport')
  await expect(primary).toHaveAttribute('data-viewport-key', viewportKey)
  return primary
}

async function getMprSliceInfo(stage: Locator): Promise<{ current: number; total: number }> {
  const texts = await stage.locator('.viewer-corner-line').allTextContents()
  for (const text of texts) {
    const match = text.match(/Im:\s*(\d+)\s*\/\s*(\d+)/i)
    if (match) {
      return { current: Number(match[1]), total: Number(match[2]) }
    }
  }
  return { current: 0, total: 0 }
}

async function waitForMprSliceInfo(stage: Locator): Promise<{ current: number; total: number }> {
  await expect.poll(async () => (await getMprSliceInfo(stage)).total, { timeout: 30_000 }).toBeGreaterThan(0)
  return getMprSliceInfo(stage)
}

function getStackStage(page: Page, isMobile: boolean): Locator {
  return isMobile
    ? page.locator('.mobile-stack-viewport__stage')
    : page.locator('.viewer-viewport[data-viewport-key="single"]')
}

function getSliceRange(page: Page, isMobile: boolean): Locator {
  return isMobile ? page.getByTestId('mobile-slice-range') : page.locator('.stack-slice-slider')
}

async function expectSlice(page: Page, isMobile: boolean, current: number): Promise<void> {
  const range = getSliceRange(page, isMobile)
  await expect(range).toHaveAttribute('max', String(SAMPLE_TOTAL_SLICES))
  await expect(range).toHaveValue(String(current), { timeout: 15_000 })
  await expect(
    page.locator('.viewer-corner-line').filter({
      hasText: new RegExp(`Im:\\s*${current}\\s*/\\s*${SAMPLE_TOTAL_SLICES}`, 'i')
    })
  ).toBeVisible({ timeout: 15_000 })
}

async function setSlice(page: Page, isMobile: boolean, value: number): Promise<void> {
  await getSliceRange(page, isMobile).evaluate((element, nextValue) => {
    const input = element as HTMLInputElement
    input.value = String(nextValue)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

async function setSliceSequence(page: Page, isMobile: boolean, values: number[]): Promise<void> {
  await getSliceRange(page, isMobile).evaluate((element, nextValues) => {
    const input = element as HTMLInputElement
    for (const nextValue of nextValues) {
      input.value = String(nextValue)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, values)
}

async function setSliceAndWaitForImage(
  page: Page,
  isMobile: boolean,
  image: Locator,
  value: number
): Promise<void> {
  const previousSrc = await image.getAttribute('src')
  await setSlice(page, isMobile, value)
  await expectSlice(page, isMobile, value)
  await expect.poll(() => image.getAttribute('src'), { timeout: 15_000 }).not.toBe(previousSrc)
  await expect.poll(
    () => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0),
    { timeout: 15_000 }
  ).toBe(true)
}

async function expectConnectionState(
  page: Page,
  isMobile: boolean,
  state: 'connected' | 'offline'
): Promise<void> {
  if (isMobile) {
    const expected = state === 'connected' ? 'connected' : /^(disconnected|reconnecting)$/
    await expect(page.getByTestId('mobile-connection-status')).toHaveAttribute(
      'aria-label',
      expected,
      { timeout: 20_000 }
    )
    return
  }

  const label = state === 'connected'
    ? /^(已连接|Connected)$/
    : /^(未连接|Disconnected|重连中|Reconnecting)$/
  await expect(page.locator('span.truncate').filter({ hasText: label })).toBeVisible({ timeout: 20_000 })
}

async function imageFingerprint(image: Locator): Promise<string> {
  return image.evaluate((element: HTMLImageElement) => {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Canvas 2D context is unavailable')
    context.drawImage(element, 0, 0, canvas.width, canvas.height)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let hash = 2166136261
    for (const value of pixels) {
      hash ^= value
      hash = Math.imul(hash, 16777619)
    }
    return `${element.naturalWidth}x${element.naturalHeight}:${hash >>> 0}`
  })
}

async function selectMeasurementTool(
  page: Page,
  isMobile: boolean,
  tool: 'line' | 'rect'
): Promise<void> {
  if (isMobile) {
    await page.getByTestId('mobile-tool-measure').click()
    await page.getByTestId(`mobile-tool-measure-${tool}`).click()
    return
  }

  await page
    .locator(
      '.viewer-toolbar-dock__button[title*="Measure"], .viewer-toolbar-dock__button[title*="测量"]'
    )
    .first()
    .click()
  const optionName = tool === 'line' ? /^(Line|线段)$/i : /^(Rect|矩形)$/i
  await page.getByRole('button', { name: optionName }).click()
}

async function dragOnStage(
  page: Page,
  stage: Locator,
  deltaX: number,
  deltaY: number
): Promise<{ width: number; height: number }> {
  const bounds = await stage.boundingBox()
  expect(bounds).not.toBeNull()
  if (!bounds) {
    throw new Error('Viewer stage has no layout bounds')
  }

  const startX = bounds.x + (bounds.width - deltaX) / 2
  const startY = bounds.y + (bounds.height - deltaY) / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 10 })
  await page.mouse.up()
  return { width: bounds.width, height: bounds.height }
}

function physicalDistanceForCenteredDrag(
  cssDistance: number,
  canvasLength: number,
  sourceLength: number,
  containZoom: number
): number {
  const imageOffset = (canvasLength - sourceLength * containZoom) / 2
  const startCanvas = (canvasLength - cssDistance) / 2
  const endCanvas = startCanvas + cssDistance
  const startSource = Math.round((startCanvas - imageOffset) / containZoom)
  const endSource = Math.round((endCanvas - imageOffset) / containZoom)
  return Math.abs(endSource - startSource) * SAMPLE_PIXEL_SPACING_MM
}

async function clearMeasurements(page: Page, isMobile: boolean): Promise<void> {
  if (isMobile) {
    const inlineBack = page.getByTestId('mobile-inline-tool-back')
    if (await inlineBack.isVisible()) {
      await inlineBack.click()
    }
    await page.getByTestId('mobile-more-button').click()
    await page.getByTestId('mobile-sheet-tab-measure').click()
    await page.getByTestId('mobile-measure-clear').click()
    return
  }

  await page.getByTestId('viewer-toolbar-dock-measure-reset-measurements').click()
}

async function selectWindowTool(page: Page, isMobile: boolean): Promise<void> {
  if (isMobile) {
    await page.getByTestId('mobile-tool-window').click()
    return
  }
  await page
    .locator(
      '.viewer-toolbar-dock__button[title="Window"], .viewer-toolbar-dock__button[title*="窗宽"], .viewer-toolbar-dock__button[title*="窗位"]'
    )
    .first()
    .click()
}

async function resetView(page: Page, isMobile: boolean): Promise<void> {
  if (isMobile) {
    await page.getByTestId('mobile-more-button').click()
    await page.getByTestId('mobile-sheet-tab-reset').click()
    await page.getByTestId('mobile-reset-option').filter({ hasText: /重置视图|Reset View/i }).click()
    return
  }

  await page
    .locator(
      '.viewer-toolbar-dock__tools .viewer-toolbar-dock__button[title*="Reset"], .viewer-toolbar-dock__tools .viewer-toolbar-dock__button[title*="重置"]'
    )
    .first()
    .click()
  const dockResetOption = page.locator('.viewer-toolbar-dock-panel-content__option', {
    hasText: /重置视图|Reset View/i
  })
  await expect(dockResetOption.first()).toBeVisible()
  await dockResetOption.first().click({ position: { x: 24, y: 24 } })
}

async function rotateViewClockwise(page: Page, isMobile: boolean): Promise<void> {
  if (isMobile) {
    const inlineBack = page.getByTestId('mobile-inline-tool-back')
    if (await inlineBack.isVisible()) {
      await inlineBack.click()
    }
    await page.getByTestId('mobile-more-button').click()
    await page.getByTestId('mobile-sheet-tab-transform').click()
    await page.getByTestId('mobile-transform').filter({ hasText: /顺时针 90|CW 90/i }).click()
    return
  }

  await page
    .locator(
      '.viewer-toolbar-dock__button[title*="Rotate"], .viewer-toolbar-dock__button[title*="旋转"]'
    )
    .first()
    .click()
  await page.getByRole('button', { name: /顺时针 90|CW 90/i }).click()
}

test('loads a real DICOM sample and renders the first 2D view', async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === 'mobile-chrome'
  const image = await loadRealDicomSample(page, isMobile)

  await expect(image).toBeVisible()
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0)
  await expectSlice(page, isMobile, SAMPLE_REPRESENTATIVE_SLICE)
})

test('desktop measurement menu flexes before its option list scrolls and shares one reset tone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'Desktop right-dock layout only')
  await page.setViewportSize({ width: 1440, height: 1200 })
  await loadRealDicomSample(page, false)

  await page
    .locator(
      '.viewer-toolbar-dock__button[title*="Measure"], .viewer-toolbar-dock__button[title*="测量"]'
    )
    .first()
    .click()

  const optionList = page.getByTestId('viewer-toolbar-dock-measure-options')
  const clearMeasurements = page.getByTestId('viewer-toolbar-dock-measure-reset-measurements')
  const scopeCard = page.locator('.viewer-toolbar-dock-panel-content__scope-card')
  await expect(optionList).toBeVisible()
  await expect(scopeCard).toBeVisible()
  await expect(clearMeasurements).toBeVisible()

  const tallLayout = await optionList.evaluate((element) => {
    const rowHeights = [
      ...element.querySelectorAll<HTMLElement>('.viewer-toolbar-dock-panel-content__option')
    ].map((row) => row.getBoundingClientRect().height)
    return {
      clientHeight: element.clientHeight,
      rowHeights,
      scrollHeight: element.scrollHeight
    }
  })
  expect(tallLayout.scrollHeight).toBeLessThanOrEqual(tallLayout.clientHeight + 1)
  expect(tallLayout.rowHeights.length).toBeGreaterThanOrEqual(8)
  expect(Math.min(...tallLayout.rowHeights)).toBeGreaterThanOrEqual(48)
  expect(
    Math.max(...tallLayout.rowHeights) - Math.min(...tallLayout.rowHeights)
  ).toBeLessThanOrEqual(1)

  const clearTone = await clearMeasurements.evaluate((element) => {
    const buttonStyle = getComputedStyle(element)
    const iconStyle = getComputedStyle(
      element.querySelector<HTMLElement>('.viewer-toolbar-dock-panel-content__danger-action-icon')!
    )
    return {
      backgroundColor: buttonStyle.backgroundColor,
      borderColor: buttonStyle.borderColor,
      iconColor: iconStyle.color
    }
  })

  await page.setViewportSize({ width: 1440, height: 650 })
  await expect.poll(
    async () => optionList.evaluate((element) => element.scrollHeight > element.clientHeight)
  ).toBe(true)
  const compactRowHeights = await optionList
    .locator('.viewer-toolbar-dock-panel-content__option')
    .evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height))
  expect(Math.min(...compactRowHeights)).toBeGreaterThanOrEqual(48)
  await expect(scopeCard).toBeVisible()
  await expect(clearMeasurements).toBeVisible()

  await selectWindowTool(page, false)
  const resetWindow = page.getByTestId('viewer-toolbar-dock-window-window-reset')
  await expect(resetWindow).toBeVisible()
  const resetTone = await resetWindow.evaluate((element) => {
    const buttonStyle = getComputedStyle(element)
    const iconStyle = getComputedStyle(
      element.querySelector<HTMLElement>('.viewer-toolbar-dock-panel-content__danger-action-icon')!
    )
    return {
      backgroundColor: buttonStyle.backgroundColor,
      borderColor: buttonStyle.borderColor,
      iconColor: iconStyle.color
    }
  })
  expect(resetTone).toEqual(clearTone)
})

test('renders real DICOM MPR geometry and keeps shared cursor state synchronized', async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === 'mobile-chrome'
  await openRealDicomMpr(page, isMobile)

  const before = new Map<MprViewportKey, { current: number; total: number }>()
  for (const viewportKey of MPR_VIEWPORT_KEYS) {
    const stage = isMobile
      ? await selectMobileMprPlane(page, viewportKey)
      : getMprStage(page, viewportKey)
    const info = await waitForMprSliceInfo(stage)
    before.set(viewportKey, info)
    await expect(stage.getByText('10 cm', { exact: true })).toBeVisible({ timeout: 15_000 })
  }

  expect([...before.values()].map((item) => item.total).sort((a, b) => a - b)).toEqual([
    SAMPLE_TOTAL_SLICES,
    SAMPLE_ROWS,
    SAMPLE_COLUMNS
  ])

  const axialStage = isMobile
    ? await selectMobileMprPlane(page, 'mpr-ax')
    : getMprStage(page, 'mpr-ax')
  const axialImage = axialStage.locator('img.viewer-image')
  const axialFingerprintBefore = await imageFingerprint(axialImage)
  const axialInfoBefore = before.get('mpr-ax')
  expect(axialInfoBefore).toBeDefined()
  if (!axialInfoBefore) return

  if (isMobile) {
    const range = getSliceRange(page, true)
    await expect(range).toHaveValue(String(axialInfoBefore.current))
    await expect(range).toHaveAttribute('max', String(axialInfoBefore.total))
    return
  }

  await axialStage.hover()
  await page.mouse.wheel(0, 120)
  await expect.poll(async () => (await getMprSliceInfo(axialStage)).current, { timeout: 15_000 })
    .not.toBe(axialInfoBefore.current)
  const axialInfoAfter = await getMprSliceInfo(axialStage)
  expect(Math.abs(axialInfoAfter.current - axialInfoBefore.current)).toBe(1)
  await expect.poll(() => imageFingerprint(axialImage), { timeout: 15_000 }).not.toBe(axialFingerprintBefore)

  for (const viewportKey of ['mpr-cor', 'mpr-sag'] as const) {
    const stage = isMobile
      ? await selectMobileMprPlane(page, viewportKey)
      : getMprStage(page, viewportKey)
    const info = await waitForMprSliceInfo(stage)
    expect(info).toEqual(before.get(viewportKey))
  }
})

test('keeps slice index, corner metadata, and rendered pixels coupled across a real series', async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === 'mobile-chrome'
  const image = await loadRealDicomSample(page, isMobile)
  await expectSlice(page, isMobile, SAMPLE_REPRESENTATIVE_SLICE)
  const representativeFingerprint = await imageFingerprint(image)

  if (isMobile) {
    await page.getByTestId('mobile-tool-scroll').click()
    await dragOnStage(page, getStackStage(page, true), 0, 45)
  } else {
    const stage = getStackStage(page, false)
    await stage.hover()
    await page.mouse.wheel(0, 120)
  }

  await expectSlice(page, isMobile, SAMPLE_REPRESENTATIVE_SLICE + 1)
  await expect.poll(() => imageFingerprint(image)).not.toBe(representativeFingerprint)
  const nextFingerprint = await imageFingerprint(image)

  await setSlice(page, isMobile, SAMPLE_TOTAL_SLICES)
  await expectSlice(page, isMobile, SAMPLE_TOTAL_SLICES)
  await expect.poll(() => imageFingerprint(image)).not.toBe(nextFingerprint)

  await setSlice(page, isMobile, SAMPLE_TOTAL_SLICES + 10)
  await expectSlice(page, isMobile, SAMPLE_TOTAL_SLICES)

  await setSlice(page, isMobile, 1)
  await expectSlice(page, isMobile, 1)
  const firstFingerprint = await imageFingerprint(image)
  expect(firstFingerprint).not.toBe(representativeFingerprint)

  await setSlice(page, isMobile, -10)
  await expectSlice(page, isMobile, 1)
})

test('rapid out-of-order slice requests settle on the latest requested image and metadata', async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === 'mobile-chrome'
  const image = await loadRealDicomSample(page, isMobile)

  await setSliceAndWaitForImage(page, isMobile, image, 4)
  const expectedFourthSliceFingerprint = await imageFingerprint(image)

  await setSliceAndWaitForImage(page, isMobile, image, 1)

  const imageBeforeRapidRequests = await image.getAttribute('src')
  await setSliceSequence(page, isMobile, [SAMPLE_TOTAL_SLICES, 2, 4])

  await expectSlice(page, isMobile, 4)
  await expect.poll(() => image.getAttribute('src'), { timeout: 15_000 }).not.toBe(imageBeforeRapidRequests)
  await expect.poll(
    () => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0),
    { timeout: 15_000 }
  ).toBe(true)
  await expect.poll(() => imageFingerprint(image), { timeout: 15_000 }).toBe(expectedFourthSliceFingerprint)
})

test('rebinds the open DICOM view after a network disconnect and continues rendering', async ({ page, context }, testInfo) => {
  const isMobile = testInfo.project.name === 'mobile-chrome'
  const image = await loadRealDicomSample(page, isMobile)
  await expectConnectionState(page, isMobile, 'connected')
  const fingerprintBeforeDisconnect = await imageFingerprint(image)

  try {
    await context.setOffline(true)
    await expectConnectionState(page, isMobile, 'offline')

    await context.setOffline(false)
    await expectConnectionState(page, isMobile, 'connected')

    await setSliceAndWaitForImage(page, isMobile, image, SAMPLE_REPRESENTATIVE_SLICE + 1)
    await expect.poll(() => imageFingerprint(image), { timeout: 15_000 }).not.toBe(fingerprintBeforeDisconnect)
  } finally {
    await context.setOffline(false)
  }
})

test('line measurement reports DICOM physical millimetres on web and mobile', async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === 'mobile-chrome'
  await loadRealDicomSample(page, isMobile)
  await selectMeasurementTool(page, isMobile, 'line')

  const stage = getStackStage(page, isMobile)
  const bounds = await stage.boundingBox()
  expect(bounds).not.toBeNull()
  if (!bounds) return
  const dragDistanceCssPixels = Math.min(100, Math.floor(bounds.width * 0.35))
  const stageSize = await dragOnStage(page, stage, dragDistanceCssPixels, 0)

  // The backend contains the 512x329 source image inside the CSS canvas.
  // Canvas deltas are converted back to source columns and multiplied by
  // DICOM PixelSpacing[1], yielding the physical length in millimetres.
  const containZoom = Math.min(stageSize.width / SAMPLE_COLUMNS, stageSize.height / SAMPLE_ROWS)
  const expectedLengthMm = (dragDistanceCssPixels / containZoom) * SAMPLE_PIXEL_SPACING_MM
  await expect(page.getByText(`${expectedLengthMm.toFixed(1)} mm`, { exact: true })).toBeVisible({ timeout: 15_000 })
})

test('physical measurement remains attached and numerically stable after a 2D rotation', async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === 'mobile-chrome'
  const image = await loadRealDicomSample(page, isMobile)
  await selectMeasurementTool(page, isMobile, 'line')

  const stage = getStackStage(page, isMobile)
  const bounds = await stage.boundingBox()
  expect(bounds).not.toBeNull()
  if (!bounds) return
  const dragDistanceCssPixels = Math.min(100, Math.floor(bounds.width * 0.35))
  const stageSize = await dragOnStage(page, stage, dragDistanceCssPixels, 0)
  const containZoom = Math.min(stageSize.width / SAMPLE_COLUMNS, stageSize.height / SAMPLE_ROWS)
  const expectedLengthMm = (dragDistanceCssPixels / containZoom) * SAMPLE_PIXEL_SPACING_MM
  const measurementLabel = page.getByText(`${expectedLengthMm.toFixed(1)} mm`, { exact: true })
  await expect(measurementLabel).toBeVisible({ timeout: 15_000 })

  const imageBeforeRotation = await image.getAttribute('src')
  await rotateViewClockwise(page, isMobile)
  await expect.poll(() => image.getAttribute('src'), { timeout: 15_000 }).not.toBe(imageBeforeRotation)
  await expect(measurementLabel).toBeVisible({ timeout: 15_000 })
  await expect(
    page.locator('.viewer-corner-line').filter({ hasText: /Rot:\s*90°?\s*\/\s*Flip:/i })
  ).toBeVisible({ timeout: 15_000 })

  await resetView(page, isMobile)
  await expect(measurementLabel).toBeVisible({ timeout: 15_000 })
})

test('rectangle ROI reports physical size and area, then clear removes it', async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === 'mobile-chrome'
  await loadRealDicomSample(page, isMobile)
  await selectMeasurementTool(page, isMobile, 'rect')

  const stage = getStackStage(page, isMobile)
  const bounds = await stage.boundingBox()
  expect(bounds).not.toBeNull()
  if (!bounds) return
  const dragWidth = Math.min(90, Math.floor(bounds.width * 0.3))
  const dragHeight = Math.min(60, Math.floor(bounds.height * 0.25))
  const stageSize = await dragOnStage(page, stage, dragWidth, dragHeight)
  const containZoom = Math.min(stageSize.width / SAMPLE_COLUMNS, stageSize.height / SAMPLE_ROWS)
  const expectedWidthMm = physicalDistanceForCenteredDrag(
    dragWidth,
    stageSize.width,
    SAMPLE_COLUMNS,
    containZoom
  )
  const expectedHeightMm = physicalDistanceForCenteredDrag(
    dragHeight,
    stageSize.height,
    SAMPLE_ROWS,
    containZoom
  )
  const expectedAreaMm2 = expectedWidthMm * expectedHeightMm
  const sizeValue = `${expectedWidthMm.toFixed(1)} * ${expectedHeightMm.toFixed(1)} mm`
  const widthValue = `${expectedWidthMm.toFixed(1)} mm`
  const heightValue = `${expectedHeightMm.toFixed(1)} mm`
  const areaValue = `${expectedAreaMm2.toFixed(1)} mm2`

  if (isMobile) {
    await expect(page.getByText(sizeValue, { exact: true })).toBeVisible({ timeout: 15_000 })
  } else {
    await expect(page.getByText(widthValue, { exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(heightValue, { exact: true })).toBeVisible({ timeout: 15_000 })
  }
  await expect(page.getByText(areaValue, { exact: true })).toBeVisible({ timeout: 15_000 })
  await clearMeasurements(page, isMobile)
  if (isMobile) {
    await expect(page.getByText(sizeValue, { exact: true })).toBeHidden({ timeout: 15_000 })
  } else {
    await expect(page.getByText(widthValue, { exact: true })).toBeHidden({ timeout: 15_000 })
    await expect(page.getByText(heightValue, { exact: true })).toBeHidden({ timeout: 15_000 })
  }
  await expect(page.getByText(areaValue, { exact: true })).toBeHidden({ timeout: 15_000 })
})

test('window interaction renders a new image and reset renders restored state', async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === 'mobile-chrome'
  const image = await loadRealDicomSample(page, isMobile)
  const initialSrc = await image.getAttribute('src')
  expect(initialSrc).toBeTruthy()

  await selectWindowTool(page, isMobile)
  await dragOnStage(page, getStackStage(page, isMobile), 70, 45)
  await expect.poll(() => image.getAttribute('src'), { timeout: 15_000 }).not.toBe(initialSrc)
  await page.waitForTimeout(300)
  const windowedSrc = await image.getAttribute('src')
  expect(windowedSrc).toBeTruthy()

  await resetView(page, isMobile)
  await expect.poll(() => image.getAttribute('src'), { timeout: 15_000 }).not.toBe(windowedSrc)
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0)
})

test('desktop fixed viewport ratio and virtual montage work across window sizes', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  test.skip(testInfo.project.name === 'mobile-chrome', 'Desktop and Web feature only')
  await page.setViewportSize({ width: 1440, height: 900 })
  await loadRealDicomSample(page, false)

  const frame = page.locator('.viewer-viewport-frame-shell')
  await expect(frame).toHaveAttribute('data-viewport-auto-fit', 'true')

  await page.getByRole('button', { name: /打开设置|Open Settings/i }).first().click()
  await page.getByTestId('settings-group-display').click()
  await page.getByTestId('settings-section-displayToolbarLayout').click()
  const autoFitSwitch = page.getByTestId('settings-viewport-auto-fit')
  await expect(autoFitSwitch).toHaveAttribute('aria-checked', 'true')
  await autoFitSwitch.click()
  await expect(autoFitSwitch).toHaveAttribute('aria-checked', 'false')
  await page.locator('.settings-dialog-header button').click()

  await expect(frame).toHaveAttribute('data-viewport-auto-fit', 'false')
  for (const viewportSize of [
    { width: 1440, height: 900 },
    { width: 1100, height: 650 }
  ]) {
    await page.setViewportSize(viewportSize)
    const geometry = await frame.evaluate((element) => {
      const frameBounds = element.getBoundingClientRect()
      const hostBounds = element.parentElement!.getBoundingClientRect()
      return {
        frameHeight: frameBounds.height,
        frameWidth: frameBounds.width,
        horizontalOffset: frameBounds.left - hostBounds.left,
        hostHeight: hostBounds.height,
        hostWidth: hostBounds.width,
        verticalOffset: frameBounds.top - hostBounds.top
      }
    })
    expect(Math.abs(geometry.frameWidth - geometry.frameHeight)).toBeLessThanOrEqual(2)
    expect(geometry.frameWidth).toBeLessThanOrEqual(geometry.hostWidth + 1)
    expect(geometry.frameHeight).toBeLessThanOrEqual(geometry.hostHeight + 1)
    expect(Math.abs(geometry.horizontalOffset - (geometry.hostWidth - geometry.frameWidth) / 2)).toBeLessThanOrEqual(2)
    expect(Math.abs(geometry.verticalOffset - (geometry.hostHeight - geometry.frameHeight) / 2)).toBeLessThanOrEqual(2)
  }

  const requestedTiles = new Set<string>()
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/dicom/montage/tile')) {
      requestedTiles.add(request.url())
    }
  })
  await setSlice(page, false, 3)
  await expectSlice(page, false, 3)
  await page
    .locator('.viewer-toolbar-dock__button[title*="序列平铺"], .viewer-toolbar-dock__button[title*="Series Montage"]')
    .first()
    .click()
  await expect(page.locator('.montage-view')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-slice-index="2"]')).toHaveClass(/montage-view__tile--selected/)
  await expect(page.locator('.montage-view__slice-info')).toHaveCount(0)
  await expect(page.locator('.montage-view__common-info')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.montage-view__scroller')).toHaveAttribute('data-total-slices', String(SAMPLE_TOTAL_SLICES))
  await expect.poll(() => page.locator('.montage-view__tile').count()).toBeLessThan(SAMPLE_TOTAL_SLICES)
  await expect.poll(() => requestedTiles.size, { timeout: 30_000 }).toBeGreaterThan(0)
  expect(requestedTiles.size).toBeLessThan(SAMPLE_TOTAL_SLICES)
  await expect.poll(() => page.locator('.montage-view__image').count(), { timeout: 30_000 }).toBeGreaterThan(0)
  await expect
    .poll(() => page.locator('.montage-view__image').first().evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0)
  await expect(page.locator('.montage-view__error')).toHaveCount(0)
  const initiallyRequestedTileCount = requestedTiles.size

  const montageImages = page.locator('.montage-view__image')
  const initialMontageTransform = await montageImages.first().evaluate((image) => getComputedStyle(image).transform)
  await page
    .locator('.viewer-toolbar-dock__button[title*="窗宽窗位"], .viewer-toolbar-dock__button[title*="Window"]')
    .first()
    .click()
  const customWindowForm = page.locator('.viewer-toolbar-dock-panel-content__custom-window')
  await expect(customWindowForm).toBeVisible()
  await customWindowForm.locator('input').nth(0).fill('650')
  await customWindowForm.locator('input').nth(1).fill('80')
  await customWindowForm.locator('button[type="submit"]').click()
  await expect(page.locator('.montage-view__subtitle')).toContainText(/WW\s+650\s*\/\s*WL\s+80/)
  await expect.poll(() =>
    [...requestedTiles].some((url) => url.includes('ww=650') && url.includes('wl=80'))
  ).toBe(true)
  const windowStatusBeforeDrag = await page.locator('.montage-view__subtitle').textContent()
  await dragOnStage(page, page.locator('.montage-view__scroller'), 80, -20)
  await expect
    .poll(() => page.locator('.montage-view__subtitle').textContent())
    .not.toBe(windowStatusBeforeDrag)
  await expect(page.locator('.montage-view__subtitle')).toContainText(/WW\s+-?\d+\s*\/\s*WL\s+-?\d+/)

  await page
    .locator('.viewer-toolbar-dock__button[title*="平移"], .viewer-toolbar-dock__button[title*="Pan"]')
    .first()
    .click()
  await dragOnStage(page, page.locator('.montage-view__scroller'), 80, 20)
  const pannedMontageTransforms = await montageImages.evaluateAll((images) =>
    images.map((image) => getComputedStyle(image).transform)
  )
  expect(new Set(pannedMontageTransforms).size).toBe(1)
  expect(pannedMontageTransforms[0]).not.toBe(initialMontageTransform)
  await resetView(page, false)
  await expect
    .poll(() => montageImages.first().evaluate((image) => getComputedStyle(image).transform))
    .toBe(initialMontageTransform)

  await page
    .locator('.viewer-toolbar-dock__button[title*="缩放"], .viewer-toolbar-dock__button[title*="Zoom"]')
    .first()
    .click()
  await dragOnStage(page, page.locator('.montage-view__scroller'), 0, -80)
  await expect(page.locator('.montage-view__subtitle')).not.toContainText(/(?:缩放|Zoom)/)
  const montageTransforms = await montageImages.evaluateAll((images) =>
    images.map((image) => getComputedStyle(image).transform)
  )
  expect(new Set(montageTransforms).size).toBe(1)
  expect(montageTransforms[0]).not.toBe(initialMontageTransform)
  await resetView(page, false)
  await expect
    .poll(() => montageImages.first().evaluate((image) => getComputedStyle(image).transform))
    .toBe(initialMontageTransform)

  await page.locator('.montage-view__column-button', { hasText: '2' }).click()
  await expect.poll(() =>
    page.locator('.montage-view__grid').evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
    )
  ).toBe(2)

  const montageScroller = page.locator('.montage-view__scroller')
  await montageScroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight
    element.dispatchEvent(new Event('scroll'))
  })
  await expect(page.locator(`[data-slice-index="${SAMPLE_TOTAL_SLICES - 1}"]`)).toBeVisible()
  await expect
    .poll(() =>
      page
        .locator(`[data-slice-index="${SAMPLE_TOTAL_SLICES - 1}"] img`)
        .evaluate((image: HTMLImageElement) => image.naturalWidth)
    )
    .toBeGreaterThan(0)
  await expect.poll(() => requestedTiles.size).toBeGreaterThan(initiallyRequestedTileCount)
  await expect.poll(async () => Number(await montageScroller.getAttribute('data-rendered-row-start'))).toBeGreaterThan(0)

  await page.locator(`[data-slice-index="${SAMPLE_TOTAL_SLICES - 1}"]`).dblclick()
  await expect(page.locator('.montage-view')).toBeHidden({ timeout: 30_000 })
  await expectSlice(page, false, SAMPLE_TOTAL_SLICES)
})
