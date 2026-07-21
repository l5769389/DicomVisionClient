<script setup lang="ts">
import { ref } from 'vue'
import { VMenu } from 'vuetify/components'
import AppIcon from '../../AppIcon.vue'
import type {
  DimseQueryModel,
  PacsAuthType,
  PacsDicomwebProfile,
  PacsProfilePreset,
  PacsProtocol
} from '../../../composables/ui/useUiPreferences'
import { pacsProfileEndpoint, pacsProfilePresetConnectionPatch } from '../../../composables/pacs/pacsProfileUtils'

const props = defineProps<{
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

type PacsProfileSelectKey = 'protocol' | 'preset' | 'authType' | 'queryModel'

interface PacsProfileSelectOption<T extends string = string> {
  label: string
  value: T
}

const protocolOptions: PacsProfileSelectOption<PacsProtocol>[] = [
  { label: 'DICOMweb', value: 'dicomweb' },
  { label: 'DIMSE', value: 'dimse' }
]
const presetOptions: PacsProfileSelectOption<PacsProfilePreset>[] = [
  { label: 'Orthanc', value: 'orthanc' },
  { label: 'dcm4chee', value: 'dcm4chee' },
  { label: 'Custom', value: 'custom' }
]
const queryModelOptions: PacsProfileSelectOption<DimseQueryModel>[] = [
  { label: 'Study Root', value: 'study-root' },
  { label: 'Patient Root', value: 'patient-root' }
]
const openSelectKey = ref<PacsProfileSelectKey | null>(null)

function getAuthOptions(isZh: boolean): PacsProfileSelectOption<PacsAuthType>[] {
  return [
    { label: isZh ? '无认证' : 'None', value: 'none' },
    { label: 'Basic', value: 'basic' },
    { label: 'Bearer', value: 'bearer' }
  ]
}

function getSelectLabel<T extends string>(options: PacsProfileSelectOption<T>[], value: T | null | undefined): string {
  return options.find((option) => option.value === value)?.label ?? ''
}

function getPresetLabel(value: PacsProfilePreset | null | undefined): string {
  if (value === 'custom') {
    return props.isZh ? '自定义' : 'Custom'
  }
  return getSelectLabel(presetOptions, value)
}

function getQueryModelLabel(value: DimseQueryModel | null | undefined): string {
  if (!props.isZh) {
    return getSelectLabel(queryModelOptions, value)
  }
  if (value === 'study-root') return '检查根'
  if (value === 'patient-root') return '患者根'
  return ''
}

function setSelectOpen(key: PacsProfileSelectKey, isOpen: boolean): void {
  openSelectKey.value = isOpen ? key : null
}

function isSelectOpen(key: PacsProfileSelectKey): boolean {
  return openSelectKey.value === key
}

function closeSelectMenu(): void {
  openSelectKey.value = null
}

function selectProtocol(value: PacsProtocol): void {
  emit('updateProfile', {
    protocol: value,
    ...pacsProfilePresetConnectionPatch(props.profile.preset)
  })
  closeSelectMenu()
}

function selectPreset(value: PacsProfilePreset): void {
  emit('updateProfile', {
    preset: value,
    ...pacsProfilePresetConnectionPatch(value)
  })
  closeSelectMenu()
}

function selectAuthType(value: PacsAuthType): void {
  emit('updateProfile', { authType: value })
  closeSelectMenu()
}

function selectQueryModel(value: DimseQueryModel): void {
  emit('updateProfile', { queryModel: value })
  closeSelectMenu()
}
</script>

<template>
  <article class="rounded-[24px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] p-4">
    <div class="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div class="min-w-0">
        <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ mode === 'create' ? (isZh ? '新增 PACS 配置' : 'New PACS Profile') : (isZh ? '配置详情' : 'Profile Details') }}</div>
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
      <div class="grid gap-1.5">
        <span class="pacs-form-label">{{ isZh ? '协议' : 'Protocol' }}</span>
        <VMenu
          :model-value="isSelectOpen('protocol')"
          location="bottom start"
          :offset="8"
          scroll-strategy="reposition"
          :close-on-content-click="true"
          @update:model-value="setSelectOpen('protocol', $event)"
        >
          <template #activator="{ props: menuProps }">
            <button
              v-bind="menuProps"
              type="button"
              class="pacs-select-trigger"
              :class="{ 'pacs-select-trigger--open': isSelectOpen('protocol') }"
            >
              <span class="truncate">{{ getSelectLabel(protocolOptions, profile.protocol) }}</span>
              <AppIcon name="chevron-down" :size="17" />
            </button>
          </template>
          <div class="pacs-select-menu theme-shell-panel border">
            <button
              v-for="option in protocolOptions"
              :key="option.value"
              type="button"
              role="radio"
              :aria-checked="option.value === profile.protocol"
              class="toolbar-menu-option pacs-select-option"
              :class="{ 'toolbar-menu-option--active pacs-select-option--active': option.value === profile.protocol }"
              @click="selectProtocol(option.value)"
            >
              <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
              <AppIcon v-if="option.value === profile.protocol" name="check" :size="14" />
            </button>
          </div>
        </VMenu>
      </div>
      <div class="grid gap-1.5">
        <span class="pacs-form-label">{{ isZh ? '类型' : 'Type' }}</span>
        <VMenu
          :model-value="isSelectOpen('preset')"
          location="bottom start"
          :offset="8"
          scroll-strategy="reposition"
          :close-on-content-click="true"
          @update:model-value="setSelectOpen('preset', $event)"
        >
          <template #activator="{ props: menuProps }">
            <button
              v-bind="menuProps"
              type="button"
              class="pacs-select-trigger"
              :class="{ 'pacs-select-trigger--open': isSelectOpen('preset') }"
            >
              <span class="truncate">{{ getPresetLabel(profile.preset) }}</span>
              <AppIcon name="chevron-down" :size="17" />
            </button>
          </template>
          <div class="pacs-select-menu theme-shell-panel border">
            <button
              v-for="option in presetOptions"
              :key="option.value"
              type="button"
              role="radio"
              :aria-checked="option.value === profile.preset"
              class="toolbar-menu-option pacs-select-option"
              :class="{ 'toolbar-menu-option--active pacs-select-option--active': option.value === profile.preset }"
              @click="selectPreset(option.value)"
            >
              <span class="min-w-0 flex-1 truncate">{{ getPresetLabel(option.value) }}</span>
              <AppIcon v-if="option.value === profile.preset" name="check" :size="14" />
            </button>
          </div>
        </VMenu>
      </div>
      <label v-if="profile.protocol === 'dicomweb'" class="grid gap-1.5 md:col-span-2">
        <span class="pacs-form-label">{{ isZh ? '基础 URL' : 'Base URL' }}</span>
        <input class="pacs-input" placeholder="http://127.0.0.1:8042" :value="profile.baseUrl" @input="emit('updateProfile', { baseUrl: ($event.target as HTMLInputElement).value })" />
      </label>
      <label v-if="profile.protocol === 'dicomweb'" class="grid gap-1.5">
        <span class="pacs-form-label">{{ isZh ? 'QIDO 路径' : 'QIDO Path' }}</span>
        <input class="pacs-input" placeholder="/dicom-web" :value="profile.qidoPath" @input="emit('updateProfile', { qidoPath: ($event.target as HTMLInputElement).value })" />
      </label>
      <label v-if="profile.protocol === 'dicomweb'" class="grid gap-1.5">
        <span class="pacs-form-label">{{ isZh ? 'WADO 路径' : 'WADO Path' }}</span>
        <input class="pacs-input" placeholder="/dicom-web" :value="profile.wadoPath" @input="emit('updateProfile', { wadoPath: ($event.target as HTMLInputElement).value })" />
      </label>
      <div v-if="profile.protocol === 'dicomweb'" class="grid gap-1.5">
        <span class="pacs-form-label">{{ isZh ? '认证' : 'Auth' }}</span>
        <VMenu
          :model-value="isSelectOpen('authType')"
          location="bottom start"
          :offset="8"
          scroll-strategy="reposition"
          :close-on-content-click="true"
          @update:model-value="setSelectOpen('authType', $event)"
        >
          <template #activator="{ props: menuProps }">
            <button
              v-bind="menuProps"
              type="button"
              class="pacs-select-trigger"
              :class="{ 'pacs-select-trigger--open': isSelectOpen('authType') }"
            >
              <span class="truncate">{{ getSelectLabel(getAuthOptions(isZh), profile.authType) }}</span>
              <AppIcon name="chevron-down" :size="17" />
            </button>
          </template>
          <div class="pacs-select-menu theme-shell-panel border">
            <button
              v-for="option in getAuthOptions(isZh)"
              :key="option.value"
              type="button"
              role="radio"
              :aria-checked="option.value === profile.authType"
              class="toolbar-menu-option pacs-select-option"
              :class="{ 'toolbar-menu-option--active pacs-select-option--active': option.value === profile.authType }"
              @click="selectAuthType(option.value)"
            >
              <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
              <AppIcon v-if="option.value === profile.authType" name="check" :size="14" />
            </button>
          </div>
        </VMenu>
      </div>
      <template v-if="profile.protocol === 'dimse'">
        <label class="grid gap-1.5">
          <span class="pacs-form-label">{{ isZh ? '主机' : 'Host' }}</span>
          <input class="pacs-input" placeholder="127.0.0.1" :value="profile.host" @input="emit('updateProfile', { host: ($event.target as HTMLInputElement).value })" />
        </label>
        <label class="grid gap-1.5">
          <span class="pacs-form-label">{{ isZh ? '端口' : 'Port' }}</span>
          <input class="pacs-input" type="number" min="1" max="65535" :value="profile.port" @input="emit('updateProfile', { port: Number(($event.target as HTMLInputElement).value) })" />
        </label>
        <label class="grid gap-1.5">
          <span class="pacs-form-label">{{ isZh ? '被叫 AE' : 'Called AE' }}</span>
          <input class="pacs-input" maxlength="16" placeholder="ORTHANC" :value="profile.calledAeTitle" @input="emit('updateProfile', { calledAeTitle: ($event.target as HTMLInputElement).value })" />
        </label>
        <label class="grid gap-1.5">
          <span class="pacs-form-label">{{ isZh ? '本机 AE' : 'Client AE' }}</span>
          <input class="pacs-input" maxlength="16" placeholder="DICOMVISION" :value="profile.clientAeTitle" @input="emit('updateProfile', { clientAeTitle: ($event.target as HTMLInputElement).value })" />
        </label>
        <div class="grid gap-1.5">
          <span class="pacs-form-label">{{ isZh ? '查询模型' : 'Query Model' }}</span>
          <VMenu
            :model-value="isSelectOpen('queryModel')"
            location="bottom start"
            :offset="8"
            scroll-strategy="reposition"
            :close-on-content-click="true"
            @update:model-value="setSelectOpen('queryModel', $event)"
          >
            <template #activator="{ props: menuProps }">
              <button
                v-bind="menuProps"
                type="button"
                class="pacs-select-trigger"
                :class="{ 'pacs-select-trigger--open': isSelectOpen('queryModel') }"
              >
                <span class="truncate">{{ getQueryModelLabel(profile.queryModel) }}</span>
                <AppIcon name="chevron-down" :size="17" />
              </button>
            </template>
            <div class="pacs-select-menu theme-shell-panel border">
              <button
                v-for="option in queryModelOptions"
                :key="option.value"
                type="button"
                role="radio"
                :aria-checked="option.value === profile.queryModel"
                class="toolbar-menu-option pacs-select-option"
                :class="{ 'toolbar-menu-option--active pacs-select-option--active': option.value === profile.queryModel }"
                @click="selectQueryModel(option.value)"
              >
                <span class="min-w-0 flex-1 truncate">{{ getQueryModelLabel(option.value) }}</span>
                <AppIcon v-if="option.value === profile.queryModel" name="check" :size="14" />
              </button>
            </div>
          </VMenu>
        </div>
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
        <span class="pacs-form-label">{{ isZh ? '访问令牌' : 'Bearer Token' }}</span>
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

.pacs-select-trigger {
  display: flex;
  min-height: 42px;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 16px;
  background: var(--theme-surface-card);
  padding: 0 12px;
  color: var(--theme-text-primary);
  font-size: 13px;
  font-weight: 600;
  outline: none;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    box-shadow 150ms ease,
    color 150ms ease;
}

.pacs-select-trigger:hover,
.pacs-select-trigger--open {
  border-color: color-mix(in srgb, var(--theme-accent) 38%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 7%, var(--theme-surface-card));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--theme-accent) 16%, transparent);
}

.pacs-select-trigger:focus-visible {
  border-color: color-mix(in srgb, var(--theme-accent) 52%, var(--theme-border-strong));
  box-shadow: var(--theme-focus-ring);
}

.pacs-select-trigger:disabled {
  cursor: not-allowed;
  color: var(--theme-text-muted);
  opacity: 0.72;
}

.pacs-select-trigger :deep(.app-icon-svg) {
  transition: transform 150ms ease;
}

.pacs-select-trigger--open :deep(.app-icon-svg) {
  transform: rotate(180deg);
}

.pacs-select-menu {
  display: grid;
  width: min(290px, calc(100vw - 48px));
  gap: 4px;
  overflow: hidden;
  border-color: color-mix(in srgb, var(--theme-border-strong) 74%, transparent) !important;
  border-radius: 18px;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-surface-card) 92%, white 4%),
      color-mix(in srgb, var(--theme-surface-panel-solid) 94%, black 6%)
    );
  padding: 6px;
  box-shadow:
    0 24px 52px rgba(2, 8, 18, 0.38),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(18px);
}

.pacs-select-option {
  position: relative;
  display: flex;
  min-height: 38px;
  width: 100%;
  align-items: center;
  gap: 10px;
  border: 1px solid transparent;
  border-radius: 14px;
  background: transparent;
  padding: 0 10px 0 12px;
  color: var(--theme-text-secondary);
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease,
    box-shadow 150ms ease;
}

.pacs-select-option:hover {
  border-color: color-mix(in srgb, var(--theme-accent) 20%, transparent);
  background: color-mix(in srgb, var(--theme-accent) 9%, transparent);
  color: var(--theme-text-primary);
}

.pacs-select-option--active {
  color: var(--theme-active-foreground);
}

</style>
