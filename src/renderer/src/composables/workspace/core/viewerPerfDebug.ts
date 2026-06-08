export function isViewerPerfDebugEnabled(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem('dicomVision:debugPerf') === '1'
  } catch {
    return false
  }
}
