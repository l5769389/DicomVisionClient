<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '../../AppIcon.vue'
import type { FusionRegistrationExportMode } from '../../../services/typedApi'

const props = defineProps<{
  canOpenFolder?: boolean
  error?: string | null
  isOpen: boolean
  isSaving?: boolean
  isWeb?: boolean
  mode: FusionRegistrationExportMode
  outputDirectory: string
  savedDirectory?: string | null
  seriesDescription: string
  sourceSeriesDescription: string
}>()

const emit = defineEmits<{
  browse: []
  close: []
  openFolder: []
  save: []
  'update:mode': [value: FusionRegistrationExportMode]
  'update:outputDirectory': [value: string]
  'update:seriesDescription': [value: string]
}>()

const canSave = computed(() => {
  if (props.isSaving) {
    return false
  }
  const hasModeFields = props.mode === 'br' || Boolean(props.seriesDescription.trim())
  return hasModeFields && (props.isWeb || Boolean(props.outputDirectory.trim()))
})

const saveButtonLabel = computed(() => {
  if (props.isSaving) {
    return props.isWeb ? '生成中...' : '保存中...'
  }
  return props.isWeb ? '下载' : '保存'
})
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fusion-registration-save-dialog" role="presentation">
      <section
        class="fusion-registration-save-dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fusion-registration-save-title"
      >
        <header class="fusion-registration-save-dialog__header">
          <div class="fusion-registration-save-dialog__title">
            <span class="fusion-registration-save-dialog__title-icon">
              <AppIcon name="save" :size="17" />
            </span>
            <h2 id="fusion-registration-save-title">保存配准结果</h2>
          </div>
          <button
            type="button"
            class="fusion-registration-save-dialog__icon-button"
            aria-label="关闭"
            :disabled="isSaving"
            @click="emit('close')"
          >
            <AppIcon name="close" :size="18" />
          </button>
        </header>

        <div class="fusion-registration-save-dialog__body">
          <div class="fusion-registration-save-dialog__group">
            <div class="fusion-registration-save-dialog__group-title">保存方式</div>

            <label class="fusion-registration-save-dialog__choice fusion-registration-save-dialog__choice--disabled">
              <input type="radio" value="sourceDicom" disabled />
              <span class="fusion-registration-save-dialog__radio" />
              <span class="fusion-registration-save-dialog__choice-text">
                <strong>写入原始 DICOM</strong>
                <small>序列描述：{{ sourceSeriesDescription }}。当前安全策略不覆盖源文件。</small>
              </span>
            </label>

            <label class="fusion-registration-save-dialog__choice">
              <input
                data-testid="new-dicom-radio"
                type="radio"
                name="fusion-registration-save-mode"
                value="newDicom"
                :checked="mode === 'newDicom'"
                :disabled="isSaving"
                @change="emit('update:mode', 'newDicom')"
              />
              <span class="fusion-registration-save-dialog__radio" />
              <span class="fusion-registration-save-dialog__choice-text">
                <strong>另存为新的 DICOM</strong>
                <small>按当前 CT 网格、PET 单位和配准参数生成派生序列。</small>
              </span>
            </label>

            <div class="fusion-registration-save-dialog__field fusion-registration-save-dialog__field--indented">
              <label for="fusion-registration-series-description">新序列描述</label>
              <input
                id="fusion-registration-series-description"
                data-testid="series-description-input"
                class="fusion-registration-save-dialog__input"
                :disabled="isSaving || mode !== 'newDicom'"
                :value="seriesDescription"
                @input="emit('update:seriesDescription', ($event.target as HTMLInputElement).value)"
              />
            </div>

            <label class="fusion-registration-save-dialog__choice">
              <input
                data-testid="br-radio"
                type="radio"
                name="fusion-registration-save-mode"
                value="br"
                :checked="mode === 'br'"
                :disabled="isSaving"
                @change="emit('update:mode', 'br')"
              />
              <span class="fusion-registration-save-dialog__radio" />
              <span class="fusion-registration-save-dialog__choice-text">
                <strong>保存为 .br 文件</strong>
                <small>保存当前序列匹配、PET 单位、窗口和平移/旋转参数。</small>
              </span>
            </label>
          </div>

          <div v-if="!isWeb" class="fusion-registration-save-dialog__group">
            <div class="fusion-registration-save-dialog__field">
              <label for="fusion-registration-output-path">输出路径</label>
              <div class="fusion-registration-save-dialog__path">
                <input
                  id="fusion-registration-output-path"
                  data-testid="output-directory-input"
                  class="fusion-registration-save-dialog__input"
                  :disabled="isSaving"
                  :value="outputDirectory"
                  @input="emit('update:outputDirectory', ($event.target as HTMLInputElement).value)"
                />
                <button
                  type="button"
                  class="fusion-registration-save-dialog__small-button"
                  data-testid="browse-button"
                  title="选择输出文件夹"
                  :disabled="isSaving"
                  @click="emit('browse')"
                >
                  ...
                </button>
              </div>
            </div>
          </div>

          <div v-if="error" class="fusion-registration-save-dialog__status fusion-registration-save-dialog__status--error" role="alert">
            {{ error }}
          </div>
          <div v-else-if="savedDirectory && !isWeb" class="fusion-registration-save-dialog__status fusion-registration-save-dialog__status--success">
            已保存到 {{ savedDirectory }}
          </div>
        </div>

        <footer class="fusion-registration-save-dialog__footer">
          <button
            v-if="!isWeb"
            type="button"
            class="fusion-registration-save-dialog__secondary"
            data-testid="open-folder-button"
            :disabled="!canOpenFolder || isSaving"
            @click="emit('openFolder')"
          >
            打开文件夹
          </button>
          <button
            type="button"
            class="fusion-registration-save-dialog__secondary"
            :disabled="isSaving"
            @click="emit('close')"
          >
            取消
          </button>
          <button
            type="button"
            class="fusion-registration-save-dialog__primary"
            data-testid="save-button"
            :disabled="!canSave"
            @click="emit('save')"
          >
            {{ saveButtonLabel }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.fusion-registration-save-dialog {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 18px;
  background: color-mix(in srgb, var(--theme-overlay-scrim, rgba(0, 0, 0, 0.56)) 82%, transparent);
  backdrop-filter: blur(4px);
}

.fusion-registration-save-dialog__panel {
  width: min(620px, calc(100vw - 32px));
  max-height: min(760px, calc(100vh - 32px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 76%, transparent);
  border-radius: 10px;
  background: var(--theme-surface-panel-strong-solid);
  color: var(--theme-text-primary);
  box-shadow: 0 20px 52px rgba(0, 0, 0, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.fusion-registration-save-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 46px;
  padding: 0 10px 0 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--theme-border-subtle) 82%, transparent);
  background: color-mix(in srgb, var(--theme-surface-card) 72%, transparent);
}

.fusion-registration-save-dialog__title {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
}

.fusion-registration-save-dialog__title h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  letter-spacing: 0;
}

.fusion-registration-save-dialog__title-icon,
.fusion-registration-save-dialog__icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.fusion-registration-save-dialog__title-icon {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background: color-mix(in srgb, var(--theme-accent) 16%, transparent);
  color: var(--theme-accent);
}

.fusion-registration-save-dialog__icon-button {
  width: 32px;
  height: 32px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--theme-text-secondary);
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.fusion-registration-save-dialog__icon-button:enabled:hover {
  border-color: color-mix(in srgb, var(--theme-border-strong) 56%, transparent);
  background: color-mix(in srgb, var(--theme-surface-card) 70%, transparent);
  color: var(--theme-text-primary);
}

.fusion-registration-save-dialog__body {
  overflow-y: auto;
  padding: 16px 18px 12px;
  font-size: 13px;
}

.fusion-registration-save-dialog__group + .fusion-registration-save-dialog__group,
.fusion-registration-save-dialog__status {
  margin-top: 14px;
}

.fusion-registration-save-dialog__group-title {
  margin-bottom: 9px;
  color: var(--theme-text-secondary);
  font-size: 12px;
  font-weight: 650;
}

.fusion-registration-save-dialog__choice {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 9px;
  align-items: flex-start;
  padding: 8px 9px;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
}

.fusion-registration-save-dialog__choice:hover {
  border-color: color-mix(in srgb, var(--theme-border-subtle) 70%, transparent);
  background: color-mix(in srgb, var(--theme-surface-card) 42%, transparent);
}

.fusion-registration-save-dialog__choice--disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.fusion-registration-save-dialog__choice--disabled:hover {
  border-color: transparent;
  background: transparent;
}

.fusion-registration-save-dialog__choice input[type='radio'] {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.fusion-registration-save-dialog__radio {
  display: inline-flex;
  width: 16px;
  height: 16px;
  margin-top: 2px;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 86%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 90%, transparent);
  box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--theme-surface-panel-strong-solid) 92%, transparent);
}

.fusion-registration-save-dialog__choice input[type='radio']:checked + .fusion-registration-save-dialog__radio {
  border-color: var(--theme-accent);
  background: var(--theme-accent);
}

.fusion-registration-save-dialog__choice-text {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.fusion-registration-save-dialog__choice-text strong {
  font-size: 13.5px;
  font-weight: 650;
}

.fusion-registration-save-dialog__choice-text small {
  color: var(--theme-text-secondary);
  font-size: 12px;
  line-height: 1.45;
}

.fusion-registration-save-dialog__field {
  display: grid;
  gap: 6px;
}

.fusion-registration-save-dialog__field--indented {
  margin: 2px 9px 6px 36px;
}

.fusion-registration-save-dialog__field label {
  color: var(--theme-text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.fusion-registration-save-dialog__path {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 34px;
  gap: 8px;
}

.fusion-registration-save-dialog__input {
  width: 100%;
  min-width: 0;
  height: 34px;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 72%, transparent);
  border-radius: 7px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 92%, transparent);
  color: var(--theme-text-primary);
  padding: 0 10px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.fusion-registration-save-dialog__input:focus {
  border-color: color-mix(in srgb, var(--theme-accent) 60%, var(--theme-border-strong));
  box-shadow: var(--theme-focus-ring);
}

.fusion-registration-save-dialog__input:disabled {
  opacity: 0.58;
}

.fusion-registration-save-dialog__small-button,
.fusion-registration-save-dialog__primary,
.fusion-registration-save-dialog__secondary {
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 74%, transparent);
  border-radius: 7px;
  background: color-mix(in srgb, var(--theme-surface-card) 78%, transparent);
  color: var(--theme-text-primary);
  font-weight: 650;
  transition: border-color 0.15s ease, background 0.15s ease, opacity 0.15s ease;
}

.fusion-registration-save-dialog__small-button {
  height: 34px;
  min-width: 0;
  font-size: 15px;
}

.fusion-registration-save-dialog__small-button:enabled:hover,
.fusion-registration-save-dialog__secondary:enabled:hover {
  border-color: color-mix(in srgb, var(--theme-accent) 42%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 8%, var(--theme-surface-card));
}

.fusion-registration-save-dialog__status {
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.45;
}

.fusion-registration-save-dialog__status--error {
  border: 1px solid color-mix(in srgb, var(--theme-status-danger) 42%, transparent);
  background: color-mix(in srgb, var(--theme-status-danger) 10%, transparent);
  color: var(--theme-status-danger-text);
}

.fusion-registration-save-dialog__status--success {
  border: 1px solid color-mix(in srgb, var(--theme-status-success) 42%, transparent);
  background: color-mix(in srgb, var(--theme-status-success) 10%, transparent);
  color: var(--theme-status-success-text);
}

.fusion-registration-save-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px 16px;
  border-top: 1px solid color-mix(in srgb, var(--theme-border-subtle) 70%, transparent);
}

.fusion-registration-save-dialog__primary,
.fusion-registration-save-dialog__secondary {
  min-width: 92px;
  height: 34px;
  padding: 0 14px;
  font-size: 13px;
}

.fusion-registration-save-dialog__primary {
  border-color: color-mix(in srgb, var(--theme-accent) 64%, var(--theme-border-strong));
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--theme-accent) 86%, white 8%),
    var(--theme-accent-strong)
  );
  color: var(--theme-accent-contrast);
}

.fusion-registration-save-dialog__primary:enabled:hover {
  filter: brightness(1.06);
}

.fusion-registration-save-dialog__primary:disabled,
.fusion-registration-save-dialog__secondary:disabled,
.fusion-registration-save-dialog__small-button:disabled,
.fusion-registration-save-dialog__icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@media (max-width: 560px) {
  .fusion-registration-save-dialog {
    padding: 10px;
  }

  .fusion-registration-save-dialog__panel {
    width: calc(100vw - 20px);
  }

  .fusion-registration-save-dialog__body {
    padding: 14px;
  }

  .fusion-registration-save-dialog__field--indented {
    margin-left: 0;
  }

  .fusion-registration-save-dialog__footer {
    flex-wrap: wrap;
    padding: 12px 14px 14px;
  }

  .fusion-registration-save-dialog__primary,
  .fusion-registration-save-dialog__secondary {
    flex: 1 1 120px;
  }
}
</style>
