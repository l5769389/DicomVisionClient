export type ViewerExportFormat = 'png' | 'dicom' | 'dicom-sr' | 'dicom-gsps'

export function getViewerExportFileExtension(format: ViewerExportFormat): 'png' | 'dcm' {
  return format === 'png' ? 'png' : 'dcm'
}

export function getViewerExportFormatLabel(format: ViewerExportFormat): string {
  if (format === 'dicom-sr') {
    return 'DICOM SR'
  }
  if (format === 'dicom-gsps') {
    return 'DICOM GSPS'
  }
  return format === 'png' ? 'PNG' : 'DICOM'
}
