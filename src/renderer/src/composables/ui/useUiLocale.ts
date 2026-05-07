import { computed } from 'vue'
import { useUiPreferences } from './useUiPreferences'
import { type CommonMessageKey, uiMessages } from './uiMessages'

export function useUiLocale() {
  const { locale } = useUiPreferences()

  const currentMessages = computed(() => uiMessages[locale.value])

  function t(key: CommonMessageKey): string {
    return currentMessages.value.common[key]
  }

  return {
    locale,
    mprProjectionCopy: computed(() => currentMessages.value.mprProjection),
    overlayCopy: computed(() => currentMessages.value.overlay),
    settingsCopy: computed(() => currentMessages.value.settings),
    tagViewCopy: computed(() => currentMessages.value.tagView),
    toolbarCopy: computed(() => currentMessages.value.toolbar),
    viewerCopy: computed(() => currentMessages.value.viewer),
    volumeCopy: computed(() => currentMessages.value.volume),
    workspaceExportCopy: computed(() => currentMessages.value.workspaceExport),
    workspaceStatusCopy: computed(() => currentMessages.value.workspaceStatus),
    t
  }
}
