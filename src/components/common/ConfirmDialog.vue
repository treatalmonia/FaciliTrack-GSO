<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="show" class="dialog-overlay" @click.self="$emit('cancel')">
        <div class="dialog" role="dialog" :aria-label="title">
          <p class="dialog__title">{{ title }}</p>

          <!-- Diff view: only show changed fields -->
          <div v-if="changes && changes.length" class="dialog__changes">
            <p class="dialog__changes-label">You are changing:</p>
            <div
              v-for="change in changes"
              :key="change.field"
              class="dialog__change-row"
            >
              <span class="dialog__change-field">{{ change.field }}</span>
              <span class="dialog__change-arrow">
                <s class="dialog__old">{{ change.from }}</s>
                &rarr;
                <strong class="dialog__new">{{ change.to }}</strong>
              </span>
            </div>
          </div>

          <!-- Generic body message -->
          <p v-else-if="body" class="dialog__body">{{ body }}</p>

          <!-- Reason selector (for archive) -->
          <div v-if="showReasonPicker" class="dialog__reasons">
            <p class="dialog__changes-label">Why are you removing this?</p>
            <button
              v-for="reason in archiveReasons"
              :key="reason"
              class="dialog__reason-btn"
              :class="{ 'dialog__reason-btn--selected': selectedReason === reason }"
              @click="selectedReason = reason"
            >
              {{ reason }}
            </button>
            <input
              v-if="selectedReason === 'Other'"
              v-model="customReason"
              class="dialog__reason-input"
              placeholder="Describe the reason..."
            />
          </div>

          <div class="dialog__actions">
            <button class="dialog__btn dialog__btn--cancel" @click="$emit('cancel')">
              Cancel
            </button>
            <button
              class="dialog__btn dialog__btn--confirm"
              :class="{ 'dialog__btn--danger': danger }"
              :disabled="showReasonPicker && !finalReason"
              @click="handleConfirm"
            >
              {{ confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  show:             { type: Boolean, default: false },
  title:            { type: String,  required: true },
  body:             { type: String,  default: '' },
  confirmLabel:     { type: String,  default: 'Confirm' },
  danger:           { type: Boolean, default: false },
  changes:          { type: Array,   default: null },  // [{ field, from, to }]
  showReasonPicker: { type: Boolean, default: false },
})

const emit = defineEmits(['confirm', 'cancel'])

const archiveReasons = [
  'Wrong entry — entered by mistake',
  'Room no longer exists',
  'Building demolished or decommissioned',
  'Equipment removed permanently',
  'Other',
]

const selectedReason = ref('')
const customReason   = ref('')

const finalReason = computed(() => {
  if (!props.showReasonPicker) return true
  if (selectedReason.value === 'Other') return customReason.value.trim()
  return selectedReason.value
})

function handleConfirm() {
  if (props.showReasonPicker) {
    emit('confirm', finalReason.value)
  } else {
    emit('confirm')
  }
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
  padding: 24px;
}

.dialog {
  background: var(--surface);
  border-radius: 16px;
  padding: 28px 24px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
}

.dialog__title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 16px;
  line-height: 1.4;
}

.dialog__body {
  font-size: 15px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0 0 20px;
}

.dialog__changes { margin-bottom: 20px; }

.dialog__changes-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 0 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.dialog__change-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}
.dialog__change-field { font-weight: 600; color: var(--text-primary); }
.dialog__old  { color: var(--red); }
.dialog__new  { color: var(--green); }

.dialog__reasons { margin-bottom: 20px; display: flex; flex-direction: column; gap: 8px; }

.dialog__reason-btn {
  text-align: left;
  padding: 12px 16px;
  border: 2px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  min-height: 48px;
  transition: border-color 0.15s;
}
.dialog__reason-btn--selected { border-color: var(--blue); background: var(--blue-light); }

.dialog__reason-input {
  padding: 12px 14px;
  border: 2px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  width: 100%;
  box-sizing: border-box;
  min-height: 44px;
}

.dialog__actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 4px;
}

.dialog__btn {
  padding: 12px 20px;
  border-radius: 8px;
  border: none;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  min-height: 48px;
}
.dialog__btn--cancel  { background: var(--bg); color: var(--text-secondary); }
.dialog__btn--confirm { background: var(--blue); color: #fff; }
.dialog__btn--danger  { background: var(--red); color: #fff; }
.dialog__btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Transition */
.dialog-enter-active, .dialog-leave-active { transition: all 0.2s ease; }
.dialog-enter-from, .dialog-leave-to { opacity: 0; transform: scale(0.96); }
</style>
