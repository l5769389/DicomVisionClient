import type { PacsDicomwebProfile as ApiPacsDicomwebProfile } from '@shared/generated/backendApi'
import type { PacsDicomwebProfile as UiPacsDicomwebProfile } from '../ui/useUiPreferences'

export function toApiPacsDicomwebProfile(profile: UiPacsDicomwebProfile): ApiPacsDicomwebProfile {
  return {
    id: profile.id,
    name: profile.name,
    baseUrl: profile.baseUrl,
    qidoPath: profile.qidoPath,
    wadoPath: profile.wadoPath,
    authType: profile.authType,
    username: profile.username || null,
    password: profile.password || null,
    bearerToken: profile.bearerToken || null,
    timeoutSeconds: profile.timeoutSeconds,
    preset: profile.preset
  }
}
