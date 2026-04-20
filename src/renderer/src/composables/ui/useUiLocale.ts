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
    settingsCopy: computed(() => currentMessages.value.settings),
    tagViewCopy: computed(() => currentMessages.value.tagView),
    workspaceExportCopy: computed(() => currentMessages.value.workspaceExport),
    t
  }
}
