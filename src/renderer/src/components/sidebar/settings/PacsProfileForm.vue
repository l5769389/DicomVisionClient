<script setup lang="ts">
import type {
  DimseQueryModel,
  PacsAuthType,
  PacsDicomwebProfile,
  PacsProfilePreset,
  PacsProtocol
} from '../../../composables/ui/useUiPreferences'
import { pacsProfileEndpoint } from '../../../composables/pacs/pacsProfileUtils'

defineProps<{
  isTesting: boolean
  isZh: boolean
  mode?: 'edit' | 'create'
  profile: PacsDicomwebProfile
  testResult: { ok: boolean; message: string } | null
}>()

const emit = defineEmits<{
  cancel: []
  test: []
  reset: []
  save: []
  updateProfile: [patch: Partial<PacsDicomwebProfile>]
}>()
</script>

<template>
  <article class="rounded-[24px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] p-4">
    <div class="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div class="min-w-0">
        <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ mode === 'create' ? (isZh ? '新增 PACS Profile' : 'New PACS Profile') : (isZh ? 'Profile 详情' : 'Profile Details') }}</div>
        <div class="mt-1 truncate text-xs text-[var(--theme-text-muted)]" :title="pacsProfileEndpoint(profile)">{{ pacsProfileEndpoint(profile) }}</div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="theme-button-secondary rounded-2xl px-3 py-2 text-xs font-semibold" @click="emit('test')">
          {{ isTesting ? '...' : (isZh ? '测试连接' : 'Test Connection') }}
        </button>
        <button v-if="mode !== 'create'" type="button" class="theme-button-secondary rounded-2xl px-3 py-2 text-xs font-semibold" @click="emit('cancel')">
          {{ isZh ? '收起' : 'Close' }}
        </button>
      </div>
    </div>

    <div class="grid gap-3 md:grid-cols-2">
      <label class="grid gap-1.5">
        <span class="pacs-form-label">{{ isZh ? '名称' : 'Name' }}</span>
        <input class="pacs-input" :value="profile.name" @input="emit('updateProfile', { name: ($event.target as HTMLInputElement).value })" />
      </label>
      <label class="grid gap-1.5">
        <span class="pacs-form-label">Protocol</span>
        <select class="pacs-input" :value="profile.protocol" @change="emit('updateProfile', { protocol: ($event.target as HTMLSelectElement).value as PacsProtocol })">
          <option value="dicomweb">DICOMweb</option>
          <option value="dimse">DIMSE</option>
        </select>
      </label>
      <label v-if="profile.protocol === 'dicomweb'" class="grid gap-1.5">
        <span class="pacs-form-label">{{ isZh ? '类型' : 'Type' }}</span>
        <select class="pacs-input" :value="profile.preset" @change="emit('updateProfile', { preset: ($event.target as HTMLSelectElement).value as PacsProfilePreset })">
          <option value="orthanc">Orthanc</option>
          <option value="dcm4chee">dcm4chee</option>
          <option value="custom">{{ isZh ? '自定义' : 'Custom' }}</option>
        </select>
      </label>
      <label v-if="profile.protocol === 'dicomweb'" class="grid gap-1.5 md:col-span-2">
        <span class="pacs-form-label">Base URL</span>
        <input class="pacs-input" placeholder="http://127.0.0.1:8042" :value="profile.baseUrl" @input="emit('updateProfile', { baseUrl: ($event.target as HTMLInputElement).value })" />
      </label>
      <label v-if="profile.protocol === 'dicomweb'" class="grid gap-1.5">
        <span class="pacs-form-label">QIDO Path</span>
        <input class="pacs-input" placeholder="/dicom-web" :value="profile.qidoPath" @input="emit('updateProfile', { qidoPath: ($event.target as HTMLInputElement).value })" />
      </label>
      <label v-if="profile.protocol === 'dicomweb'" class="grid gap-1.5">
        <span class="pacs-form-label">WADO Path</span>
        <input class="pacs-input" placeholder="/dicom-web" :value="profile.wadoPath" @input="emit('updateProfile', { wadoPath: ($event.target as HTMLInputElement).value })" />
      </label>
      <label v-if="profile.protocol === 'dicomweb'" class="grid gap-1.5">
        <span class="pacs-form-label">{{ isZh ? '认证' : 'Auth' }}</span>
        <select class="pacs-input" :value="profile.authType" @change="emit('updateProfile', { authType: ($event.target as HTMLSelectElement).value as PacsAuthType })">
          <option value="none">{{ isZh ? '无认证' : 'None' }}</option>
          <option value="basic">Basic</option>
          <option value="bearer">Bearer</option>
        </select>
      </label>
      <template v-if="profile.protocol === 'dimse'">
        <label class="grid gap-1.5">
          <span class="pacs-form-label">Host</span>
          <input class="pacs-input" placeholder="127.0.0.1" :value="profile.host" @input="emit('updateProfile', { host: ($event.target as HTMLInputElement).value })" />
        </label>
        <label class="grid gap-1.5">
          <span class="pacs-form-label">Port</span>
          <input class="pacs-input" type="number" min="1" max="65535" :value="profile.port" @input="emit('updateProfile', { port: Number(($event.target as HTMLInputElement).value) })" />
        </label>
        <label class="grid gap-1.5">
          <span class="pacs-form-label">Called AE</span>
          <input class="pacs-input" maxlength="16" placeholder="ORTHANC" :value="profile.calledAeTitle" @input="emit('updateProfile', { calledAeTitle: ($event.target as HTMLInputElement).value })" />
        </label>
        <label class="grid gap-1.5">
          <span class="pacs-form-label">Client AE</span>
          <input class="pacs-input" maxlength="16" placeholder="DICOMVISION" :value="profile.clientAeTitle" @input="emit('updateProfile', { clientAeTitle: ($event.target as HTMLInputElement).value })" />
        </label>
        <label class="grid gap-1.5">
          <span class="pacs-form-label">Query Model</span>
          <select class="pacs-input" :value="profile.queryModel" @change="emit('updateProfile', { queryModel: ($event.target as HTMLSelectElement).value as DimseQueryModel })">
            <option value="study-root">Study Root</option>
            <option value="patient-root">Patient Root</option>
          </select>
        </label>
      </template>
      <label class="grid gap-1.5">
        <span class="pacs-form-label">{{ isZh ? '超时秒数' : 'Timeout' }}</span>
        <input class="pacs-input" type="number" min="1" max="60" :value="profile.timeoutSeconds" @input="emit('updateProfile', { timeoutSeconds: Number(($event.target as HTMLInputElement).value) })" />
      </label>
      <template v-if="profile.protocol === 'dicomweb' && profile.authType === 'basic'">
        <label class="grid gap-1.5">
          <span class="pacs-form-label">{{ isZh ? '用户名' : 'Username' }}</span>
          <input class="pacs-input" :value="profile.username" @input="emit('updateProfile', { username: ($event.target as HTMLInputElement).value })" />
        </label>
        <label class="grid gap-1.5">
          <span class="pacs-form-label">{{ isZh ? '密码' : 'Password' }}</span>
          <input class="pacs-input" type="password" :value="profile.password" @input="emit('updateProfile', { password: ($event.target as HTMLInputElement).value })" />
        </label>
      </template>
      <label v-else-if="profile.protocol === 'dicomweb' && profile.authType === 'bearer'" class="grid gap-1.5 md:col-span-2">
        <span class="pacs-form-label">Bearer Token</span>
        <input class="pacs-input" type="password" :value="profile.bearerToken" @input="emit('updateProfile', { bearerToken: ($event.target as HTMLInputElement).value })" />
      </label>
    </div>

    <div
      v-if="testResult"
      class="mt-4 rounded-2xl border px-4 py-3 text-sm"
      :class="testResult.ok ? 'border-[color:color-mix(in_srgb,#22c55e_34%,var(--theme-border-soft))] text-[color:color-mix(in_srgb,#22c55e_72%,var(--theme-text-primary))]' : 'border-[color:color-mix(in_srgb,#ef4444_34%,var(--theme-border-soft))] text-[color:color-mix(in_srgb,#ef4444_72%,var(--theme-text-primary))]'"
    >
      {{ testResult.message }}
    </div>

    <div v-if="mode === 'create'" class="mt-4 flex flex-wrap justify-end gap-2 border-t border-[var(--theme-border-soft)] pt-4">
      <button type="button" class="theme-button-secondary rounded-2xl px-4 py-2 text-sm font-semibold" @click="emit('reset')">
        {{ isZh ? '重置' : 'Reset' }}
      </button>
      <button type="button" class="theme-button-secondary rounded-2xl px-4 py-2 text-sm font-semibold" @click="emit('cancel')">
        {{ isZh ? '取消' : 'Cancel' }}
      </button>
      <button type="button" class="theme-button-primary rounded-2xl px-4 py-2 text-sm font-semibold" @click="emit('save')">
        {{ isZh ? '确定保存' : 'Save Profile' }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.pacs-form-label {
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.pacs-input {
  min-height: 42px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 16px;
  background: var(--theme-surface-panel);
  padding: 0 12px;
  color: var(--theme-text-primary);
  font-size: 13px;
  font-weight: 600;
  outline: none;
}

.pacs-input:focus {
  border-color: color-mix(in srgb, var(--theme-accent) 52%, var(--theme-border-strong));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--theme-accent) 24%, transparent);
}
</style>
