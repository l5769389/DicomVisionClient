<script setup lang="ts">
import AppIcon from '../AppIcon.vue'

defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[1300] flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(68,153,224,0.16),transparent_38%),rgba(3,8,15,0.32)] px-4 backdrop-blur-[6px]" @click.self="emit('close')">
      <div class="relative w-full max-w-[760px] overflow-hidden rounded-[30px] border border-sky-200/18 bg-[linear-gradient(180deg,rgba(9,19,33,0.94),rgba(8,15,27,0.97))] shadow-[0_34px_90px_rgba(0,0,0,0.42)]">
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(102,204,255,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,148,89,0.12),transparent_24%)]"></div>
        <div class="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent"></div>
        <div class="border-b border-white/8 px-6 py-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <div class="text-lg font-semibold text-white">Workspace Settings</div>
              <div class="mt-1 text-sm text-slate-400">统一的应用配置对话框，后续可以继续扩展更多设置项。</div>
            </div>
            <button type="button" class="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-white/6 text-slate-200 transition hover:bg-white/12" aria-label="关闭设置" @click="emit('close')"><AppIcon name="close" :size="16" /></button>
          </div>
        </div>
        <div class="grid gap-4 px-6 py-6 md:grid-cols-2">
          <div class="rounded-[24px] border border-white/8 bg-white/4 p-4">
            <div class="mb-3 flex items-center gap-2 text-slate-100"><AppIcon name="palette" :size="17" /><span class="text-sm font-semibold">Interface Tone</span></div>
            <div class="rounded-2xl border border-sky-300/12 bg-sky-300/6 p-3">
              <div class="text-sm font-medium text-white">Focused Diagnostic Contrast</div>
              <div class="mt-1 text-xs leading-5 text-slate-400">保持当前深色高对比主题，适合长时间阅片和高亮状态提示。</div>
            </div>
          </div>
          <div class="rounded-[24px] border border-white/8 bg-white/4 p-4">
            <div class="mb-3 flex items-center gap-2 text-slate-100"><AppIcon name="bell" :size="17" /><span class="text-sm font-semibold">Notifications</span></div>
            <div class="space-y-3">
              <div class="flex items-center justify-between rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                <div>
                  <div class="text-sm font-medium text-white">Load Feedback</div>
                  <div class="mt-1 text-xs text-slate-400">Folder loading and series append feedback</div>
                </div>
                <span class="inline-flex h-6 w-11 items-center rounded-full bg-sky-300/14 p-1"><span class="ml-auto h-4 w-4 rounded-full bg-sky-200"></span></span>
              </div>
              <div class="flex items-center justify-between rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                <div>
                  <div class="text-sm font-medium text-white">Reconnect Notice</div>
                  <div class="mt-1 text-xs text-slate-400">Socket reconnect and backend state prompts</div>
                </div>
                <span class="rounded-full border border-amber-300/16 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold text-amber-50">Enabled</span>
              </div>
            </div>
          </div>
          <div class="rounded-[24px] border border-white/8 bg-white/4 p-4">
            <div class="mb-3 flex items-center gap-2 text-slate-100"><AppIcon name="shield" :size="17" /><span class="text-sm font-semibold">Session Guard</span></div>
            <div class="flex items-center justify-between rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
              <div>
                <div class="text-sm font-medium text-white">Viewport Sync</div>
                <div class="mt-1 text-xs text-slate-400">Keep render and interaction state aligned</div>
              </div>
              <span class="rounded-full border border-emerald-300/14 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-100">Active</span>
            </div>
          </div>
          <div class="rounded-[24px] border border-white/8 bg-white/4 p-4">
            <div class="mb-3 flex items-center gap-2 text-slate-100"><AppIcon name="settings" :size="17" /><span class="text-sm font-semibold">Scaffold</span></div>
            <div class="rounded-2xl border border-dashed border-white/10 bg-white/3 px-3 py-4 text-xs leading-5 text-slate-400">这里预留给后续更多 app 配置项，例如渲染偏好、快捷键、后端地址与缓存策略。</div>
          </div>
        </div>
        <div class="border-t border-white/8 px-6 py-4 text-[11px] text-slate-500">当前为设计稿式 dialog，后续可直接接入真实设置状态。</div>
      </div>
    </div>
  </Teleport>
</template>
