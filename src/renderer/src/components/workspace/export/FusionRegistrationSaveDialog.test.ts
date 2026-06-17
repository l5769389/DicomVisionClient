import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FusionRegistrationSaveDialog from './FusionRegistrationSaveDialog.vue'

function mountDialog(overrides: Partial<InstanceType<typeof FusionRegistrationSaveDialog>['$props']> = {}) {
  return mount(FusionRegistrationSaveDialog, {
    props: {
      isOpen: true,
      mode: 'newDicom',
      sourceSeriesDescription: 'PET FDG SUV',
      seriesDescription: 'PET FDG SUV_Reg',
      outputDirectory: 'D:\\test\\petct-fusion-ready',
      ...overrides
    },
    global: {
      stubs: {
        AppIcon: true,
        Teleport: true
      }
    }
  })
}

describe('FusionRegistrationSaveDialog', () => {
  it('renders compact desktop save choices with source DICOM disabled and default path', async () => {
    const wrapper = mountDialog()

    const radios = wrapper.findAll<HTMLInputElement>('input[type="radio"]')
    expect(radios[0].element.disabled).toBe(true)
    expect(wrapper.text()).toContain('写入原始 DICOM')
    expect(wrapper.text()).toContain('当前安全策略不覆盖源文件')
    expect(wrapper.find<HTMLInputElement>('[data-testid="series-description-input"]').element.value).toBe('PET FDG SUV_Reg')
    expect(wrapper.find<HTMLInputElement>('[data-testid="output-directory-input"]').element.value).toBe('D:\\test\\petct-fusion-ready')

    await wrapper.find('[data-testid="browse-button"]').trigger('click')
    await wrapper.find('[data-testid="save-button"]').trigger('click')

    expect(wrapper.emitted('browse')).toHaveLength(1)
    expect(wrapper.emitted('save')).toHaveLength(1)
  })

  it('hides path controls and uses download copy in web mode', async () => {
    const wrapper = mountDialog({
      isWeb: true,
      outputDirectory: ''
    })

    expect(wrapper.find('[data-testid="output-directory-input"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="browse-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="open-folder-button"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('浏览器下载')
    await wrapper.find('[data-testid="save-button"]').trigger('click')
    expect(wrapper.emitted('save')).toHaveLength(1)
  })

  it('emits mode updates and enables opening the saved folder after success', async () => {
    const wrapper = mountDialog({
      canOpenFolder: true,
      savedDirectory: 'D:\\test\\petct-fusion-ready\\PET FDG SUV_Reg'
    })

    await wrapper.find<HTMLInputElement>('[data-testid="br-radio"]').setValue(true)
    await wrapper.find('[data-testid="open-folder-button"]').trigger('click')

    expect(wrapper.emitted('update:mode')).toEqual([['br']])
    expect(wrapper.emitted('openFolder')).toHaveLength(1)
    expect(wrapper.text()).toContain('已保存到 D:\\test\\petct-fusion-ready\\PET FDG SUV_Reg')
  })
})
