export type UiLocale = 'zh-CN' | 'en-US'

export interface SettingsCopy {
  title: string
  sectionLabel: string
  reset: string
  applyDraft: string
  language: string
  languageSub: string
  shortcuts: string
  shortcutsSub: string
  windowPresets: string
  windowPresetsSub: string
  qaSection: string
  qaSectionSub: string
  exportSection: string
  exportSectionSub: string
  display: string
  displaySub: string
  shortcutsTitle: string
  shortcutsDesc: string
  editable: string
  navGroup: string
  measureGroup: string
  workspaceGroup: string
  items: string
  windowPresetsTitle: string
  windowPresetsDesc: string
  systemPresets: string
  customPresets: string
  builtIn: string
  custom: string
  emptyCustom: string
  emptyCustomDesc: string
  addCustom: string
  zhName: string
  enName: string
  ww: string
  wl: string
  addTemplate: string
  removeTemplate: string
  qaTitle: string
  qaDesc: string
  qaWaterPhantomTitle: string
  qaWaterPhantomDesc: string
  qaWaterAccuracy: string
  qaWaterAccuracyDesc: string
  qaWaterUniformity: string
  qaWaterUniformityDesc: string
  qaWaterNoise: string
  qaWaterNoiseDesc: string
  qaWaterSelectedCount: (count: number) => string
  exportTitle: string
  exportDesc: string
  exportMode: string
  exportDefault: string
  exportCustom: string
  exportCurrentLocation: string
  exportChooseLocation: string
  exportClearLocation: string
  exportChooseFailed: string
  exportOpenLocation: string
  exportOpenLocationFailed: string
  exportCustomBadge: string
  exportDefaultBadge: string
  exportDefaultHint: string
  exportCustomMissing: string
  exportDesktopMode: string
  exportFileNameTitle: string
  exportIncludeAnnotations: string
  exportIncludeDicomAnnotations: string
  exportIncludeDicomMeasurements: string
  exportIncludeMeasurements: string
  exportIncludeOverlaysHint: string
  exportIncludePngAnnotations: string
  exportIncludePngCornerInfo: string
  exportIncludePngMeasurements: string
  exportUseDefaultFileName: string
  exportUseDefaultFileNameHint: string
  exportFormats: string
  exportCustomHint: string
  exportUnsupportedHint: string
  exportWebMode: string
  displayTitle: string
  displayDesc: string
  scaleBarTitle: string
  scaleBarDesc: string
  scaleBarEnabled: string
  scaleBarColor: string
  enabledLabel: string
  disabledLabel: string
  scaleBarPreviewLabel: string
  roiStatsTitle: string
  roiStatsDesc: string
  themeDesc: string
  pseudocolor: string
  crosshairViewport: string
  crosshairColor: string
  crosshairWidth: string
  thin: string
  bold: string
  crosshairNote: string
  visualPreview: string
  languageTitle: string
  themePresetTitle: string
  zhCn: string
  enUs: string
  crosshairPreviewLabel: string
}

export interface TagViewCopy {
  copy: string
  copyName: string
  copyRow: string
  copyTagId: string
  copyValue: string
  empty: string
  filter: string
  goTo: string
  instance: string
  instanceNavigation: string
  loading: string
  noMatches: string
  page: string
  searchLabel: string
  tagActions: string
}

export interface WorkspaceExportCopy {
  cancel: string
  closeExportNotification: string
  editNameHint: string
  export: string
  exportComplete: string
  exportFailed: string
  exportFailedMessage: string
  exportName: string
  exportNotCompleted: string
  invalidFileName: string
  openFileLocation: string
  openLocationFailed: string
  sentToDownloads: (formatLabel: string) => string
  setExportName: string
  unableToExport: string
  exportedTo: (location: string) => string
}

export const uiMessages = {
  'zh-CN': {
    common: {
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
    settings: {
      title: '工作区设置',
      sectionLabel: 'Section',
      reset: '恢复默认',
      applyDraft: '应用',
      language: '语言',
      languageSub: '界面语言与固定主题切换',
      shortcuts: '快捷键',
      shortcutsSub: '图像浏览与工具操作',
      windowPresets: '窗模板',
      windowPresetsSub: '系统预设与自定义模板',
      qaSection: 'QA 质控',
      qaSectionSub: 'MTF 与水模质控指标',
      exportSection: '导出',
      exportSectionSub: '格式和默认保存位置',
      display: '显示',
      displaySub: '十字线、比例尺、ROI 统计与伪彩',
      shortcutsTitle: '快捷键矩阵',
      shortcutsDesc: '当前展示推荐快捷键布局。',
      editable: '可编辑布局',
      navGroup: '视图导航',
      measureGroup: '标注测量',
      workspaceGroup: '工作区',
      items: '项',
      windowPresetsTitle: '窗模板',
      windowPresetsDesc: '用于快速应用窗宽窗位，不包含颜色配置。',
      systemPresets: '系统预设',
      customPresets: '我的预设',
      builtIn: '内置',
      custom: '自定义',
      emptyCustom: '还没有自定义窗模板',
      emptyCustomDesc: '在右侧填写名称和 WW/WL 后即可添加。',
      addCustom: '新增自定义窗模板',
      zhName: '中文名称',
      enName: '英文名称',
      ww: '窗宽 WW',
      wl: '窗位 WL',
      addTemplate: '添加模板',
      removeTemplate: '删除选中模板',
      qaTitle: 'QA 质控',
      qaDesc: '配置质控工具的默认结果项。MTF 作为空间分辨率任务，水模 QA 会自动识别并生成所选指标。',
      qaWaterPhantomTitle: '水模 QA 结果项',
      qaWaterPhantomDesc: '选择水模 QA 自动分析后需要生成的结果。可同时包含准确性、均匀性和图像噪声。',
      qaWaterAccuracy: '准确性',
      qaWaterAccuracyDesc: '中心 ROI 的水 CT 值与目标 0 HU 的偏差。',
      qaWaterUniformity: '均匀性',
      qaWaterUniformityDesc: '中心与周边 ROI 的 CT 值一致性。',
      qaWaterNoise: '图像噪声',
      qaWaterNoiseDesc: '水模 ROI 内 HU 标准差等噪声指标。',
      qaWaterSelectedCount: (count: number) => `已启用 ${count} 项`,
      exportTitle: '导出设置',
      exportDesc: '设置当前视图导出为 PNG 或 DICOM 时的默认保存位置。',
      exportMode: '导出方式',
      exportDefault: '默认位置',
      exportCustom: '自定义位置',
      exportCurrentLocation: '当前位置',
      exportChooseLocation: '选择位置',
      exportClearLocation: '清除自定义位置',
      exportChooseFailed: '无法打开位置选择器，请检查桌面端权限或重新启动应用后再试。',
      exportOpenLocation: '打开位置',
      exportOpenLocationFailed: '无法打开导出位置，请检查该路径是否存在。',
      exportDefaultBadge: '默认',
      exportCustomBadge: '自定义',
      exportDefaultHint: '使用系统默认下载目录。',
      exportCustomMissing: '尚未选择自定义导出位置。',
      exportCustomHint: '导出文件会保存到选择的文件夹。',
      exportUnsupportedHint: '当前环境不支持选择自定义目录，将使用默认下载方式。',
      exportDesktopMode: '导出的文件会保存到下方显示的位置。',
      exportFileNameTitle: '导出名称',
      exportIncludeAnnotations: '标注',
      exportIncludeDicomAnnotations: '导出标注',
      exportIncludeDicomMeasurements: '导出测量',
      exportIncludeMeasurements: '测量',
      exportIncludeOverlaysHint: '开启后，导出的图像中会携带该内容。',
      exportIncludePngAnnotations: '导出标注',
      exportIncludePngCornerInfo: '导出四角信息',
      exportIncludePngMeasurements: '导出测量',
      exportUseDefaultFileName: '使用默认名称',
      exportUseDefaultFileNameHint: '关闭后，每次导出前都会提示输入文件名。',
      exportFormats: '格式',
      exportWebMode: '导出文件会按照浏览器下载设置保存。',
      displayTitle: '显示样式',
      displayDesc: '在这里统一设置十字线、比例尺、ROI 统计项和默认伪彩。',
      scaleBarTitle: '比例尺',
      scaleBarDesc: '比例尺会跟随当前图像的 spacing、缩放和旋转实时更新。',
      scaleBarEnabled: '启用比例尺',
      scaleBarColor: '比例尺颜色',
      enabledLabel: '已启用',
      disabledLabel: '已关闭',
      scaleBarPreviewLabel: '预览显示的是当前比例尺样式，不影响实际长度计算。',
      roiStatsTitle: 'ROI 统计项',
      roiStatsDesc: '矩形、椭圆和自由选择 ROI 默认显示以下统计值。',
      themeDesc: '当前提供两套预设主题，不支持自由混搭颜色。',
      pseudocolor: '默认伪彩',
      crosshairViewport: 'MPR 视口',
      crosshairColor: '颜色',
      crosshairWidth: '线宽',
      thin: '细',
      bold: '粗',
      crosshairNote: '每个视口设置的是该视口对应截面的位置线颜色。',
      visualPreview: '十字线预览',
      languageTitle: '界面语言',
      themePresetTitle: '固定主题',
      zhCn: '简体中文',
      enUs: 'English',
      crosshairPreviewLabel: '预览中显示的是该视口内实际联动的两条十字线'
    } satisfies SettingsCopy,
    tagView: {
      copy: '复制',
      copyName: '复制 Name',
      copyRow: '复制本行',
      copyTagId: '复制 Tag ID',
      copyValue: '复制 Value',
      empty: '当前实例没有可展示的 DICOM Tags。',
      filter: '筛选',
      goTo: '跳转',
      instance: '实例',
      instanceNavigation: '实例导航',
      loading: '正在读取 DICOM Tags...',
      noMatches: '没有匹配的 Tag 结果。',
      page: '页码',
      searchLabel: '搜索 Tag / Name / Value',
      tagActions: 'Tag 操作'
    } satisfies TagViewCopy,
    workspaceExport: {
      cancel: '取消',
      closeExportNotification: '关闭导出提示',
      editNameHint: '名称可编辑，文件后缀由导出格式固定。',
      export: '导出',
      exportComplete: '导出完成',
      exportFailed: '导出失败',
      exportFailedMessage: '导出失败，请检查后端连接和导出目录权限。',
      exportName: '文件名称',
      exportNotCompleted: '导出未完成',
      invalidFileName: '请输入有效的导出文件名。',
      openFileLocation: '打开文件位置',
      openLocationFailed: '无法打开导出位置，请手动前往上方显示的路径。',
      setExportName: '设置导出名称',
      unableToExport: '当前视图无法导出，请先打开可导出的图像视图。',
      sentToDownloads: (formatLabel: string) => `${formatLabel} 已交给浏览器下载。`,
      exportedTo: (location: string) => `已导出到 ${location}`
    } satisfies WorkspaceExportCopy
  },
  'en-US': {
    common: {
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
    },
    settings: {
      title: 'Workspace Settings',
      sectionLabel: 'Section',
      reset: 'Reset',
      applyDraft: 'Apply',
      language: 'Language',
      languageSub: 'Language and preset themes',
      shortcuts: 'Shortcuts',
      shortcutsSub: 'Image browsing and tool actions',
      windowPresets: 'Window Templates',
      windowPresetsSub: 'Built-in and custom presets',
      qaSection: 'QA',
      qaSectionSub: 'MTF and phantom quality metrics',
      exportSection: 'Export',
      exportSectionSub: 'Formats and default save location',
      display: 'Display',
      displaySub: 'Crosshair, scale bar, ROI stats, and pseudocolor',
      shortcutsTitle: 'Shortcut Matrix',
      shortcutsDesc: 'Current recommended shortcut layout.',
      editable: 'Editable Layout',
      navGroup: 'Navigation',
      measureGroup: 'Measurement',
      workspaceGroup: 'Workspace',
      items: 'items',
      windowPresetsTitle: 'Window Templates',
      windowPresetsDesc: 'Used for quickly applying WW/WL without extra color settings.',
      systemPresets: 'Built-in Presets',
      customPresets: 'My Presets',
      builtIn: 'Built-in',
      custom: 'Custom',
      emptyCustom: 'No custom window templates yet',
      emptyCustomDesc: 'Add one from the form on the right with name and WW/WL.',
      addCustom: 'Add Custom Window Template',
      zhName: 'Chinese Label',
      enName: 'English Label',
      ww: 'Window Width WW',
      wl: 'Window Level WL',
      addTemplate: 'Add Template',
      removeTemplate: 'Remove Selected',
      qaTitle: 'QA Tools',
      qaDesc: 'Configure default result outputs for QA tools. MTF remains the spatial-resolution task; Water Phantom QA auto-detects and reports the selected metrics.',
      qaWaterPhantomTitle: 'Water Phantom QA Metrics',
      qaWaterPhantomDesc: 'Choose which metrics the automatic water phantom QA result should include. Accuracy, uniformity, and image noise can be enabled together.',
      qaWaterAccuracy: 'Accuracy',
      qaWaterAccuracyDesc: 'Center ROI water CT number deviation from the 0 HU target.',
      qaWaterUniformity: 'Uniformity',
      qaWaterUniformityDesc: 'CT number consistency between the center and peripheral ROIs.',
      qaWaterNoise: 'Image Noise',
      qaWaterNoiseDesc: 'Noise metrics such as HU standard deviation inside water phantom ROIs.',
      qaWaterSelectedCount: (count: number) => `${count} enabled`,
      exportTitle: 'Export Settings',
      exportDesc: 'Set the default save location for exporting the current view as PNG or DICOM.',
      exportMode: 'Export Mode',
      exportDefault: 'Default Location',
      exportCustom: 'Custom Location',
      exportCurrentLocation: 'Current Location',
      exportChooseLocation: 'Choose Location',
      exportClearLocation: 'Clear Custom Location',
      exportChooseFailed: 'Could not open the location picker. Check desktop permissions or restart the app and try again.',
      exportOpenLocation: 'Open Location',
      exportOpenLocationFailed: 'Could not open the export location. Check whether the path exists.',
      exportDefaultBadge: 'Default',
      exportCustomBadge: 'Custom',
      exportDefaultHint: 'Use the system default downloads location.',
      exportCustomMissing: 'No custom export location selected.',
      exportCustomHint: 'Save exported files to a selected folder.',
      exportUnsupportedHint: 'This environment does not support picking a custom directory, so browser downloads will be used.',
      exportDesktopMode: 'Exported files are saved to the location shown below.',
      exportFileNameTitle: 'Export Name',
      exportIncludeAnnotations: 'Annotations',
      exportIncludeDicomAnnotations: 'Export annotations',
      exportIncludeDicomMeasurements: 'Export measurements',
      exportIncludeMeasurements: 'Measurements',
      exportIncludeOverlaysHint: 'When enabled, the exported image includes this content.',
      exportIncludePngAnnotations: 'Export annotations',
      exportIncludePngCornerInfo: 'Export corner info',
      exportIncludePngMeasurements: 'Export measurements',
      exportUseDefaultFileName: 'Use default name',
      exportUseDefaultFileNameHint: 'When disabled, each export prompts for a file name.',
      exportFormats: 'Formats',
      exportWebMode: 'Exported files are saved according to the browser download settings.',
      displayTitle: 'Display Style',
      displayDesc: 'Manage crosshair, scale bar, ROI stats, and pseudocolor in one place.',
      scaleBarTitle: 'Scale Bar',
      scaleBarDesc: 'The scale bar updates from the current spacing, zoom, and rotation.',
      scaleBarEnabled: 'Enable Scale Bar',
      scaleBarColor: 'Scale Bar Color',
      enabledLabel: 'Enabled',
      disabledLabel: 'Disabled',
      scaleBarPreviewLabel: 'The preview only shows the visual style. The real length is computed from the current view.',
      roiStatsTitle: 'ROI Statistics',
      roiStatsDesc: 'Rectangle, ellipse, and freehand ROI will show these statistics by default.',
      themeDesc: 'Choose between two preset themes instead of mixing colors freely.',
      pseudocolor: 'Default Pseudocolor',
      crosshairViewport: 'MPR Viewport',
      crosshairColor: 'Color',
      crosshairWidth: 'Thickness',
      thin: 'Thin',
      bold: 'Bold',
      crosshairNote: 'Each viewport sets the line color for its own plane.',
      visualPreview: 'Crosshair Preview',
      languageTitle: 'Interface Language',
      themePresetTitle: 'Preset Themes',
      zhCn: '简体中文',
      enUs: 'English',
      crosshairPreviewLabel: 'The preview shows the two linked lines that actually appear in this viewport'
    } satisfies SettingsCopy,
    tagView: {
      copy: 'Copy',
      copyName: 'Copy Name',
      copyRow: 'Copy Row',
      copyTagId: 'Copy Tag ID',
      copyValue: 'Copy Value',
      empty: 'No DICOM Tags available for this instance.',
      filter: 'Filter',
      goTo: 'Go',
      instance: 'Instance',
      instanceNavigation: 'Instance Navigation',
      loading: 'Loading DICOM Tags...',
      noMatches: 'No matching Tag results.',
      page: 'Page',
      searchLabel: 'Search Tag / Name / Value',
      tagActions: 'Tag Actions'
    } satisfies TagViewCopy,
    workspaceExport: {
      cancel: 'Cancel',
      closeExportNotification: 'Close export notification',
      editNameHint: 'Edit the name. The file extension is fixed by the export format.',
      export: 'Export',
      exportComplete: 'Export Complete',
      exportFailed: 'Export Failed',
      exportFailedMessage: 'Export failed. Check the backend connection and export directory permissions.',
      exportName: 'File name',
      exportNotCompleted: 'Export Not Completed',
      invalidFileName: 'Enter a valid export file name.',
      openFileLocation: 'Open File Location',
      openLocationFailed: 'Could not open the export location. Use the path shown above.',
      setExportName: 'Set export name',
      unableToExport: 'The current view cannot be exported. Open an exportable image view first.',
      sentToDownloads: (formatLabel: string) => `${formatLabel} was sent to the browser downloads.`,
      exportedTo: (location: string) => `Exported to ${location}`
    } satisfies WorkspaceExportCopy
  }
} as const

export type CommonMessageKey = keyof (typeof uiMessages)['zh-CN']['common']
