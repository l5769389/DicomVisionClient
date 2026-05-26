import type { PacsAuthType, PacsDicomwebProfile, PacsProfilePreset } from '../ui/useUiPreferences'

interface PacsPresetConnectionDefaults {
  name: string
  baseUrl: string
  qidoPath: string
  wadoPath: string
  dimsePort: number
  calledAeTitle: string
}

const PACS_PRESET_DEFAULTS: Record<PacsProfilePreset, PacsPresetConnectionDefaults> = {
  orthanc: {
    name: 'Orthanc',
    baseUrl: 'http://127.0.0.1:8042',
    qidoPath: '/dicom-web',
    wadoPath: '/dicom-web',
    dimsePort: 4242,
    calledAeTitle: 'ORTHANC'
  },
  dcm4chee: {
    name: 'dcm4chee',
    baseUrl: 'http://127.0.0.1:8080',
    qidoPath: '/dcm4chee-arc/aets/DCM4CHEE/rs',
    wadoPath: '/dcm4chee-arc/aets/DCM4CHEE/rs',
    dimsePort: 11112,
    calledAeTitle: 'DCM4CHEE'
  },
  custom: {
    name: 'Custom',
    baseUrl: 'http://127.0.0.1',
    qidoPath: '/dicom-web',
    wadoPath: '/dicom-web',
    dimsePort: 104,
    calledAeTitle: 'ANY-SCP'
  }
}

function createProfileId(): string {
  return `pacs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function pacsProfilePresetConnectionPatch(
  preset: PacsProfilePreset
): Pick<PacsDicomwebProfile, 'baseUrl' | 'qidoPath' | 'wadoPath' | 'host' | 'port' | 'calledAeTitle'> {
  const defaults = PACS_PRESET_DEFAULTS[preset]
  return {
    baseUrl: defaults.baseUrl,
    qidoPath: defaults.qidoPath,
    wadoPath: defaults.wadoPath,
    host: '127.0.0.1',
    port: defaults.dimsePort,
    calledAeTitle: defaults.calledAeTitle
  }
}

export function createPacsProfile(preset: PacsProfilePreset = 'custom', isZh = false): PacsDicomwebProfile {
  const defaults = PACS_PRESET_DEFAULTS[preset]
  return {
    id: createProfileId(),
    name: preset === 'custom' ? (isZh ? '新 PACS Profile' : 'New PACS Profile') : `${defaults.name} DICOMweb`,
    enabled: true,
    protocol: 'dicomweb',
    preset,
    ...pacsProfilePresetConnectionPatch(preset),
    authType: 'none',
    username: '',
    password: '',
    bearerToken: '',
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
