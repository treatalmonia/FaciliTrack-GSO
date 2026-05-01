<template>
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="visible" class="toast" :class="`toast--${type}`" role="alert">
        <span class="toast__icon">{{ icon }}</span>
        <span class="toast__message">{{ message }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  message: { type: String, default: 'Saved.' },
  type:    { type: String, default: 'success' }, // 'success' | 'error' | 'warning'
  show:    { type: Boolean, default: false },
  duration:{ type: Number,  default: 3000 },
})

const emit = defineEmits(['done'])

const visible = ref(false)
let timer = null

const icon = computed(() => {
  if (props.type === 'error')   return '✕'
  if (props.type === 'warning') return '⚠'
  return '✓'
})

watch(() => props.show, (val) => {
  if (val) {
    visible.value = true
    clearTimeout(timer)
    timer = setTimeout(() => {
      visible.value = false
      emit('done')
    }, props.duration)
  }
})
</script>

<style scoped>
.toast {
  position: fixed;
  bottom: 88px;          /* sits above the mobile nav bar */
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 24px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  z-index: 9999;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}

.toast--success { background: #1a7f37; color: #fff; }
.toast--error   { background: #c0392b; color: #fff; }
.toast--warning { background: #b7791f; color: #fff; }

.toast__icon { font-size: 16px; }

/* Transition */
.toast-enter-active, .toast-leave-active { transition: all 0.25s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(12px); }
</style>
