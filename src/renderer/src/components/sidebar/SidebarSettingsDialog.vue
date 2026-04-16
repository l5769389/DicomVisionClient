<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '../AppIcon.vue'
import { PSEUDOCOLOR_PRESET_OPTIONS } from '../../constants/pseudocolor'
import { useUiLocale } from '../../composables/ui/useUiLocale'
import { type AppLocale, useUiPreferences } from '../../composables/ui/useUiPreferences'

defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

type SettingsSection = 'shortcuts' | 'display' | 'crosshair' | 'language'

interface ShortcutItem {
  id: string
  action: string
  description: string
  combo: string
}

const { locale } = useUiLocale()
const {
  locale: globalLocale,
  setLocale,
  addCustomWindowPreset,
  customWindowPresets,
  getWindowPresetLabel,
  removeCustomWindowPreset,
  systemWindowPresets,
  windowPresets
} = useUiPreferences()

const activeSection = ref<SettingsSection>('shortcuts')
const accentColor = ref('#66d0ff')
const surfaceTint = ref('#ff8a5b')
const crosshairColor = ref('#ffd166')
const crosshairThickness = ref(2)
const selectedWindowPresetId = ref(systemWindowPresets[0]?.id ?? 'lung')
const selectedPseudocolorKey = ref('bw')
const customPresetZhName = ref('')
const customPresetEnName = ref('')
const customPresetWw = ref('400')
const customPresetWl = ref('40')
const customPresetAccent = ref('linear-gradient(135deg,#9ad7ff,#ffffff)')

const copy = computed(() =>
  locale.value === 'zh-CN'
    ? {
        title: '工作区设置',
        subtitle: '这里可以切换界面语言，并设计后续会接入真实业务的窗模板预设与自定义配置。',
        sectionLabel: 'Section',
        reset: '恢复默认',
        applyDraft: '应用设计稿',
        draft: 'Draft',
        livePreview: '实时预览',
        quickActions: '快捷键',
        quickActionsSub: '工具切换与效率操作',
        display: '显示',
        displaySub: '窗模板与界面颜色',
        crosshair: '十字线',
        crosshairSub: '颜色与视觉强度',
        language: '语言',
        languageSub: '界面中英文切换',
        shortcutsTitle: '快捷键矩阵',
        shortcutsDesc: '先展示推荐键位分组，后续可直接替换成可编辑 keymap。',
        editable: 'Editable Layout',
        navGroup: '视图导航',
        measureGroup: '标注测量',
        workspaceGroup: '工作区',
        modify: '修改',
        items: '项',
        displayTitle: '窗模板',
        displayDesc: '按“系统预设 + 我的预设”组织，后续可直接挂到窗宽窗位快捷选择。',
        systemPresets: '系统预设',
        customPresets: '我的预设',
        builtIn: '内置',
        custom: '自定义',
        emptyCustom: '还没有自定义窗模板',
        emptyCustomDesc: '在右侧填写名称和 WW/WL 后添加，后续可扩展为持久化、排序和共享。',
        addCustom: '新增自定义窗模板',
        zhName: '中文名称',
        enName: '英文名称',
        ww: '窗宽 WW',
        wl: '窗位 WL',
        accent: '预览色带',
        addTemplate: '添加模板',
        removeTemplate: '删除选中模板',
        interfaceColor: '界面颜色',
        primaryAccent: '主高亮色',
        warmAccent: '暖色辅助',
        pseudocolor: '默认伪彩',
        crosshairTitle: '十字线样式',
        crosshairColor: '颜色',
        crosshairWidth: '线宽',
        thin: '精细',
        bold: '强调',
        crosshairNote: '后续建议继续加入虚线样式、中心点大小、以及 MPR 三视图分视口配色。',
        visualPreview: '视觉预览',
        languageTitle: '界面语言',
        zhCn: '简体中文',
        zhCnDesc: '适配本地阅片工作流与中文术语。',
        enUs: 'English',
        enUsDesc: '适合英文术语、培训和演示场景。',
        copyPreview: '文案预览',
        footer: '当前为前端设计稿。语言切换已经接入部分界面文案，窗模板支持系统预设与自定义预设的前端逻辑。'
      }
    : {
        title: 'Workspace Settings',
        subtitle: 'Switch the UI language here and shape the future window template workflow with built-in and custom presets.',
        sectionLabel: 'Section',
        reset: 'Reset',
        applyDraft: 'Apply Draft',
        draft: 'Draft',
        livePreview: 'Live Preview',
        quickActions: 'Shortcuts',
        quickActionsSub: 'Tool switching and efficiency actions',
        display: 'Display',
        displaySub: 'Window templates and interface color',
        crosshair: 'Crosshair',
        crosshairSub: 'Color and visual weight',
        language: 'Language',
        languageSub: 'Chinese and English UI',
        shortcutsTitle: 'Shortcut Matrix',
        shortcutsDesc: 'This is the recommended grouping for now and can later become an editable keymap.',
        editable: 'Editable Layout',
        navGroup: 'Navigation',
        measureGroup: 'Measurement',
        workspaceGroup: 'Workspace',
        modify: 'Edit',
        items: 'items',
        displayTitle: 'Window Templates',
        displayDesc: 'Structured as built-in presets plus custom presets so it can later plug into WW/WL quick selection.',
        systemPresets: 'Built-in Presets',
        customPresets: 'My Presets',
        builtIn: 'Built-in',
        custom: 'Custom',
        emptyCustom: 'No custom window templates yet',
        emptyCustomDesc: 'Add one from the form on the right. It can later expand into persistence, sorting, and sharing.',
        addCustom: 'Add Custom Window Template',
        zhName: 'Chinese Label',
        enName: 'English Label',
        ww: 'Window Width WW',
        wl: 'Window Level WL',
        accent: 'Preview Accent',
        addTemplate: 'Add Template',
        removeTemplate: 'Remove Selected',
        interfaceColor: 'Interface Color',
        primaryAccent: 'Primary Accent',
        warmAccent: 'Warm Accent',
        pseudocolor: 'Default Pseudocolor',
        crosshairTitle: 'Crosshair Style',
        crosshairColor: 'Color',
        crosshairWidth: 'Thickness',
        thin: 'Thin',
        bold: 'Bold',
        crosshairNote: 'Later this can add dashed style, center marker size, and per-viewport colors for the MPR views.',
        visualPreview: 'Visual Preview',
        languageTitle: 'Interface Language',
        zhCn: 'Simplified Chinese',
        zhCnDesc: 'Optimized for local Chinese diagnostic workflows and terminology.',
        enUs: 'English',
        enUsDesc: 'Suitable for English terminology, demos, and training.',
        copyPreview: 'Copy Preview',
        footer: 'This is still a front-end draft. Language switching is already wired into visible UI copy, and window templates now support built-in and custom front-end logic.'
      }
)

const sections = computed(() => [
  { key: 'shortcuts' as const, title: copy.value.quickActions, subtitle: copy.value.quickActionsSub, icon: 'keyboard' },
  { key: 'display' as const, title: copy.value.display, subtitle: copy.value.displaySub, icon: 'contrast' },
  { key: 'crosshair' as const, title: copy.value.crosshair, subtitle: copy.value.crosshairSub, icon: 'crosshair' },
  { key: 'language' as const, title: copy.value.language, subtitle: copy.value.languageSub, icon: 'language' }
])

const shortcutGroups = computed<Array<{ title: string; items: ShortcutItem[] }>>(() => {
  if (locale.value === 'zh-CN') {
    return [
      {
        title: copy.value.navGroup,
        items: [
          { id: 'scroll-slice', action: '翻页', description: '鼠标滚轮上下翻动当前序列。', combo: 'Wheel' },
          { id: 'pan-view', action: '平移', description: '按住后拖动当前画面。', combo: 'Space + Drag' },
          { id: 'zoom-view', action: '缩放', description: '快速放大或缩小当前视图。', combo: 'Ctrl + Wheel' }
        ]
      },
      {
        title: copy.value.measureGroup,
        items: [
          { id: 'line-measure', action: '直线测量', description: '进入线段测量工具。', combo: 'L' },
          { id: 'rect-measure', action: '矩形 ROI', description: '进入矩形 ROI 工具。', combo: 'R' },
          { id: 'copy-measurement', action: '复制测量', description: '复制当前选中的测量项。', combo: 'Ctrl + C' }
        ]
      },
      {
        title: copy.value.workspaceGroup,
        items: [
          { id: 'quick-preview', action: '快速浏览', description: '打开当前序列的 Stack 视图。', combo: 'Enter' },
          { id: 'close-tab', action: '关闭标签页', description: '关闭当前活动标签页。', combo: 'Ctrl + W' },
          { id: 'toggle-sidebar', action: '收起侧栏', description: '切换左侧面板显隐。', combo: 'Tab' }
        ]
      }
    ]
  }

  return [
    {
      title: copy.value.navGroup,
      items: [
        { id: 'scroll-slice', action: 'Scroll Slice', description: 'Use the wheel to move through the current series.', combo: 'Wheel' },
        { id: 'pan-view', action: 'Pan View', description: 'Hold and drag to move the active image.', combo: 'Space + Drag' },
        { id: 'zoom-view', action: 'Zoom View', description: 'Quickly zoom the active viewport.', combo: 'Ctrl + Wheel' }
      ]
    },
    {
      title: copy.value.measureGroup,
      items: [
        { id: 'line-measure', action: 'Line Measure', description: 'Enter the line measurement tool.', combo: 'L' },
        { id: 'rect-measure', action: 'Rect ROI', description: 'Enter the rectangle ROI tool.', combo: 'R' },
        { id: 'copy-measurement', action: 'Copy Measurement', description: 'Copy the selected measurement item.', combo: 'Ctrl + C' }
      ]
    },
    {
      title: copy.value.workspaceGroup,
      items: [
        { id: 'quick-preview', action: 'Quick Preview', description: 'Open the current series in Stack view.', combo: 'Enter' },
        { id: 'close-tab', action: 'Close Tab', description: 'Close the active tab.', combo: 'Ctrl + W' },
        { id: 'toggle-sidebar', action: 'Toggle Sidebar', description: 'Show or hide the left panel.', combo: 'Tab' }
      ]
    }
  ]
})

const currentSectionTitle = computed(() => sections.value.find((item) => item.key === activeSection.value)?.title ?? copy.value.title)
const currentSectionSubtitle = computed(() => sections.value.find((item) => item.key === activeSection.value)?.subtitle ?? copy.value.subtitle)
const selectedWindowPreset = computed(() => windowPresets.value.find((preset) => preset.id === selectedWindowPresetId.value) ?? windowPresets.value[0] ?? null)
const selectedPseudocolor = computed(() => PSEUDOCOLOR_PRESET_OPTIONS.find((option) => option.key === selectedPseudocolorKey.value) ?? PSEUDOCOLOR_PRESET_OPTIONS[1])
const selectedWindowPresetName = computed(() => (selectedWindowPreset.value ? getWindowPresetLabel(selectedWindowPreset.value) : ''))
const canRemoveSelectedCustomPreset = computed(() => selectedWindowPreset.value?.source === 'custom')

function resetMockSettings(): void {
  activeSection.value = 'shortcuts'
  accentColor.value = '#66d0ff'
  surfaceTint.value = '#ff8a5b'
  crosshairColor.value = '#ffd166'
  crosshairThickness.value = 2
  selectedWindowPresetId.value = systemWindowPresets[0]?.id ?? 'lung'
  selectedPseudocolorKey.value = 'bw'
}

function handleLocaleChange(nextLocale: AppLocale): void {
  setLocale(nextLocale)
}

function handleAddCustomWindowPreset(): void {
  const nextId = addCustomWindowPreset({
    zhName: customPresetZhName.value,
    enName: customPresetEnName.value,
    ww: Number.parseFloat(customPresetWw.value),
    wl: Number.parseFloat(customPresetWl.value),
    accent: customPresetAccent.value
  })

  selectedWindowPresetId.value = nextId
  customPresetZhName.value = ''
  customPresetEnName.value = ''
  customPresetWw.value = '400'
  customPresetWl.value = '40'
  customPresetAccent.value = 'linear-gradient(135deg,#9ad7ff,#ffffff)'
}

function handleRemoveSelectedCustomWindowPreset(): void {
  if (!selectedWindowPreset.value || selectedWindowPreset.value.source !== 'custom') {
    return
  }

  removeCustomWindowPreset(selectedWindowPreset.value.id)
  selectedWindowPresetId.value = systemWindowPresets[0]?.id ?? 'lung'
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[1300] flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(68,153,224,0.16),transparent_38%),rgba(3,8,15,0.42)] px-4 py-6 backdrop-blur-[8px]"
      @click.self="emit('close')"
    >
      <div class="relative flex h-[min(92vh,860px)] w-full max-w-[1180px] flex-col overflow-hidden rounded-[34px] border border-sky-200/18 bg-[linear-gradient(180deg,rgba(8,18,31,0.96),rgba(6,13,24,0.99))] shadow-[0_36px_96px_rgba(0,0,0,0.5)]">
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(102,204,255,0.14),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,148,89,0.12),transparent_22%)]"></div>
        <div class="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>

        <div class="relative flex items-start justify-between gap-4 border-b border-white/8 px-7 py-6">
          <div class="min-w-0">
            <div class="flex items-center gap-3">
              <div class="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-300/16 bg-sky-300/10 text-sky-100">
                <AppIcon name="settings" :size="20" />
              </div>
              <div>
                <div class="text-xl font-semibold tracking-[0.04em] text-white">{{ copy.title }}</div>
                <div class="mt-1 text-sm text-slate-400">{{ copy.subtitle }}</div>
              </div>
            </div>
          </div>
          <button type="button" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/8 bg-white/6 text-slate-200 transition hover:bg-white/12" :aria-label="copy.title" @click="emit('close')">
            <AppIcon name="close" :size="16" />
          </button>
        </div>

        <div class="relative grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside class="settings-nav-scroll min-h-0 overflow-auto border-b border-white/8 bg-[linear-gradient(180deg,rgba(10,21,36,0.88),rgba(7,15,28,0.96))] px-5 py-5 lg:border-b-0 lg:border-r">
            <div class="space-y-3">
              <button
                v-for="section in sections"
                :key="section.key"
                type="button"
                class="group flex w-full items-start gap-3 rounded-[22px] border px-4 py-4 text-left transition duration-150"
                :class="section.key === activeSection ? 'border-sky-300/28 bg-[linear-gradient(135deg,rgba(41,121,199,0.26),rgba(255,138,91,0.12))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_16px_28px_rgba(0,0,0,0.16)]' : 'border-white/8 bg-white/[0.03] hover:border-sky-300/18 hover:bg-white/[0.05]'"
                @click="activeSection = section.key"
              >
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition" :class="section.key === activeSection ? 'border-sky-300/22 bg-sky-300/12 text-sky-100' : 'border-white/8 bg-black/15 text-slate-300 group-hover:text-white'">
                  <AppIcon :name="section.icon" :size="18" />
                </div>
                <div class="min-w-0">
                  <div class="text-sm font-semibold" :class="section.key === activeSection ? 'text-white' : 'text-slate-100'">{{ section.title }}</div>
                  <div class="mt-1 text-xs leading-5" :class="section.key === activeSection ? 'text-sky-50/70' : 'text-slate-400'">{{ section.subtitle }}</div>
                </div>
              </button>
            </div>

            <div class="mt-5 rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400/72">{{ copy.livePreview }}</div>
                  <div class="mt-2 text-sm font-medium text-white">{{ selectedWindowPresetName }} · {{ globalLocale === 'zh-CN' ? copy.zhCn : copy.enUs }}</div>
                </div>
                <span class="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[10px] font-semibold text-slate-300">{{ copy.draft }}</span>
              </div>
              <div class="mt-4 rounded-[20px] border border-white/8 bg-[#050a12] p-3">
                <div class="relative h-28 overflow-hidden rounded-[16px] border border-white/6 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_42%),linear-gradient(180deg,#09111d,#040910)]">
                  <div class="absolute inset-x-0 top-0 h-1.5" :style="{ background: selectedPseudocolor.gradient }"></div>
                  <div class="absolute inset-y-0 left-1/2 -translate-x-1/2" :style="{ width: `${crosshairThickness}px`, backgroundColor: crosshairColor, boxShadow: `0 0 12px ${crosshairColor}66` }"></div>
                  <div class="absolute inset-x-0 top-1/2 -translate-y-1/2" :style="{ height: `${crosshairThickness}px`, backgroundColor: crosshairColor, boxShadow: `0 0 12px ${crosshairColor}66` }"></div>
                  <div class="absolute left-3 top-3 rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-semibold text-slate-200">WW {{ selectedWindowPreset?.ww ?? '-' }}</div>
                  <div class="absolute right-3 top-3 rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-semibold text-slate-200">WL {{ selectedWindowPreset?.wl ?? '-' }}</div>
                  <div class="absolute bottom-3 left-3 flex items-center gap-2">
                    <span class="h-3 w-3 rounded-full" :style="{ backgroundColor: accentColor }"></span>
                    <span class="h-3 w-3 rounded-full" :style="{ backgroundColor: surfaceTint }"></span>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <section class="min-h-0 overflow-hidden px-6 py-5 lg:px-7">
            <div class="mb-5 flex items-end justify-between gap-4">
              <div>
                <div class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400/72">{{ copy.sectionLabel }}</div>
                <div class="mt-2 text-2xl font-semibold tracking-[0.04em] text-white">{{ currentSectionTitle }}</div>
                <div class="mt-1 text-sm text-slate-400">{{ currentSectionSubtitle }}</div>
              </div>
              <div class="hidden items-center gap-2 md:flex">
                <button type="button" class="rounded-2xl border border-white/8 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10" @click="resetMockSettings">{{ copy.reset }}</button>
                <button type="button" class="rounded-2xl border border-sky-300/18 bg-[linear-gradient(135deg,rgba(53,135,210,0.3),rgba(255,138,91,0.18))] px-4 py-2 text-sm font-semibold text-white transition hover:border-sky-300/28">{{ copy.applyDraft }}</button>
              </div>
            </div>

            <div class="settings-content-scroll h-full min-h-0 overflow-auto pr-1">
              <div v-if="activeSection === 'shortcuts'" class="space-y-5">
                <div class="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5">
                  <div class="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div class="text-lg font-semibold text-white">{{ copy.shortcutsTitle }}</div>
                      <div class="mt-1 text-sm text-slate-400">{{ copy.shortcutsDesc }}</div>
                    </div>
                    <span class="rounded-full border border-sky-300/12 bg-sky-300/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-100/82">{{ copy.editable }}</span>
                  </div>

                  <div class="space-y-4">
                    <div v-for="group in shortcutGroups" :key="group.title" class="rounded-[24px] border border-white/8 bg-black/14 p-4">
                      <div class="mb-3 flex items-center justify-between gap-2">
                        <div class="text-sm font-semibold text-white">{{ group.title }}</div>
                        <span class="rounded-full border border-white/8 bg-white/6 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">{{ group.items.length }} {{ copy.items }}</span>
                      </div>
                      <div class="space-y-2">
                        <div v-for="item in group.items" :key="item.id" class="grid gap-3 rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                          <div class="min-w-0">
                            <div class="text-sm font-medium text-white">{{ item.action }}</div>
                            <div class="mt-1 text-xs leading-5 text-slate-400">{{ item.description }}</div>
                          </div>
                          <div class="flex items-center gap-2">
                            <span class="rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 font-mono text-[12px] font-semibold tracking-[0.06em] text-sky-100">{{ item.combo }}</span>
                            <button type="button" class="rounded-xl border border-white/8 bg-white/6 px-3 py-2 text-[11px] font-medium text-slate-200 transition hover:bg-white/10">{{ copy.modify }}</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else-if="activeSection === 'display'" class="space-y-5">
                <div class="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5">
                  <div class="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div class="text-lg font-semibold text-white">{{ copy.displayTitle }}</div>
                      <div class="mt-1 text-sm text-slate-400">{{ copy.displayDesc }}</div>
                    </div>
                    <span class="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">{{ selectedWindowPreset?.source === 'custom' ? copy.custom : copy.builtIn }}</span>
                  </div>

                  <div class="grid gap-5 xl:grid-cols-[minmax(0,1.02fr)_minmax(340px,0.98fr)]">
                    <div class="space-y-5">
                      <div class="rounded-[24px] border border-white/8 bg-black/14 p-4">
                        <div class="mb-3 text-sm font-semibold text-white">{{ copy.systemPresets }}</div>
                        <div class="grid gap-3 md:grid-cols-2">
                          <button
                            v-for="preset in systemWindowPresets"
                            :key="preset.id"
                            type="button"
                            class="rounded-[22px] border p-4 text-left transition duration-150"
                            :class="selectedWindowPresetId === preset.id ? 'border-sky-300/24 bg-[linear-gradient(135deg,rgba(32,104,174,0.24),rgba(255,138,91,0.12))]' : 'border-white/8 bg-white/[0.03] hover:border-sky-300/16 hover:bg-white/[0.05]'"
                            @click="selectedWindowPresetId = preset.id"
                          >
                            <div class="flex items-start justify-between gap-3">
                              <div>
                                <div class="text-sm font-semibold text-white">{{ getWindowPresetLabel(preset) }}</div>
                                <div class="mt-1 text-xs text-slate-400">WW {{ preset.ww }} · WL {{ preset.wl }}</div>
                              </div>
                              <span class="h-8 w-8 shrink-0 rounded-2xl border border-white/10" :style="{ background: preset.accent }"></span>
                            </div>
                          </button>
                        </div>
                      </div>

                      <div class="rounded-[24px] border border-white/8 bg-black/14 p-4">
                        <div class="mb-3 flex items-center justify-between gap-3">
                          <div class="text-sm font-semibold text-white">{{ copy.customPresets }}</div>
                          <span class="rounded-full border border-white/8 bg-white/6 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">{{ customWindowPresets.length }}</span>
                        </div>
                        <div v-if="customWindowPresets.length" class="space-y-2">
                          <button
                            v-for="preset in customWindowPresets"
                            :key="preset.id"
                            type="button"
                            class="flex w-full items-center justify-between gap-3 rounded-[18px] border px-4 py-3 text-left transition duration-150"
                            :class="selectedWindowPresetId === preset.id ? 'border-sky-300/24 bg-[linear-gradient(135deg,rgba(32,104,174,0.24),rgba(255,138,91,0.12))]' : 'border-white/8 bg-white/[0.03] hover:border-sky-300/16 hover:bg-white/[0.05]'"
                            @click="selectedWindowPresetId = preset.id"
                          >
                            <div class="min-w-0">
                              <div class="truncate text-sm font-semibold text-white">{{ getWindowPresetLabel(preset) }}</div>
                              <div class="mt-1 text-xs text-slate-400">WW {{ preset.ww }} · WL {{ preset.wl }}</div>
                            </div>
                            <span class="h-8 w-8 shrink-0 rounded-2xl border border-white/10" :style="{ background: preset.accent }"></span>
                          </button>
                        </div>
                        <div v-else class="rounded-[20px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-4 text-xs leading-6 text-slate-400">
                          <div class="font-medium text-slate-200">{{ copy.emptyCustom }}</div>
                          <div class="mt-1">{{ copy.emptyCustomDesc }}</div>
                        </div>
                      </div>
                    </div>

                    <div class="space-y-5">
                      <div class="rounded-[24px] border border-white/8 bg-black/14 p-4">
                        <div class="mb-3 text-sm font-semibold text-white">{{ copy.addCustom }}</div>
                        <div class="grid gap-3 md:grid-cols-2">
                          <label class="block">
                            <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400/76">{{ copy.zhName }}</span>
                            <input v-model="customPresetZhName" type="text" class="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-300/24" :placeholder="copy.zhName" />
                          </label>
                          <label class="block">
                            <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400/76">{{ copy.enName }}</span>
                            <input v-model="customPresetEnName" type="text" class="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-300/24" :placeholder="copy.enName" />
                          </label>
                          <label class="block">
                            <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400/76">{{ copy.ww }}</span>
                            <input v-model="customPresetWw" type="number" class="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-300/24" />
                          </label>
                          <label class="block">
                            <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400/76">{{ copy.wl }}</span>
                            <input v-model="customPresetWl" type="number" class="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-300/24" />
                          </label>
                        </div>
                        <label class="mt-3 block">
                          <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400/76">{{ copy.accent }}</span>
                          <input v-model="customPresetAccent" type="text" class="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-300/24" />
                        </label>

                        <div class="mt-4 flex flex-wrap gap-2">
                          <button type="button" class="rounded-2xl border border-sky-300/18 bg-[linear-gradient(135deg,rgba(53,135,210,0.3),rgba(255,138,91,0.18))] px-4 py-2 text-sm font-semibold text-white transition hover:border-sky-300/28" @click="handleAddCustomWindowPreset">{{ copy.addTemplate }}</button>
                          <button type="button" class="rounded-2xl border border-white/8 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50" :disabled="!canRemoveSelectedCustomPreset" @click="handleRemoveSelectedCustomWindowPreset">{{ copy.removeTemplate }}</button>
                        </div>
                      </div>

                      <div class="rounded-[24px] border border-white/8 bg-black/14 p-4">
                        <div class="mb-3 text-sm font-semibold text-white">{{ copy.interfaceColor }}</div>
                        <div class="space-y-3">
                          <label class="flex items-center gap-3 rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-3">
                            <input v-model="accentColor" type="color" class="h-10 w-12 cursor-pointer rounded-xl border border-white/10 bg-transparent" />
                            <div>
                              <div class="text-sm font-medium text-white">{{ copy.primaryAccent }}</div>
                              <div class="mt-1 text-xs text-slate-400">{{ accentColor }}</div>
                            </div>
                          </label>
                          <label class="flex items-center gap-3 rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-3">
                            <input v-model="surfaceTint" type="color" class="h-10 w-12 cursor-pointer rounded-xl border border-white/10 bg-transparent" />
                            <div>
                              <div class="text-sm font-medium text-white">{{ copy.warmAccent }}</div>
                              <div class="mt-1 text-xs text-slate-400">{{ surfaceTint }}</div>
                            </div>
                          </label>
                        </div>
                      </div>

                      <div class="rounded-[24px] border border-white/8 bg-black/14 p-4">
                        <div class="mb-3 text-sm font-semibold text-white">{{ copy.pseudocolor }}</div>
                        <div class="space-y-3">
                          <button
                            v-for="option in PSEUDOCOLOR_PRESET_OPTIONS"
                            :key="option.key"
                            type="button"
                            class="flex w-full items-center gap-3 rounded-[18px] border px-3 py-3 text-left transition duration-150"
                            :class="selectedPseudocolorKey === option.key ? 'border-sky-300/22 bg-white/[0.06]' : 'border-white/8 bg-white/[0.03] hover:border-sky-300/14 hover:bg-white/[0.04]'"
                            @click="selectedPseudocolorKey = option.key"
                          >
                            <span class="h-9 flex-1 rounded-2xl border border-white/10" :style="{ background: option.gradient }"></span>
                            <span class="w-24 shrink-0 text-sm font-medium text-white">{{ option.label }}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else-if="activeSection === 'crosshair'" class="space-y-5">
                <div class="grid gap-5 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
                  <div class="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5">
                    <div class="mb-4 flex items-center gap-2 text-slate-100">
                      <AppIcon name="crosshair" :size="18" />
                      <span class="text-lg font-semibold">{{ copy.crosshairTitle }}</span>
                    </div>
                    <div class="space-y-4">
                      <label class="block">
                        <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400/76">{{ copy.crosshairColor }}</span>
                        <div class="flex items-center gap-3 rounded-[18px] border border-white/8 bg-black/16 px-3 py-3">
                          <input v-model="crosshairColor" type="color" class="h-10 w-12 cursor-pointer rounded-xl border border-white/10 bg-transparent" />
                          <div class="min-w-0">
                            <div class="text-sm font-medium text-white">{{ crosshairColor }}</div>
                          </div>
                        </div>
                      </label>

                      <label class="block">
                        <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400/76">{{ copy.crosshairWidth }}</span>
                        <div class="rounded-[18px] border border-white/8 bg-black/16 px-4 py-4">
                          <input v-model="crosshairThickness" type="range" min="1" max="4" step="1" class="w-full accent-sky-300" />
                          <div class="mt-2 flex items-center justify-between text-xs text-slate-400">
                            <span>{{ copy.thin }}</span>
                            <span>{{ crosshairThickness }} px</span>
                            <span>{{ copy.bold }}</span>
                          </div>
                        </div>
                      </label>

                      <div class="rounded-[20px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-4 text-xs leading-6 text-slate-400">
                        {{ copy.crosshairNote }}
                      </div>
                    </div>
                  </div>

                  <div class="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5">
                    <div class="mb-4 flex items-center gap-2 text-slate-100">
                      <AppIcon name="palette" :size="18" />
                      <span class="text-lg font-semibold">{{ copy.visualPreview }}</span>
                    </div>
                    <div class="rounded-[24px] border border-white/8 bg-[#02060d] p-4">
                      <div class="relative h-[320px] overflow-hidden rounded-[18px] border border-white/6 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_36%),linear-gradient(180deg,#0a111d,#02060d)]">
                        <div class="absolute left-[14%] top-[18%] h-10 w-10 rounded-full border border-white/6 bg-white/[0.03] blur-[1px]"></div>
                        <div class="absolute right-[12%] top-[24%] h-16 w-16 rounded-full border border-white/5 bg-white/[0.02] blur-[2px]"></div>
                        <div class="absolute bottom-[14%] left-[22%] h-12 w-12 rounded-full border border-white/4 bg-white/[0.02] blur-[1px]"></div>
                        <div class="absolute inset-y-0 left-1/2 -translate-x-1/2" :style="{ width: `${crosshairThickness}px`, backgroundColor: crosshairColor, boxShadow: `0 0 14px ${crosshairColor}88` }"></div>
                        <div class="absolute inset-x-0 top-1/2 -translate-y-1/2" :style="{ height: `${crosshairThickness}px`, backgroundColor: crosshairColor, boxShadow: `0 0 14px ${crosshairColor}88` }"></div>
                        <div class="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/12 bg-black/45"></div>
                        <div class="absolute bottom-4 right-4 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-slate-300">{{ crosshairThickness }} px · {{ crosshairColor }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else class="space-y-5">
                <div class="grid gap-5 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
                  <div class="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5">
                    <div class="mb-4 flex items-center gap-2 text-slate-100">
                      <AppIcon name="language" :size="18" />
                      <span class="text-lg font-semibold">{{ copy.languageTitle }}</span>
                    </div>
                    <div class="grid gap-3">
                      <button
                        type="button"
                        class="rounded-[22px] border px-4 py-4 text-left transition duration-150"
                        :class="globalLocale === 'zh-CN' ? 'border-sky-300/24 bg-[linear-gradient(135deg,rgba(32,104,174,0.24),rgba(255,138,91,0.12))]' : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.05]'"
                        @click="handleLocaleChange('zh-CN')"
                      >
                        <div class="flex items-center justify-between gap-3">
                          <div>
                            <div class="text-sm font-semibold text-white">{{ copy.zhCn }}</div>
                            <div class="mt-1 text-xs text-slate-400">{{ copy.zhCnDesc }}</div>
                          </div>
                          <span class="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[10px] font-semibold text-slate-200">zh-CN</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        class="rounded-[22px] border px-4 py-4 text-left transition duration-150"
                        :class="globalLocale === 'en-US' ? 'border-sky-300/24 bg-[linear-gradient(135deg,rgba(32,104,174,0.24),rgba(255,138,91,0.12))]' : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.05]'"
                        @click="handleLocaleChange('en-US')"
                      >
                        <div class="flex items-center justify-between gap-3">
                          <div>
                            <div class="text-sm font-semibold text-white">{{ copy.enUs }}</div>
                            <div class="mt-1 text-xs text-slate-400">{{ copy.enUsDesc }}</div>
                          </div>
                          <span class="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[10px] font-semibold text-slate-200">en-US</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div class="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5">
                    <div class="mb-4 flex items-center gap-2 text-slate-100">
                      <AppIcon name="menu" :size="18" />
                      <span class="text-lg font-semibold">{{ copy.copyPreview }}</span>
                    </div>
                    <div class="grid gap-4 md:grid-cols-2">
                      <div class="rounded-[22px] border border-white/8 bg-black/16 p-4">
                        <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400/72">Sidebar</div>
                        <div class="mt-3 rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
                          <div class="text-sm font-semibold text-white">{{ locale === 'zh-CN' ? '序列列表' : 'Series List' }}</div>
                          <div class="mt-2 text-xs leading-5 text-slate-400">{{ locale === 'zh-CN' ? '当前已加载的可用 DICOM 序列' : 'Loaded DICOM series available in the workspace' }}</div>
                        </div>
                      </div>
                      <div class="rounded-[22px] border border-white/8 bg-black/16 p-4">
                        <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400/72">Workspace</div>
                        <div class="mt-3 rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
                          <div class="text-sm font-semibold text-white">{{ locale === 'zh-CN' ? '打开一个视图' : 'Open A View' }}</div>
                          <div class="mt-2 text-xs leading-5 text-slate-400">{{ locale === 'zh-CN' ? '点击“快速浏览 / 3D / MPR”打开当前序列对应的视图。' : 'Use Quick Preview / 3D / MPR to open a view for the current series.' }}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div class="relative flex flex-col gap-3 border-t border-white/8 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div class="text-[11px] leading-5 text-slate-500">{{ copy.footer }}</div>
          <div class="flex items-center gap-2 md:hidden">
            <button type="button" class="rounded-2xl border border-white/8 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10" @click="resetMockSettings">{{ copy.reset }}</button>
            <button type="button" class="rounded-2xl border border-sky-300/18 bg-[linear-gradient(135deg,rgba(53,135,210,0.3),rgba(255,138,91,0.18))] px-4 py-2 text-sm font-semibold text-white transition hover:border-sky-300/28">{{ copy.applyDraft }}</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.settings-nav-scroll,
.settings-content-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(102, 208, 255, 0.3) rgba(255, 255, 255, 0.04);
}

.settings-nav-scroll::-webkit-scrollbar,
.settings-content-scroll::-webkit-scrollbar {
  width: 9px;
}

.settings-nav-scroll::-webkit-scrollbar-track,
.settings-content-scroll::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 999px;
}

.settings-nav-scroll::-webkit-scrollbar-thumb,
.settings-content-scroll::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(102, 208, 255, 0.42), rgba(255, 138, 91, 0.24));
  border-radius: 999px;
}
</style>
