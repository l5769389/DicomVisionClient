<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '../../AppIcon.vue'
import PacsProfileForm from './PacsProfileForm.vue'
import { toApiPacsDicomwebProfile, toApiPacsDimseProfile } from '../../../composables/pacs/pacsProfileApi'
import { createPacsProfile, pacsAuthLabel, pacsPresetLabel, pacsProfileEndpoint } from '../../../composables/pacs/pacsProfileUtils'
import { useUiLocale } from '../../../composables/ui/useUiLocale'
import { type PacsDicomwebProfile, useUiPreferences } from '../../../composables/ui/useUiPreferences'
import { postApi } from '../../../services/typedApi'

type PacsTestResult = { ok: boolean; message: string }

const { locale } = useUiLocale()
const { pacsPreference, setPacsPreference } = useUiPreferences()

const draftProfile = ref<PacsDicomwebProfile | null>(null)
const editingProfileId = ref<string | null>(null)
const selectedProfileIds = ref<string[]>([])
const testingProfileIds = ref<string[]>([])
const testResults = ref<Record<string, PacsTestResult>>({})

const isZh = computed(() => locale.value === 'zh-CN')
const activeProfile = computed(() => (
  pacsPreference.value.profiles.find((profile) => profile.id === pacsPreference.value.activeProfileId) ??
  pacsPreference.value.profiles[0] ??
  null
))
const editingProfile = computed(() => (
  editingProfileId.value
    ? pacsPreference.value.profiles.find((profile) => profile.id === editingProfileId.value) ?? null
    : null
))
const editingProfileTestResult = computed(() => (
  editingProfile.value ? testResults.value[editingProfile.value.id] ?? null : null
))
const draftProfileTestResult = computed(() => (
  draftProfile.value ? testResults.value[draftProfile.value.id] ?? null : null
))
const enabledProfileCount = computed(() => pacsPreference.value.profiles.filter((profile) => profile.enabled).length)
const selectedProfileIdSet = computed(() => new Set(selectedProfileIds.value))
const selectedProfiles = computed(() => pacsPreference.value.profiles.filter((profile) => selectedProfileIdSet.value.has(profile.id)))
const selectedProfileCount = computed(() => selectedProfiles.value.length)
const areAllProfilesSelected = computed(() => (
  pacsPreference.value.profiles.length > 0 &&
  selectedProfileCount.value === pacsPreference.value.profiles.length
))
const canDeleteSelectedProfiles = computed(() => (
  selectedProfileCount.value > 0 &&
  selectedProfileCount.value < pacsPreference.value.profiles.length
))
const isTestingSelectedProfiles = computed(() => (
  selectedProfiles.value.length > 0 &&
  selectedProfiles.value.some((profile) => testingProfileIds.value.includes(profile.id))
))

function updatePreference(patch: Partial<typeof pacsPreference.value>): void {
  setPacsPreference({
    ...pacsPreference.value,
    ...patch
  })
}

function updateProfile(profileId: string, patch: Partial<PacsDicomwebProfile>): void {
  setPacsPreference({
    ...pacsPreference.value,
    profiles: pacsPreference.value.profiles.map((profile) => (
      profile.id === profileId ? { ...profile, ...patch } : profile
    ))
  })
}

function updateDraftProfile(patch: Partial<PacsDicomwebProfile>): void {
  if (!draftProfile.value) return
  draftProfile.value = { ...draftProfile.value, ...patch }
}

function startCreateProfile(): void {
  draftProfile.value = createPacsProfile('custom', isZh.value)
  editingProfileId.value = null
}

function saveDraftProfile(): void {
  if (!draftProfile.value) return
  const profile = {
    ...draftProfile.value,
    name: draftProfile.value.name.trim() || (isZh.value ? '新 PACS 配置' : 'New PACS Profile')
  }
  setPacsPreference({
    ...pacsPreference.value,
    enabled: true,
    profiles: [...pacsPreference.value.profiles, profile]
  })
  draftProfile.value = null
  editingProfileId.value = profile.id
}

function resetDraftProfile(): void {
  draftProfile.value = createPacsProfile('custom', isZh.value)
}

function cancelDraftProfile(): void {
  if (draftProfile.value) {
    removeTestResults([draftProfile.value.id])
  }
  draftProfile.value = null
}

function removeSelectedProfiles(): void {
  const removingIds = new Set(selectedProfileIds.value)
  if (!removingIds.size || removingIds.size >= pacsPreference.value.profiles.length) {
    return
  }
  const nextProfiles = pacsPreference.value.profiles.filter((profile) => !removingIds.has(profile.id))
  setPacsPreference({
    ...pacsPreference.value,
    profiles: nextProfiles,
    activeProfileId: removingIds.has(pacsPreference.value.activeProfileId)
      ? nextProfiles[0]?.id ?? ''
      : pacsPreference.value.activeProfileId
  })
  if (editingProfileId.value && removingIds.has(editingProfileId.value)) {
    editingProfileId.value = null
  }
  selectedProfileIds.value = []
  removeTestResults([...removingIds])
}

function setDefaultProfile(profileId: string): void {
  updatePreference({ activeProfileId: profileId })
}

function openProfileDetail(profileId: string): void {
  draftProfile.value = null
  editingProfileId.value = profileId
}

function closeProfileDetail(): void {
  editingProfileId.value = null
}

function toggleAllProfiles(checked: boolean): void {
  selectedProfileIds.value = checked ? pacsPreference.value.profiles.map((profile) => profile.id) : []
}

function toggleProfileSelection(profileId: string, checked: boolean): void {
  selectedProfileIds.value = checked
    ? [...new Set([...selectedProfileIds.value, profileId])]
    : selectedProfileIds.value.filter((id) => id !== profileId)
}

function removeTestResults(profileIds: string[]): void {
  const removingIds = new Set(profileIds)
  testResults.value = Object.fromEntries(
    Object.entries(testResults.value).filter(([profileId]) => !removingIds.has(profileId))
  )
}

async function testProfile(profile: PacsDicomwebProfile): Promise<void> {
  testingProfileIds.value = [...new Set([...testingProfileIds.value, profile.id])]
  removeTestResults([profile.id])
  try {
    const response = profile.protocol === 'dimse'
      ? await postApi('TestDimseConnectionApiV1PacsDimseTestPost', {
          profile: toApiPacsDimseProfile(profile)
        })
      : await postApi('TestDicomwebConnectionApiV1PacsDicomwebTestPost', {
          profile: toApiPacsDicomwebProfile(profile)
        })
    testResults.value = {
      ...testResults.value,
      [profile.id]: {
        ok: response.ok,
        message: response.message
      }
    }
  } catch (error) {
    testResults.value = {
      ...testResults.value,
      [profile.id]: {
        ok: false,
        message: error instanceof Error ? error.message : (isZh.value ? '连接测试失败' : 'Connection test failed')
      }
    }
  } finally {
    testingProfileIds.value = testingProfileIds.value.filter((id) => id !== profile.id)
  }
}

async function testSelectedProfiles(): Promise<void> {
  for (const profile of selectedProfiles.value) {
    await testProfile(profile)
  }
}

function testResultForProfile(profileId: string): PacsTestResult | null {
  return testResults.value[profileId] ?? null
}

function isTestingProfile(profileId: string): boolean {
  return testingProfileIds.value.includes(profileId)
}
</script>

<template>
  <section class="theme-card-soft rounded-[28px] p-5">
    <div class="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div class="flex min-w-0 items-start gap-3">
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[color:color-mix(in_srgb,var(--theme-accent)_28%,var(--theme-border-soft))] bg-[color:color-mix(in_srgb,var(--theme-accent)_13%,transparent)] text-[var(--theme-accent)]">
          <AppIcon name="pacs" :size="20" />
        </span>
        <div class="min-w-0">
          <div class="text-lg font-semibold text-[var(--theme-text-primary)]">{{ isZh ? '数据源模式' : 'Data Source Modes' }}</div>
          <div class="mt-1 text-sm leading-6 text-[var(--theme-text-secondary)]">
            {{ isZh ? '本地文件和 PACS 可以同时启用；侧边栏会按启用状态显示入口。' : 'Local files and PACS can be enabled together; the sidebar shows entries based on these switches.' }}
          </div>
        </div>
      </div>
      <span class="w-fit rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-secondary)]">
        {{ enabledProfileCount }} / {{ pacsPreference.profiles.length }}
      </span>
    </div>

    <div class="grid gap-4">
      <div class="grid gap-3 lg:grid-cols-2">
        <label class="settings-choice-card flex cursor-pointer items-center justify-between gap-4 rounded-[6px] border px-5 py-4 transition" :class="{ 'settings-choice-card--active': pacsPreference.localSourceEnabled }">
          <span class="min-w-0">
            <span class="block text-base font-semibold text-[var(--theme-text-primary)]">{{ isZh ? '启用本地文件' : 'Enable Local Files' }}</span>
            <span class="mt-1 block text-xs leading-5 text-[var(--theme-text-secondary)]">{{ isZh ? '显示加载文件夹 / 上传 DICOM 入口。' : 'Show the folder loading / DICOM upload entry.' }}</span>
          </span>
          <input
            class="h-4 w-4 rounded border-[var(--theme-border-soft)] accent-[var(--theme-accent)]"
            type="checkbox"
            :checked="pacsPreference.localSourceEnabled"
            @change="updatePreference({ localSourceEnabled: ($event.target as HTMLInputElement).checked })"
          />
        </label>

        <label class="settings-choice-card flex cursor-pointer items-center justify-between gap-4 rounded-[6px] border px-5 py-4 transition" :class="{ 'settings-choice-card--active': pacsPreference.enabled }">
          <span class="min-w-0">
            <span class="block text-base font-semibold text-[var(--theme-text-primary)]">{{ isZh ? '启用 PACS 浏览器' : 'Enable PACS Browser' }}</span>
            <span class="mt-1 block text-xs leading-5 text-[var(--theme-text-secondary)]">{{ isZh ? '显示 PACS 查询入口。' : 'Show the PACS query entry.' }}</span>
          </span>
          <input
            class="h-4 w-4 rounded border-[var(--theme-border-soft)] accent-[var(--theme-accent)]"
            type="checkbox"
            :checked="pacsPreference.enabled"
            @change="updatePreference({ enabled: ($event.target as HTMLInputElement).checked })"
          />
        </label>
      </div>

      <div class="rounded-[24px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] p-4">
        <div class="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ isZh ? 'PACS 配置' : 'PACS Profiles' }}</div>
            <div class="mt-1 text-xs leading-5 text-[var(--theme-text-secondary)]">{{ isZh ? '勾选配置后，可批量测试或删除。' : 'Select profiles to test or remove them together.' }}</div>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="theme-button-primary rounded-2xl px-4 py-2 text-sm font-semibold" @click="startCreateProfile">
              {{ isZh ? '新增配置' : 'Add Profile' }}
            </button>
            <button
              type="button"
              class="theme-button-secondary rounded-2xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!selectedProfileCount || isTestingSelectedProfiles"
              @click="testSelectedProfiles"
            >
              {{ isTestingSelectedProfiles ? (isZh ? '测试中...' : 'Testing...') : (isZh ? `测试所选 ${selectedProfileCount || ''}` : `Test Selected ${selectedProfileCount || ''}`) }}
            </button>
            <button
              type="button"
              class="theme-button-secondary rounded-2xl px-4 py-2 text-sm font-semibold text-[color:color-mix(in_srgb,#ef4444_72%,var(--theme-text-primary))] disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!canDeleteSelectedProfiles"
              :title="selectedProfileCount >= pacsPreference.profiles.length ? (isZh ? '至少保留一个配置' : 'Keep at least one profile') : undefined"
              @click="removeSelectedProfiles"
            >
              {{ isZh ? `删除所选 ${selectedProfileCount || ''}` : `Remove Selected ${selectedProfileCount || ''}` }}
            </button>
          </div>
        </div>

        <div v-if="activeProfile" class="mb-3 rounded-[18px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-4 py-3 text-xs leading-5 text-[var(--theme-text-secondary)]">
          {{ isZh ? '当前默认：' : 'Default: ' }}<span class="font-semibold text-[var(--theme-text-primary)]">{{ activeProfile.name }}</span>
          <span class="mx-2 text-[var(--theme-text-muted)]">/</span>
          <span class="break-all">{{ pacsProfileEndpoint(activeProfile) }}</span>
        </div>

        <div class="overflow-hidden rounded-[18px] border border-[var(--theme-border-soft)]">
          <div class="pacs-profile-header">
            <label class="flex items-center gap-2 text-xs font-semibold text-[var(--theme-text-secondary)]">
              <input
                class="h-4 w-4 rounded border-[var(--theme-border-soft)] accent-[var(--theme-accent)]"
                type="checkbox"
                :checked="areAllProfilesSelected"
                :indeterminate="selectedProfileCount > 0 && !areAllProfilesSelected"
                @change="toggleAllProfiles(($event.target as HTMLInputElement).checked)"
              />
              {{ isZh ? `已选 ${selectedProfileCount}` : `${selectedProfileCount} selected` }}
            </label>
            <span class="hidden text-xs font-semibold uppercase tracking-[0.14em] text-[var(--theme-text-muted)] md:block">{{ isZh ? '连接配置' : 'Connection' }}</span>
            <span class="hidden text-right text-xs font-semibold uppercase tracking-[0.14em] text-[var(--theme-text-muted)] md:block">{{ isZh ? '操作' : 'Actions' }}</span>
          </div>

          <article
            v-for="profile in pacsPreference.profiles"
            :key="profile.id"
            class="pacs-profile-row"
            :class="{ 'pacs-profile-row--editing': editingProfileId === profile.id }"
          >
            <label class="flex shrink-0 items-center gap-2 text-xs font-semibold text-[var(--theme-text-secondary)]">
              <input
                class="h-4 w-4 rounded border-[var(--theme-border-soft)] accent-[var(--theme-accent)]"
                type="checkbox"
                :checked="selectedProfileIds.includes(profile.id)"
                @change="toggleProfileSelection(profile.id, ($event.target as HTMLInputElement).checked)"
              />
              <span class="sr-only">{{ profile.name }}</span>
            </label>

            <button type="button" class="min-w-0 flex-1 text-left" @click="openProfileDetail(profile.id)">
              <span class="flex min-w-0 flex-wrap items-center gap-2">
                <span class="truncate text-sm font-semibold text-[var(--theme-text-primary)]">{{ profile.name }}</span>
                <span v-if="profile.id === pacsPreference.activeProfileId" class="pacs-chip pacs-chip--accent">{{ isZh ? '默认' : 'Default' }}</span>
                <span class="pacs-chip">{{ profile.protocol === 'dimse' ? 'DIMSE' : 'DICOMweb' }}</span>
                <span class="pacs-chip">{{ profile.enabled ? (isZh ? '启用' : 'On') : (isZh ? '停用' : 'Off') }}</span>
                <span class="pacs-chip">{{ pacsPresetLabel(profile.preset, isZh) }}</span>
                <span class="pacs-chip">{{ pacsAuthLabel(profile.authType, isZh) }}</span>
              </span>
              <span class="mt-1 block truncate text-xs text-[var(--theme-text-muted)]" :title="pacsProfileEndpoint(profile)">{{ pacsProfileEndpoint(profile) }}</span>
            </button>

            <div class="flex shrink-0 flex-wrap justify-end gap-2">
              <label class="theme-button-secondary flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold">
                <input
                  class="h-3.5 w-3.5 rounded border-[var(--theme-border-soft)] accent-[var(--theme-accent)]"
                  type="checkbox"
                  :checked="profile.enabled"
                  @change="updateProfile(profile.id, { enabled: ($event.target as HTMLInputElement).checked })"
                />
                {{ isZh ? '启用' : 'Enable' }}
              </label>
              <button type="button" class="theme-button-secondary rounded-2xl px-3 py-2 text-xs font-semibold" @click="openProfileDetail(profile.id)">
                {{ isZh ? '详情' : 'Details' }}
              </button>
              <button
                type="button"
                class="theme-button-secondary rounded-2xl px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="profile.id === pacsPreference.activeProfileId"
                @click="setDefaultProfile(profile.id)"
              >
                {{ isZh ? '设默认' : 'Set Default' }}
              </button>
            </div>

            <div
              v-if="testResultForProfile(profile.id) && editingProfileId !== profile.id"
              class="md:col-span-3 rounded-2xl border px-4 py-3 text-sm"
              :class="testResultForProfile(profile.id)?.ok ? 'border-[color:color-mix(in_srgb,#22c55e_34%,var(--theme-border-soft))] text-[color:color-mix(in_srgb,#22c55e_72%,var(--theme-text-primary))]' : 'border-[color:color-mix(in_srgb,#ef4444_34%,var(--theme-border-soft))] text-[color:color-mix(in_srgb,#ef4444_72%,var(--theme-text-primary))]'"
            >
              {{ isTestingProfile(profile.id) ? (isZh ? '正在测试连接...' : 'Testing connection...') : testResultForProfile(profile.id)?.message }}
            </div>
          </article>
        </div>
      </div>

      <PacsProfileForm
        v-if="draftProfile"
        mode="create"
        :is-testing="isTestingProfile(draftProfile.id)"
        :is-zh="isZh"
        :profile="draftProfile"
        :test-result="draftProfileTestResult"
        @cancel="cancelDraftProfile"
        @reset="resetDraftProfile"
        @save="saveDraftProfile"
        @test="testProfile(draftProfile)"
        @update-profile="updateDraftProfile"
      />

      <PacsProfileForm
        v-else-if="editingProfile"
        mode="edit"
        :is-testing="isTestingProfile(editingProfile.id)"
        :is-zh="isZh"
        :profile="editingProfile"
        :test-result="editingProfileTestResult"
        @cancel="closeProfileDetail"
        @test="testProfile(editingProfile)"
        @update-profile="updateProfile(editingProfile.id, $event)"
      />
    </div>
  </section>
</template>

<style scoped>
.pacs-profile-header,
.pacs-profile-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}

.pacs-profile-header {
  padding: 10px 16px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 86%, transparent);
  border-bottom: 1px solid var(--theme-border-soft);
}

.pacs-profile-row {
  padding: 14px 16px;
  background: var(--theme-surface-panel);
  border-bottom: 1px solid var(--theme-border-soft);
  transition:
    background 0.16s ease,
    box-shadow 0.16s ease;
}

.pacs-profile-row:last-child {
  border-bottom: 0;
}

.pacs-profile-row:hover,
.pacs-profile-row--editing {
  background: color-mix(in srgb, var(--theme-accent) 10%, var(--theme-surface-panel));
  box-shadow: inset 3px 0 0 var(--theme-accent);
}

.pacs-chip {
  border: 1px solid var(--theme-border-soft);
  border-radius: 999px;
  background: var(--theme-surface-card);
  padding: 2px 8px;
  color: var(--theme-text-secondary);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.pacs-chip--accent {
  border-color: color-mix(in srgb, var(--theme-accent) 38%, var(--theme-border-soft));
  background: color-mix(in srgb, var(--theme-accent) 14%, var(--theme-surface-card));
  color: var(--theme-accent);
}

@media (max-width: 900px) {
  .pacs-profile-header,
  .pacs-profile-row {
    grid-template-columns: 1fr;
  }
}
</style>
