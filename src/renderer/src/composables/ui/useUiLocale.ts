import { computed } from 'vue'
import { useUiPreferences } from './useUiPreferences'

const messages = {
  'zh-CN': {
    connection: '连接',
    openSettings: '打开设置',
    collapseSidebar: '收起侧栏',
    expandSidebar: '展开侧栏',
    quickActions: '快速操作',
    loadSample: '加载示例',
    inputPath: '输入路径',
    loadFolder: '加载文件夹',
    quickPreview: '快速浏览',
    webSampleHint: 'Web 版本当前会直接加载服务端本地配置的 sample DICOM 目录。',
    webPathHint: 'Web 版本通过远程后端工作，加载序列时请输入服务端可访问的目录路径。',
    seriesList: '序列列表',
    seriesListSubtitle: '当前已加载的可用 DICOM 序列',
    loadingSeries: '正在加载序列...',
    loadingMoreSeries: '正在加载新序列...',
    unnamedSeries: '未命名序列',
    deleteSeries: '删除序列',
    noSeries: '暂无序列',
    noSeriesDesc: '加载文件夹后，这里会显示 DICOM 序列列表。',
    seriesActions: '序列操作',
    open: '打开',
    viewerWorkspace: 'Viewer Workspace',
    waitingSeries: '等待载入序列',
    dropQuickPreview: '释放以快速浏览',
    waitingSeriesDesc: '请先在左侧序列列表中选择一个序列，然后打开对应视图。',
    dropQuickPreviewDesc: '松开鼠标后将直接在右侧打开该序列的快速浏览。',
    loadingView: '正在加载视图...',
    openView: '打开一个视图',
    openViewDesc: '点击“快速浏览 / 3D / MPR”打开当前序列对应的视图。',
    emptyDropQuickPreviewDesc: '当前右侧为空白区域，松开后将直接打开该序列的 Stack 快速浏览。',
    scrollTabsLeft: '向左滚动标签页',
    scrollTabsRight: '向右滚动标签页',
    closeView: '关闭视图',
    frames: '帧'
  },
  'en-US': {
    connection: 'Connection',
    openSettings: 'Open Settings',
    collapseSidebar: 'Collapse Sidebar',
    expandSidebar: 'Expand Sidebar',
    quickActions: 'Quick Actions',
    loadSample: 'Load Sample',
    inputPath: 'Input Path',
    loadFolder: 'Load Folder',
    quickPreview: 'Quick Preview',
    webSampleHint: 'The web build currently loads the sample DICOM directory configured on the server.',
    webPathHint: 'The web build works through the remote backend. Enter a server-accessible directory path to load series.',
    seriesList: 'Series List',
    seriesListSubtitle: 'Loaded DICOM series available in the workspace',
    loadingSeries: 'Loading series...',
    loadingMoreSeries: 'Loading more series...',
    unnamedSeries: 'Unnamed Series',
    deleteSeries: 'Delete Series',
    noSeries: 'No Series',
    noSeriesDesc: 'After loading a folder, the DICOM series list will appear here.',
    seriesActions: 'Series Actions',
    open: 'Open',
    viewerWorkspace: 'Viewer Workspace',
    waitingSeries: 'Waiting For Series',
    dropQuickPreview: 'Release To Quick Preview',
    waitingSeriesDesc: 'Select a series from the left panel first, then open a view for it.',
    dropQuickPreviewDesc: 'Release now to open a stack quick preview for this series on the right.',
    loadingView: 'Loading view...',
    openView: 'Open A View',
    openViewDesc: 'Use Quick Preview / 3D / MPR to open a view for the current series.',
    emptyDropQuickPreviewDesc: 'The right side is empty. Release now to open this series in Stack quick preview.',
    scrollTabsLeft: 'Scroll Tabs Left',
    scrollTabsRight: 'Scroll Tabs Right',
    closeView: 'Close View',
    frames: 'frames'
  }
} as const

type MessageKey = keyof (typeof messages)['zh-CN']

export function useUiLocale() {
  const { locale } = useUiPreferences()

  const currentMessages = computed(() => messages[locale.value])

  function t(key: MessageKey): string {
    return currentMessages.value[key]
  }

  return {
    locale,
    t
  }
}
