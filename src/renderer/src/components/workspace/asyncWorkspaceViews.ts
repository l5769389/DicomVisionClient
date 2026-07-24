import { defineAsyncComponent } from 'vue'

export const CompareStackView = defineAsyncComponent(() => import('../viewer/views/CompareStackView.vue'))
export const FourDView = defineAsyncComponent(() => import('../viewer/views/FourDView.vue'))
export const LayoutView = defineAsyncComponent(() => import('../viewer/views/LayoutView.vue'))
export const MprView = defineAsyncComponent(() => import('../viewer/views/MprView.vue'))
export const MontageView = defineAsyncComponent(() => import('../viewer/views/MontageView.vue'))
export const PetCtFusionView = defineAsyncComponent(() => import('../viewer/views/PetCtFusionView.vue'))
export const StackView = defineAsyncComponent(() => import('../viewer/views/StackView.vue'))
export const DicomTagView = defineAsyncComponent(() => import('../viewer/views/DicomTagView.vue'))
export const VolumeView = defineAsyncComponent(() => import('../viewer/views/VolumeView.vue'))
