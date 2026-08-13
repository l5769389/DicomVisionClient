import { describe, expect, it } from 'vitest'
import viewerWorkspaceSource from '../../workspace/ViewerWorkspace.vue?raw'
import workspaceExportSource from '../../../composables/workspace/export/useWorkspaceViewExport.ts?raw'
import mobileFusionSource from '../../../apps/mobile/MobilePetCtFusionViewport.vue?raw'
import montageSource from './MontageView.vue?raw'
import fusionSource from './PetCtFusionView.vue?raw'
import canvasStageSource from './ViewerCanvasStage.vue?raw'
import presentedImageSource from './ViewerPresentedImage.vue?raw'

const pixelPipelineFiles = [
  viewerWorkspaceSource,
  workspaceExportSource
]

const imagePresentationFiles = [
  presentedImageSource,
  canvasStageSource,
  montageSource,
  fusionSource,
  mobileFusionSource
]

describe('backend-only image rendering boundary', () => {
  it('does not compose or rewrite rendered pixels with browser canvas APIs', () => {
    const source = pixelPipelineFiles.join('\n')

    expect(source).not.toMatch(/createElement\s*\(\s*['"]canvas['"]\s*\)/)
    expect(source).not.toMatch(/\.(?:drawImage|getImageData|putImageData|toBlob)\s*\(/)
  })

  it('does not restore client fusion layers or CSS windowing hooks', () => {
    const source = imagePresentationFiles.join('\n')

    expect(source).not.toContain('imageLayers')
    expect(source).not.toContain('imageStyle')
    expect(source).not.toMatch(/(?:brightness|contrast)\s*\(/)
  })

  it('does not attach inline transforms, filters, or opacity to rendered image elements', () => {
    const source = imagePresentationFiles
      .filter((file) => file !== montageSource)
      .map((file) => file.slice(Math.max(0, file.indexOf('<template>'))))
      .join('\n')
    const imageElements = source.match(/<img\b[\s\S]*?\/>/g) ?? []

    expect(imageElements.length).toBeGreaterThan(0)
    imageElements.forEach((element) => {
      expect(element).not.toMatch(/:style\s*=/)
      expect(element).not.toMatch(/(?:filter|opacity|transform)\s*:/)
    })

    const montageTemplate = montageSource.slice(Math.max(0, montageSource.indexOf('<template>')))
    const montageImages = montageTemplate.match(/<img\b[\s\S]*?\/>/g) ?? []
    expect(montageImages).toHaveLength(1)
    expect(montageImages[0]).toContain(':style="montageImageStyle"')
    expect(montageSource).not.toMatch(/(?:brightness|contrast)\s*\(/)
    const montageImageStyle = montageSource.match(
      /const montageImageStyle = computed\([\s\S]*?\n\}\)\)/
    )?.[0] ?? ''
    const montageImageCss = montageSource.match(
      /\.montage-view__image\s*\{[\s\S]*?\}/
    )?.[0] ?? ''
    expect(montageImageStyle).toContain('transform:')
    expect(`${montageImageStyle}\n${montageImageCss}`).not.toMatch(/(?:filter|opacity)\s*:/)
  })
})
