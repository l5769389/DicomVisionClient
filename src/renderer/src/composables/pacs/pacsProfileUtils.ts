import type { PacsAuthType, PacsDicomwebProfile, PacsProfilePreset } from '../ui/useUiPreferences'

function createProfileId(): string {
  return `pacs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function createPacsProfile(preset: PacsProfilePreset = 'custom', isZh = false): PacsDicomwebProfile {
  return {
    id: createProfileId(),
    name: preset === 'dcm4chee' ? 'dcm4chee DICOMweb' : preset === 'orthanc' ? 'Orthanc DICOMweb' : (isZh ? '新 PACS Profile' : 'New PACS Profile'),
    enabled: true,
    protocol: 'dicomweb',
    preset,
    baseUrl: preset === 'orthanc' ? 'http://127.0.0.1:8042' : 'http://127.0.0.1:8080',
    qidoPath: preset === 'dcm4chee' ? '/dcm4chee-arc/aets/DCM4CHEE/rs' : '/dicom-web',
    wadoPath: preset === 'dcm4chee' ? '/dcm4chee-arc/aets/DCM4CHEE/rs' : '/dicom-web',
    authType: 'none',
    username: '',
    password: '',
    bearerToken: '',
    host: '127.0.0.1',
    port: 104,
    calledAeTitle: 'ORTHANC',
    clientAeTitle: 'DICOMVISION',
    queryModel: 'study-root',
    timeoutSeconds: 8
  }
}

export function pacsProfileEndpoint(profile: PacsDicomwebProfile): string {
  if (profile.protocol === 'dimse') {
    return `${profile.host}:${profile.port} ${profile.clientAeTitle}->${profile.calledAeTitle}`
  }
  return `${profile.baseUrl}${profile.qidoPath}`
}

export function pacsPresetLabel(value: PacsProfilePreset, isZh = false): string {
  if (value === 'orthanc') return 'Orthanc'
  if (value === 'dcm4chee') return 'dcm4chee'
  return isZh ? '自定义' : 'Custom'
}

export function pacsAuthLabel(value: PacsAuthType, isZh = false): string {
  if (value === 'basic') return 'Basic'
  if (value === 'bearer') return 'Bearer'
  return isZh ? '无认证' : 'None'
}
