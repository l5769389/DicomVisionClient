export type UiLocale = 'zh-CN' | 'en-US'

export interface SettingsCopy {
  title: string
  versionLabel: string
  versionBadge: (version: string) => string
  productName: string
  reset: string
  applyDraft: string
  clear: string
  selectAll: string
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
  measurementStyleTitle: string
  measurementStyleDesc: string
  measurementEditingColor: string
  measurementCompletedColor: string
  measurementLineWidth: string
  measurementEditingLineStyle: string
  measurementCompletedLineStyle: string
  measurementSolidLine: string
  measurementDashedLine: string
  enabledLabel: string
  disabledLabel: string
  roiStatsTitle: string
  roiStatsDesc: string
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
  customPresetLimit: (limit: number) => string
  crosshairTitle: string
  crosshairDesc: string
  crosshairStyleTitle: string
}

export interface TagViewCopy {
  tagHeader: string
  nameHeader: string
  vrHeader: string
  valueHeader: string
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

export interface ToolbarCopy {
  dockCollapse: string
  dockExpand: string
  dockNoDetails: string
  hideTabs: string
  pausePlayback: string
  resumePlayback: string
  showTabs: string
  stopPlayback: string
  toolOptions: (toolLabel: string) => string
}

export interface ViewerCopy {
  active: string
  keySliceDialogEmpty: string
  keySliceDialogHint: string
  keySliceDialogTitle: string
  keySliceClear: string
  keySliceClearTitle: string
  keySliceLabel: (sliceNumber: number) => string
  keySliceOpen: string
  keySliceReviewAction: (count: number) => string
  keySliceReviewSubtitle: string
  markKeySlice: string
  nextKeySlice: string
  previousKeySlice: string
  unmarkKeySlice: string
  loadingView: string
  loadingMprView: string
  loadingStackView: string
  loadingVolumeView: string
  stackPlaceholder: string
  volumePlaceholder: string
  viewportPreview: (label: string) => string
  switchSlice: string
  slice: string
  playbackFps: string
  loading4dPlayback: string
  pause4dPlayback: string
  play4dPlayback: string
  loading: string
  pause: string
  play: string
  loading4dPhases: string
  playingMprToolsDisabled: string
  preparing4dPhases: string
  playingPhaseDetail: (phase: number, total: number, fps: number) => string
  phasesQueued: (count: number) => string
  playingFps: (fps: number) => string
  playbackIdle4d: string
  phaseLoadStatus: (runtime: string, loaded: number, loading: number, unloaded: number, failed: number) => string
  playing: string
  ready: string
  phases: string
  select4dFrame: (frame: number) => string
  loaded: string
  notLoaded: string
}

export interface OverlayCopy {
  annotationPlaceholder: string
  annotationStyle: string
  color: string
  size: string
  copy: string
  delete: string
  copyAnnotation: string
  deleteAnnotation: string
  copyMeasurement: string
  deleteMeasurement: string
  mtfMetric: string
  mtfDrawRoi: string
  mtfCalculating: string
  mtfFailed: string
  mtfSelectedRoi: string
  mtfRoi: string
  viewMtfCurve: string
  copyMtfRoi: string
  deleteMtfRoi: string
  mtfIncomplete: string
  mtfSubmitting: string
  mtfDrawGuide: string
  mtfCurveTitle: string
  curvePlot: string
  normalizedMtfDesc: string
  keyMetrics: string
  readingGuide: string
  closeMtfCurve: string
  close: string
  noCurveData: string
  curveMarkersIncomplete: string
  measuredFromCurrentRoi: string
  mtfGuideIntro: string
  mtf50Guide: string
  mtf10Guide: string
  qaWaterTitle: string
  qaWaterLoading: string
  qaWaterFailed: string
  qaWaterDetectionFailed: string
  qaWaterDismiss: string
  qaAccuracy: string
  qaUniformity: string
  qaNoise: string
  roiSize: string
  roiArea: string
  roi: string
  mean: string
  delta: string
}

export interface VolumeCopy {
  parameters: string
  tissue: string
  lighting: string
  windowWidth: string
  windowLevel: string
  opacity: string
  enableShading: string
  interpolation: string
  ambient: string
  diffuse: string
  specular: string
  roughness: string
  nearest: string
  linear: string
  cubic: string
  bone: string
  blood: string
  muscle: string
  softTissue: string
  lung: string
  custom: string
}

export interface MprProjectionCopy {
  title: string
  subtitle: string
  expand: string
  collapse: string
  disabled: string
  enabled: string
  nativeMpr: string
  slabProjection: string
  algorithm: string
  maximumDesc: string
  minimumDesc: string
  averageDesc: string
  sumDesc: string
}

export interface WorkspaceStatusCopy {
  mtfAnalysisFailed: string
  noUsableSeries: string
  folderLoadFailed: string
  uploadDicomProgress: string
  uploadDicomParsing: string
  uploadDicomComplete: string
  tagLoadFailed: string
  notFourDSeries: string
  fourDMetadataUnavailable: string
  openViewFailed: (viewType: string) => string
  tabTitleConnector: string
}

export const uiMessages = {
  'zh-CN': {
    common: {
      connection: '连接',
      diagnosticWorkspace: 'DICOM 影像查看器',
      openSettings: '打开设置',
      collapseSidebar: '收起侧栏',
      expandSidebar: '展开侧栏',
      quickActions: '快速操作',
      loadSample: '加载示例影像',
      inputPath: '输入路径',
      uploadDicom: '上传 DICOM',
      uploadFolder: '上传文件夹',
      uploadFolderHint: '保留目录结构，适合整套检查。',
      uploadFiles: '上传文件',
      uploadFilesHint: '选择一个或多个 DICOM 文件。',
      loadFolder: '加载文件夹',
      quickPreview: '快速浏览',
      webSampleHint: 'Web 版本当前会直接加载服务端本地配置的示例 DICOM 目录。',
      webPathHint: 'Web 版本通过远程后端工作，加载序列时请输入服务端可访问的目录路径。',
      webUploadHint: 'Web 版本会将浏览器选择的 DICOM 文件上传到后端解析。',
      seriesList: '序列列表',
      seriesListSubtitle: '当前已加载的可用 DICOM 序列',
      loadingSeries: '正在加载序列...',
      loadingMoreSeries: '正在加载新序列...',
      unnamedSeries: '未命名序列',
      deleteSeries: '从列表中移除序列',
      noSeries: '暂无序列',
      noSeriesDesc: '加载文件夹后，这里会显示 DICOM 序列列表。',
      seriesActions: '序列操作',
      open: '打开',
      viewerWorkspace: '影像工作区',
      waitingSeries: '等待载入序列',
      dropQuickPreview: '释放以快速浏览',
      waitingSeriesDesc: '选择“上传 DICOM/加载文件夹”载入影像，或直接拖拽 DICOM 文件、文件夹到窗口；加载后双击序列快速浏览，也可右键序列选择浏览方式。',
      dropQuickPreviewDesc: '松开鼠标后将直接在右侧打开该序列的快速浏览。',
      loadingView: '正在加载视图...',
      openView: '开始浏览 DICOM',
      openViewDesc: '选择“上传 DICOM/加载文件夹”或拖拽载入影像；加载后双击序列快速浏览，也可以右键序列选择 2D、3D、MPR 等浏览方式。',
      emptyDropQuickPreviewDesc: '当前右侧为空白区域，松开后将直接打开该序列的栈快速浏览。',
      scrollTabsLeft: '向左滚动标签页',
      scrollTabsRight: '向右滚动标签页',
      closeView: '关闭视图',
      frames: '帧'
    },
    settings: {
      title: '工作区设置',
      versionLabel: '版本',
      versionBadge: (version: string) => `v${version}`,
      productName: 'DicomVision',
      reset: '恢复默认',
      applyDraft: '应用',
      clear: '取消全选',
      selectAll: '全选',
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
      scaleBarDesc: '比例尺会跟随当前图像的像素间距、缩放和旋转实时更新。',
      scaleBarEnabled: '启用比例尺',
      scaleBarColor: '比例尺颜色',
      measurementStyleTitle: '测量样式',
      measurementStyleDesc: '设置测量编辑中和完成后的显示颜色、线宽与线型。',
      measurementEditingColor: '编辑中颜色',
      measurementCompletedColor: '完成后颜色',
      measurementLineWidth: '线段粗细',
      measurementEditingLineStyle: '编辑中线型',
      measurementCompletedLineStyle: '完成后线型',
      measurementSolidLine: '实线',
      measurementDashedLine: '虚线',
      enabledLabel: '已启用',
      disabledLabel: '已关闭',
      roiStatsTitle: 'ROI 统计项',
      roiStatsDesc: '矩形、椭圆和自由选择 ROI 默认显示以下统计值。',
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
      customPresetLimit: (limit: number) => `最多只能保留 ${limit} 个自定义模板。`,
      crosshairTitle: '十字线',
      crosshairDesc: '设置 MPR 三个视图的十字线颜色和线宽，并在同一区域预览效果。',
      crosshairStyleTitle: '十字线样式'
    } satisfies SettingsCopy,
    tagView: {
      tagHeader: '标签',
      nameHeader: '名称',
      vrHeader: 'VR',
      valueHeader: '值',
      copy: '复制',
      copyName: '复制名称',
      copyRow: '复制本行',
      copyTagId: '复制标签 ID',
      copyValue: '复制值',
      empty: '当前实例没有可展示的 DICOM 标签。',
      filter: '筛选',
      goTo: '跳转',
      instance: '实例',
      instanceNavigation: '实例导航',
      loading: '正在读取 DICOM 标签...',
      noMatches: '没有匹配的标签结果。',
      page: '页码',
      searchLabel: '搜索标签 / 名称 / 值',
      tagActions: '标签操作'
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
    } satisfies WorkspaceExportCopy,
    toolbar: {
      dockCollapse: '收起右侧操作区',
      dockExpand: '展开右侧操作区',
      dockNoDetails: '该工具没有额外设置。',
      hideTabs: '收起标签栏',
      pausePlayback: '暂停播放',
      resumePlayback: '继续播放',
      showTabs: '展开标签栏',
      stopPlayback: '停止播放',
      toolOptions: (toolLabel: string) => `${toolLabel} 选项`
    } satisfies ToolbarCopy,
    viewer: {
      active: '当前',
      keySliceDialogEmpty: '暂无关键切片',
      keySliceDialogHint: '打开栈视图并跳转到该切片',
      keySliceDialogTitle: '关键切片',
      keySliceClear: '清空',
      keySliceClearTitle: '清空当前序列的关键切片标记',
      keySliceLabel: (sliceNumber: number) => `切片 ${sliceNumber}`,
      keySliceOpen: '打开',
      keySliceReviewAction: (count: number) => `查看关键切片 (${count})`,
      keySliceReviewSubtitle: '查看已标记切片并快速跳转',
      markKeySlice: '标记为关键切片',
      nextKeySlice: '跳到下一个关键切片',
      previousKeySlice: '跳到上一个关键切片',
      unmarkKeySlice: '取消关键切片标记',
      loadingView: '正在加载视图...',
      loadingMprView: '正在加载 MPR 视图...',
      loadingStackView: '正在加载栈视图...',
      loadingVolumeView: '正在加载 3D 视图...',
      stackPlaceholder: '单视口预览',
      volumePlaceholder: '3D 视图预留区域',
      viewportPreview: (label: string) => `${label} 预览`,
      switchSlice: '切换切片',
      slice: '切片',
      playbackFps: '4D 播放 FPS',
      loading4dPlayback: '正在加载 4D 播放',
      pause4dPlayback: '暂停 4D 播放',
      play4dPlayback: '播放 4D',
      loading: '加载中',
      pause: '暂停',
      play: '播放',
      loading4dPhases: '正在加载 4D 相位',
      playingMprToolsDisabled: '播放中，MPR 工具已禁用',
      preparing4dPhases: '正在准备相位视口，播放即将开始。',
      playingPhaseDetail: (phase: number, total: number, fps: number) => `第 ${phase} / ${total} 帧正在以 ${fps} FPS 播放。`,
      phasesQueued: (count: number) => `${count} 个相位已加入队列`,
      playingFps: (fps: number) => `正在播放 ${fps} FPS`,
      playbackIdle4d: '4D 播放空闲',
      phaseLoadStatus: (runtime: string, loaded: number, loading: number, unloaded: number, failed: number) =>
        `${runtime}。相位加载状态：${loaded} 已加载，${loading} 加载中，${unloaded} 未加载，${failed} 失败。`,
      playing: '播放中',
      ready: '就绪',
      phases: '相位',
      select4dFrame: (frame: number) => `选择 4D 第 ${frame} 帧`,
      loaded: '已加载',
      notLoaded: '未加载'
    } satisfies ViewerCopy,
    overlay: {
      annotationPlaceholder: '标注',
      annotationStyle: '标注样式',
      color: '颜色',
      size: '大小',
      copy: '复制',
      delete: '删除',
      copyAnnotation: '复制标注',
      deleteAnnotation: '删除标注',
      copyMeasurement: '复制测量',
      deleteMeasurement: '删除测量',
      mtfMetric: 'MTF 指标',
      mtfDrawRoi: '绘制 ROI',
      mtfCalculating: '计算中',
      mtfFailed: '分析失败',
      mtfSelectedRoi: '已选中 ROI',
      mtfRoi: 'MTF ROI',
      viewMtfCurve: '查看 MTF 曲线',
      copyMtfRoi: '复制 MTF ROI',
      deleteMtfRoi: '删除 MTF ROI',
      mtfIncomplete: '当前 ROI 的 MTF 分析未完成。',
      mtfSubmitting: '正在提交当前 ROI，并等待返回 MTF 指标。',
      mtfDrawGuide: '拖拽一个矩形 ROI 开始分析。当前视口可以保留多个 MTF ROI。',
      mtfCurveTitle: 'MTF 曲线',
      curvePlot: '曲线图',
      normalizedMtfDesc: '归一化 MTF 随空间频率变化',
      keyMetrics: '关键指标',
      readingGuide: '阅读提示',
      closeMtfCurve: '关闭 MTF 曲线',
      close: '关闭',
      noCurveData: '暂无曲线数据',
      curveMarkersIncomplete: '曲线标记不完整',
      measuredFromCurrentRoi: '基于当前 ROI 测量',
      mtfGuideIntro: '曲线越高，表示在更细空间频率下保留的对比度越好。',
      mtf50Guide: 'MTF50 反映中等对比度细节响应。',
      mtf10Guide: 'MTF10 常用于极限分辨率参考。',
      qaWaterTitle: '水模 QA',
      qaWaterLoading: '正在分析水模 QA...',
      qaWaterFailed: '水模 QA 分析失败，请确认图像包含完整水模后重试。',
      qaWaterDetectionFailed: '水模 QA 检测失败',
      qaWaterDismiss: '知道了',
      qaAccuracy: '准确性',
      qaUniformity: '均匀性',
      qaNoise: '噪声',
      roiSize: 'ROI 尺寸',
      roiArea: 'ROI 面积',
      roi: 'ROI',
      mean: '均值',
      delta: '偏差'
    } satisfies OverlayCopy,
    volume: {
      parameters: '3D 参数',
      tissue: '组织窗',
      lighting: '灯光',
      windowWidth: '窗宽',
      windowLevel: '窗位',
      opacity: '透明度',
      enableShading: '开启阴影',
      interpolation: '插值方式',
      ambient: '环境光',
      diffuse: '漫反射',
      specular: '镜面反射',
      roughness: '粗糙度',
      nearest: '最临近',
      linear: '线性',
      cubic: '三次内插',
      bone: '骨骼',
      blood: '血液',
      muscle: '肌肉',
      softTissue: '软组织',
      lung: '肺',
      custom: '自定义'
    } satisfies VolumeCopy,
    mprProjection: {
      title: 'MPR 投影',
      subtitle: 'MIP 厚层预览',
      expand: '展开 MIP 面板',
      collapse: '收起 MIP 面板',
      disabled: '关闭',
      enabled: '开启',
      nativeMpr: '原生 MPR',
      slabProjection: '厚层投影',
      algorithm: '算法',
      maximumDesc: '突出高密度结构。',
      minimumDesc: '突出低密度结构。',
      averageDesc: '将厚层混合为更柔和的预览。',
      sumDesc: '沿厚层累加体素强度。'
    } satisfies MprProjectionCopy,
    workspaceStatus: {
      mtfAnalysisFailed: 'MTF 分析失败',
      noUsableSeries: '所选路径中未找到可用序列。',
      folderLoadFailed: 'DICOM 加载失败。',
      uploadDicomProgress: '正在上传 DICOM 文件...',
      uploadDicomParsing: '上传完成，正在解析 DICOM...',
      uploadDicomComplete: 'DICOM 上传并解析完成。',
      tagLoadFailed: 'DICOM 标签加载失败。',
      notFourDSeries: '当前序列不是 4D 序列。',
      fourDMetadataUnavailable: '当前序列没有可用的 4D 相位元数据。',
      openViewFailed: (viewType: string) => `${viewType} 视图打开失败。`,
      tabTitleConnector: '·'
    } satisfies WorkspaceStatusCopy
  },
  'en-US': {
    common: {
      connection: 'Connection',
      diagnosticWorkspace: 'DICOM Image Viewer',
      openSettings: 'Open Settings',
      collapseSidebar: 'Collapse Sidebar',
      expandSidebar: 'Expand Sidebar',
      quickActions: 'Quick Actions',
      loadSample: 'Load Demo Images',
      inputPath: 'Input Path',
      uploadDicom: 'Upload DICOM',
      uploadFolder: 'Upload Folder',
      uploadFolderHint: 'Preserve folder structure for a full study.',
      uploadFiles: 'Upload Files',
      uploadFilesHint: 'Choose one or more DICOM files.',
      loadFolder: 'Load Folder',
      quickPreview: 'Quick Preview',
      webSampleHint: 'The web build currently loads the sample DICOM directory configured on the server.',
      webPathHint: 'The web build works through the remote backend. Enter a server-accessible directory path to load series.',
      webUploadHint: 'The web build uploads browser-selected DICOM files to the backend for parsing.',
      seriesList: 'Series List',
      seriesListSubtitle: 'Loaded DICOM series available in the workspace',
      loadingSeries: 'Loading series...',
      loadingMoreSeries: 'Loading more series...',
      unnamedSeries: 'Unnamed Series',
      deleteSeries: 'Remove Series From List',
      noSeries: 'No Series',
      noSeriesDesc: 'After loading a folder, the DICOM series list will appear here.',
      seriesActions: 'Series Actions',
      open: 'Open',
      viewerWorkspace: 'Viewer Workspace',
      waitingSeries: 'Waiting For Series',
      dropQuickPreview: 'Release To Quick Preview',
      waitingSeriesDesc: 'Load DICOM images with Upload DICOM / Load Folder, or drag files and folders into the window. After loading, double-click a series for quick preview or right-click it to choose a view.',
      dropQuickPreviewDesc: 'Release now to open a stack quick preview for this series on the right.',
      loadingView: 'Loading view...',
      openView: 'Start Reviewing DICOM',
      openViewDesc: 'Load images with Upload DICOM / Load Folder or drag them into the window. Then double-click a series for quick preview, or right-click it to choose 2D, 3D, MPR, and other views.',
      emptyDropQuickPreviewDesc: 'The right side is empty. Release now to open this series in Stack quick preview.',
      scrollTabsLeft: 'Scroll Tabs Left',
      scrollTabsRight: 'Scroll Tabs Right',
      closeView: 'Close View',
      frames: 'frames'
    },
    settings: {
      title: 'Workspace Settings',
      versionLabel: 'Version',
      versionBadge: (version: string) => `v${version}`,
      productName: 'DicomVision',
      reset: 'Reset',
      applyDraft: 'Apply',
      clear: 'Clear',
      selectAll: 'Select All',
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
      measurementStyleTitle: 'Measurement Style',
      measurementStyleDesc: 'Set colors, stroke width, and line styles while editing and after completion.',
      measurementEditingColor: 'Editing color',
      measurementCompletedColor: 'Completed color',
      measurementLineWidth: 'Line width',
      measurementEditingLineStyle: 'Editing line style',
      measurementCompletedLineStyle: 'Completed line style',
      measurementSolidLine: 'Solid',
      measurementDashedLine: 'Dashed',
      enabledLabel: 'Enabled',
      disabledLabel: 'Disabled',
      roiStatsTitle: 'ROI Statistics',
      roiStatsDesc: 'Rectangle, ellipse, and freehand ROI will show these statistics by default.',
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
      customPresetLimit: (limit: number) => `Up to ${limit} custom templates can be saved.`,
      crosshairTitle: 'Crosshair',
      crosshairDesc: 'Configure crosshair color and thickness for the three MPR views, with preview in the same area.',
      crosshairStyleTitle: 'Crosshair Style'
    } satisfies SettingsCopy,
    tagView: {
      tagHeader: 'Tag',
      nameHeader: 'Name',
      vrHeader: 'VR',
      valueHeader: 'Value',
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
    } satisfies WorkspaceExportCopy,
    toolbar: {
      dockCollapse: 'Collapse right toolbar',
      dockExpand: 'Expand right toolbar',
      dockNoDetails: 'No additional settings for this tool.',
      hideTabs: 'Hide tabs',
      pausePlayback: 'Pause playback',
      resumePlayback: 'Resume playback',
      showTabs: 'Show tabs',
      stopPlayback: 'Stop playback',
      toolOptions: (toolLabel: string) => `${toolLabel} options`
    } satisfies ToolbarCopy,
    viewer: {
      active: 'Active',
      keySliceDialogEmpty: 'No key slices.',
      keySliceDialogHint: 'Open Stack view at this slice',
      keySliceDialogTitle: 'Key slices',
      keySliceClear: 'Clear',
      keySliceClearTitle: 'Clear key slice marks for this series',
      keySliceLabel: (sliceNumber: number) => `Slice ${sliceNumber}`,
      keySliceOpen: 'Open',
      keySliceReviewAction: (count: number) => `Key slices (${count})`,
      keySliceReviewSubtitle: 'Review marked slices and jump to one',
      markKeySlice: 'Mark key slice',
      nextKeySlice: 'Jump to next key slice',
      previousKeySlice: 'Jump to previous key slice',
      unmarkKeySlice: 'Unmark key slice',
      loadingView: 'Loading view...',
      loadingMprView: 'Loading MPR view...',
      loadingStackView: 'Loading stack view...',
      loadingVolumeView: 'Loading 3D view...',
      stackPlaceholder: 'Single viewport preview',
      volumePlaceholder: '3D view placeholder',
      viewportPreview: (label: string) => `${label} preview`,
      switchSlice: 'Switch slice',
      slice: 'Slice',
      playbackFps: '4D playback FPS',
      loading4dPlayback: 'Loading 4D playback',
      pause4dPlayback: 'Pause 4D playback',
      play4dPlayback: 'Play 4D playback',
      loading: 'Loading',
      pause: 'Pause',
      play: 'Play',
      loading4dPhases: 'Loading 4D phases',
      playingMprToolsDisabled: 'Playing, MPR tools disabled',
      preparing4dPhases: 'Preparing phase viewports before playback starts.',
      playingPhaseDetail: (phase: number, total: number, fps: number) => `Phase ${phase} of ${total} is playing at ${fps} FPS.`,
      phasesQueued: (count: number) => `${count} phases queued`,
      playingFps: (fps: number) => `Playing ${fps} FPS`,
      playbackIdle4d: '4D playback idle',
      phaseLoadStatus: (runtime: string, loaded: number, loading: number, unloaded: number, failed: number) =>
        `${runtime}. Phase load status: ${loaded} loaded, ${loading} loading, ${unloaded} not loaded, ${failed} failed.`,
      playing: 'Playing',
      ready: 'Ready',
      phases: 'Phases',
      select4dFrame: (frame: number) => `Select 4D frame ${frame}`,
      loaded: 'Loaded',
      notLoaded: 'Not loaded'
    } satisfies ViewerCopy,
    overlay: {
      annotationPlaceholder: 'Annotation',
      annotationStyle: 'Annotation Style',
      color: 'Color',
      size: 'Size',
      copy: 'Copy',
      delete: 'Delete',
      copyAnnotation: 'Copy annotation',
      deleteAnnotation: 'Delete annotation',
      copyMeasurement: 'Copy measurement',
      deleteMeasurement: 'Delete measurement',
      mtfMetric: 'MTF Metric',
      mtfDrawRoi: 'Draw ROI',
      mtfCalculating: 'Calculating',
      mtfFailed: 'Analysis failed',
      mtfSelectedRoi: 'Selected ROI',
      mtfRoi: 'MTF ROI',
      viewMtfCurve: 'View MTF curve',
      copyMtfRoi: 'Copy MTF ROI',
      deleteMtfRoi: 'Delete MTF ROI',
      mtfIncomplete: 'MTF analysis for the current ROI is not complete.',
      mtfSubmitting: 'Submitting the current ROI and waiting for MTF metrics.',
      mtfDrawGuide: 'Drag a rectangular ROI to start analysis. This viewport can keep multiple MTF ROIs.',
      mtfCurveTitle: 'MTF Curve',
      curvePlot: 'Curve Plot',
      normalizedMtfDesc: 'Normalized MTF against spatial frequency',
      keyMetrics: 'Key Metrics',
      readingGuide: 'Reading Guide',
      closeMtfCurve: 'Close MTF curve',
      close: 'Close',
      noCurveData: 'No curve data',
      curveMarkersIncomplete: 'Curve markers are incomplete',
      measuredFromCurrentRoi: 'Measured from the current ROI',
      mtfGuideIntro: 'Higher curves indicate better retained contrast at finer spatial frequencies.',
      mtf50Guide: 'MTF50 reflects mid-contrast detail response.',
      mtf10Guide: 'MTF10 is often used as the limiting-resolution reference.',
      qaWaterTitle: 'Water Phantom QA',
      qaWaterLoading: 'Analyzing water phantom QA...',
      qaWaterFailed: 'Water phantom QA failed. Confirm the image contains the complete phantom and try again.',
      qaWaterDetectionFailed: 'Water phantom QA failed',
      qaWaterDismiss: 'Got it',
      qaAccuracy: 'Accuracy',
      qaUniformity: 'Uniformity',
      qaNoise: 'Noise',
      roiSize: 'ROI Size',
      roiArea: 'ROI Area',
      roi: 'ROI',
      mean: 'Mean',
      delta: 'Delta'
    } satisfies OverlayCopy,
    volume: {
      parameters: '3D Parameters',
      tissue: 'Tissue Window',
      lighting: 'Lighting',
      windowWidth: 'Window Width',
      windowLevel: 'Window Level',
      opacity: 'Opacity',
      enableShading: 'Enable Shading',
      interpolation: 'Interpolation',
      ambient: 'Ambient',
      diffuse: 'Diffuse',
      specular: 'Specular',
      roughness: 'Roughness',
      nearest: 'Nearest',
      linear: 'Linear',
      cubic: 'Cubic',
      bone: 'Bone',
      blood: 'Blood',
      muscle: 'Muscle',
      softTissue: 'Soft Tissue',
      lung: 'Lung',
      custom: 'Custom'
    } satisfies VolumeCopy,
    mprProjection: {
      title: 'MPR Projection',
      subtitle: 'MIP slab preview',
      expand: 'Expand MIP panel',
      collapse: 'Collapse MIP panel',
      disabled: 'Disabled',
      enabled: 'Enabled',
      nativeMpr: 'Native MPR',
      slabProjection: 'Slab projection',
      algorithm: 'Algorithm',
      maximumDesc: 'Highlight high-density structures.',
      minimumDesc: 'Highlight low-density structures.',
      averageDesc: 'Blend the slab into a softer preview.',
      sumDesc: 'Accumulate voxel intensity through the slab.'
    } satisfies MprProjectionCopy,
    workspaceStatus: {
      mtfAnalysisFailed: 'MTF analysis failed',
      noUsableSeries: 'No usable series were found in the selected path.',
      folderLoadFailed: 'DICOM loading failed.',
      uploadDicomProgress: 'Uploading DICOM files...',
      uploadDicomParsing: 'Upload complete. Parsing DICOM files...',
      uploadDicomComplete: 'DICOM upload and parsing completed.',
      tagLoadFailed: 'DICOM Tag loading failed.',
      notFourDSeries: 'The current series is not a 4D series.',
      fourDMetadataUnavailable: '4D phase metadata is not available for this series.',
      openViewFailed: (viewType: string) => `${viewType} view failed to open.`,
      tabTitleConnector: '-'
    } satisfies WorkspaceStatusCopy
  }
} as const

export type CommonMessageKey = keyof (typeof uiMessages)['zh-CN']['common']
